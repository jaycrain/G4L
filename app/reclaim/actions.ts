'use server';

import { memberTurn } from '../../lib/agent/member-display.ts';
import { recordFurthestStep } from '../../lib/agent/session-step.ts';
import { getDb } from '../../lib/db/index.ts';
import { harvestSignal } from '../../lib/agent/harvest.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { recordTurnFailure } from '../../lib/telemetry/turn-failure.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Expectation, Turn } from '../../lib/agent/onboarding.ts';
import {
  reclaimEnabled,
  reclaimC1Opening,
  applyReclaimC1Turn,
  liveTurnReclaimRefine,
  reclaimC2Opening,
  applyReclaimC2Turn,
  liveTurnReclaimC2,
  reclaimC3Opening,
  liveTurnReclaimC3,
  reclaimCheckpointOpening,
  liveTurnReclaimCheckpoint,
  RECLAIM_C1_ARC,
  RECLAIM_C2_ARC,
  RECLAIM_C3_ARC,
  RECLAIM_CHECKPOINT_ARC,
  composeQualityDay,
  composeRefinedList,
} from '../../lib/agent/reclaim.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';
import { expectsForState, type ArcConfig } from '../../lib/agent/onboarding-staged.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../../lib/agent/arc-session.ts';
import { getLegacyLetter } from '../../lib/reconnect/legacy-letter-store.ts';
import { getReclaimItems, liveReclaimTexts } from '../../lib/beats/store.ts';
import { commitListChange, commitRefinement, resolveRefinement, isTier, type Tier } from '../../lib/reclaim/refinement-store.ts';
import { persistBiggerWorldReading, type AuditReflections } from '../../lib/reclaim/bigger-world-store.ts';
import { AUDIT_ITEM_COUNT } from '../../lib/reclaim/bigger-world-instrument.ts';
import { persistQualityDayProfile } from '../../lib/reclaim/quality-day-store.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, challengeCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_CHALLENGE_ITEMS, CHECKPOINT_CHALLENGE_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed, markCheckpointClosed } from '../../lib/curriculum/store.ts';
import { acknowledgeSessionBadge } from '../../lib/curriculum/view.ts';
import type { ReclaimCeremonyData } from '../../lib/ceremony/reclaim-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';
import { carryForward, describeCarryForward } from '../../lib/curriculum/retention.ts';

// v2.5 Reclaim server actions. C1 · Readiness (evidence + refine→commit) + C2 · Bigger World Audit (administered →
// RC-1, persisted) + C3 · Quality Days (coach-define → store + open the logging week) + C4 · The Reclaim Checkpoint
// (administered Challenge read → the capstone ceremony → closes Cycle 1). Flag-gated (RECLAIM).
export type ReclaimSession = 'c1' | 'c2' | 'c3' | 'checkpoint';

export async function startReclaimAction(
  memberId: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'c2') return { ok: true, ...openTurn(reclaimC2Opening()) };
  if (session === 'c3') return { ok: true, ...openTurn(reclaimC3Opening()) };
  if (session === 'checkpoint') return { ok: true, ...openTurn(reclaimCheckpointOpening()) };
  // C1: seed the member's LIVE Reclaim List so Step 2 can present it for the re-read. Resilient (W-29): reads the
  // categorized rows and falls back to the committed jsonb list on reclaim_item drift — so the member NEVER sees
  // "your list is empty" when items actually exist (which would invite building a parallel list).
  const db = (await getDb()) as unknown as Db;
  const items = await liveReclaimTexts(db, memberId);
  return { ok: true, ...openTurn(reclaimC1Opening(items)) };
}

function openTurn(turn: Turn): { reply: string; state: ConvState; expects?: Expectation } {
  return { reply: turn.reply, state: turn.state, expects: turn.expects };
}

// Per-turn save/resume (W-15 pattern, per Reclaim session). Keyed by (member, 'reclaim', session). Cleared on completion.
const beatBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

const reclaimArcFor = (session: ReclaimSession): ArcConfig =>
  session === 'c2' ? RECLAIM_C2_ARC : session === 'c3' ? RECLAIM_C3_ARC : session === 'checkpoint' ? RECLAIM_CHECKPOINT_ARC : RECLAIM_C1_ARC;

async function persistReclaimArcSession(db: Db, memberId: string, session: ReclaimSession, history: ConvMessage[], message: string, reply: string, turn: Turn): Promise<void> {
  try {
    // WHERE THEY GOT TO, recorded before the early return so it covers the member who finishes AND the one who
    // walks away mid-Session — the second is the whole point of the measure. Best-effort and self-swallowing.
    await recordFurthestStep(db, memberId, session === 'checkpoint' ? 'RCL-C4' : `RCL-${session.toUpperCase()}`, turn.state, history.length);
    if (turn.complete || turn.state.stage === 'ceremony') {
      await clearArcSession(db, memberId, 'reclaim', session);
      return;
    }
    // The turn's visual attaches to the LAST agent bubble — the one whose text it was drawn beside — so a
    // mid-Session resume redraws exactly what the member was looking at when they stopped.
    const bubbles = beatBubbles(reply);
    if (turn.visual && bubbles.length) bubbles[bubbles.length - 1] = { ...bubbles[bubbles.length - 1]!, visual: turn.visual };
    const messages: ConvMessage[] = [...history, memberTurn(message), ...bubbles];
    await saveArcSession(db, memberId, 'reclaim', turn.state, messages, session);
  } catch {
    // swallow — resume is best-effort; the turn already succeeded for the member.
  }
}

export async function loadReclaimSessionAction(
  memberId: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; session?: { state: ConvState; messages: ConvMessage[]; expects?: Expectation }; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const saved = await loadArcSession(db, memberId, 'reclaim', session);
    if (!saved || saved.messages.length === 0) return { ok: true };
    const expects = expectsForState(reclaimArcFor(session), saved.state);
    return { ok: true, session: { state: saved.state, messages: saved.messages, expects } };
  } catch {
    return { ok: false, error: 'Could not load your session.' };
  }
}

export async function reclaimTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string; earnedBadge?: { id: string; name: string } | null }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  // GOVERNANCE — ESCALATE TO A HUMAN. The engine already short-circuits this turn to the 988 protocol
  // (runArcTurn); that is the member's immediate help and it is unchanged. This is the other half of the rule
  // the Framework states and our own prohibitions spell out ("Route to 988 and escalate to a human within
  // 24h") — until 2026-08-07 nothing recorded a crisis anywhere, so no human could have followed up on one.
  // Checked here with the SAME predicate the engine uses, so the two can never disagree about what counts.
  if (detectCrisis(message).flagged) {
    await escalateCrisis((await getDb()) as unknown as Db, memberId, { surface: 'session', message });
  }
  try {
    // C4 · The Reclaim Checkpoint — administered (deterministic Likert). On the checkpoint→ceremony crossing it scores
    // the Challenge component + persists the reading + sets the capstone gate.
    // C4 WRITES NO PLAY EITHER, for a different reason (2026-08-12). Its close produces a Grinta checkpoint
    // READING — a score. A play is the member's own language, and C4 captures none: composing prose to make one
    // would mean writing a sentence in their voice that they never said, which is the rule we tightened this week.
    // The Reclaim ceremony revisits their Legacy Letter and Success Story, and those are kept where they were
    // written. A capstone play would have to come from a member's words, so it waits for a beat that captures some.
    if (session === 'checkpoint') {
      const turn = liveTurnReclaimCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistReclaimCheckpoint(db, memberId, state, turn);
      await persistReclaimArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // C2 · Bigger World Audit — the 20 ratings are administered (deterministic 1–10); Greg's evocation stages
    // around them are conversational (2026-08-28). On completion, persist the durable priorities (RC-4).
    if (session === 'c2') {
      const db = (await getDb()) as unknown as Db;
      // C2's carry-forward, deliverable at last — and NOT optional here: Greg's stage 5 asks the member to
      // connect earlier work to what they just said, which the Companion cannot do without the prior-module
      // context UPSTREAM['c2'] has declared all along. Guarded; losing it costs the connection, not the Session.
      const carriedC2 = describeCarryForward(await carryForward(db, memberId, 'c2').catch(() => []));
      const turn = await liveTurnReclaimC2(state, history, message, carriedC2);
      let c2Badge: { id: string; name: string } | null = null;
      if (turn.complete) {
        const responses = (turn.state.administeredResponses ?? []).slice(0, AUDIT_ITEM_COUNT);
        if (responses.length === AUDIT_ITEM_COUNT) {
          try {
            // The reflection half rides in the arc's collected state (V4 Q3/Q7/Q8 + the cross-domain sort). It is
            // typed structurally on Collected to avoid an onboarding→reclaim dependency, so it narrows here at the
            // boundary — this cast is the ONE place the two shapes meet.
            const reflections = turn.state.collected?.auditReflections as AuditReflections | undefined;
            await persistBiggerWorldReading(db, memberId, responses, reflections);
          } catch (e) {
            // Logged, not silent — the member saw the summary, but this register is the ONLY durable copy, and it
            // is what "your bigger world" reads from on the Playbook.
            console.error(`C2 bigger-world reading FAILED to persist for member=${memberId}:`, (e as Error).message);
          }
        }
        // C2 WRITES NO PLAY, AND THAT IS A DECISION (2026-08-12). Its output — First Focus, the momentum lever,
        // their key obstacle and first action — is ALREADY on the Playbook as a computed read ("your bigger
        // world", lib/playbook/reads.ts). A read is derived and always current; a play is a frozen keeper. Having
        // both would put the same fact on the page twice and let them drift apart, which is exactly the defect we
        // deleted off Momentum this morning. If C2's read ever stops being rendered, THAT is when it needs a play.
        try {
          await markSessionClosed(db, memberId, 'RCL-C2');
          c2Badge = await acknowledgeSessionBadge(db, memberId, 'RCL-C2'); // newly-earned milestone → named at the close
        } catch {
          /* swallow — the forecast advance is best-effort */
        }
      }
      await persistReclaimArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge: c2Badge };
    }
    // C3 · Quality Days — a LIVE coaching turn. On confirm, store the Quality-Day profile + open the logging week.
    if (session === 'c3') {
      const db = (await getDb()) as unknown as Db;
      // The second fan-in: C3 reads B3 + C2. Greg's C3 step is about the gap between what they PLANNED in the
      // pilot and what the week actually held, so both halves of B3 (the plan and the entries) carry forward.
      const carried = await carryForward(db, memberId, 'c3').catch(() => []);
      const turn = await liveTurnReclaimC3(state, history, message, describeCarryForward(carried));
      let c3Badge: { id: string; name: string } | null = null;
      if (turn.complete && turn.state.collected?.pendingQualityDay) {
        const qd = turn.state.collected.pendingQualityDay;
        if (qd.nonNegotiables.length) {
          // THE PROFILE AND THE WEEK ARE COUPLED. They used to be two independent swallowed try blocks, and that
          // produced exactly the state Jay hit on prod: the week OPENED, the profile did NOT store, and his
          // "This week" was a running day-3-of-7 with no rows — forever, because the rows ARE the profile.
          //
          // A Quality Days week without its profile is strictly worse than no week: the grid can never fill, and
          // the outcome card advertises a tracked week that can never complete. So the week now opens only if the
          // profile actually landed, and a failure is LOGGED rather than swallowed — a silent write failure that
          // leaves dependent state behind is invisible data loss (same family as the harvest silent-drop).
          let profileStored = false;
          try {
            await persistQualityDayProfile(db, memberId, qd);
            profileStored = true;
          } catch (e) {
            console.error(`C3 quality-day profile FAILED to persist for member=${memberId}:`, (e as Error).message);
          }
          if (profileStored) {
            try {
              await startPracticeWeek(db, memberId, 'c3_quality');
            } catch (e) {
              console.error(`C3 practice week failed to open for member=${memberId}:`, (e as Error).message);
            }
            // THE PLAY. Reclaim was committing nothing to the Playbook — a member could finish C1 through C4 and
            // watch their count sit still, which is what Jay hit on his own account. Rewire and Rebuild each write
            // a keeper at their close; this is Reclaim's first, and it is the same call B3 makes so the two read
            // alike on the page (keeperType 'plan' → the "What worked" tab).
            //
            // SEPARATE try, and AFTER the week. harvestSignal commits the keeper even when the QI moment-emit
            // fails — that is the prod silent-drop lesson — but a failure here must not cost the profile or the
            // week that already landed.
            try {
              await harvestSignal(
                db,
                memberId,
                {
                  kind: 'plan',
                  ref: 'c3',
                  keeperType: 'plan',
                  destinationIntent: 'keeper',
                  payloadRef: composeQualityDay(qd),
                  label: 'Your Quality Days',
                  confirmed: true, // she built and signed off this profile in-session
                },
                'reclaim',
              );
            } catch (e) {
              console.error(`C3 Playbook play failed for member=${memberId}:`, (e as Error).message);
            }
          }
          try {
            // Close the session for the forecast, but do NOT earn/surface the "quality-days" badge here — it now
            // earns when the member LOGS a quality day (living the tracking week), not at the definition close (Donna).
            await markSessionClosed(db, memberId, 'RCL-C3');
          } catch {
            /* swallow — the forecast advance is best-effort */
          }
        }
      }
      await persistReclaimArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge: c3Badge };
    }
    // C1 · Looking Forward is a single coaching stage now (Greg cut the evidence self-check, 8/7). The else branch is
    // no longer a second live stage — it only catches a session persisted mid-'evidence', which applyReclaimC1Turn
    // migrates onto 'refine' deterministically. See RETIRED_C1_STAGES.
    const db = (await getDb()) as unknown as Db;
    // CARRY-FORWARD — C1 has no `load prior module context` line; its Inputs declare "prior_module_context
    // (summaries from Reconnect, Rewire, Rebuild where available)", i.e. everything before it. That is the whole
    // point of C1: the member re-reads a list they wrote as a different person, and the refinement is only honest
    // if the Companion holds what changed them in between.
    const carriedC1 = describeCarryForward(await carryForward(db, memberId, 'c1').catch(() => []));
    const turn = await liveTurnReclaimRefine(state, history, message, carriedC1);

    // DRAIN THE CONFIRMED PASS. C1 commits as it goes (Jay, 2026-08-29), so each member-confirmed change lands
    // here on the turn they confirm it — not in a batch at the close, which is what loses everything when
    // someone leaves a twenty-minute Session two thirds through.
    //
    // NOT best-effort, and this is the one place that distinction matters. The member has ALREADY been told the
    // change was made; swallowing a failure here would make the product lie about their own list, which is the
    // exact fault CAT-36 was raised for one layer up. A failure is logged loudly and the change is left on the
    // state so the next turn retries rather than dropping it silently. [[swallowed-read-renders-as-truth]]
    const change = turn.state.pendingListChange;
    if (change) {
      const res = await commitListChange(db, memberId, change as Parameters<typeof commitListChange>[2]);
      if (res.ok) delete turn.state.pendingListChange;
      else console.error(`C1: confirmed ${change.op} did NOT reach the Reclaim List (${res.reason}) member=${memberId}`);
    }

    // CAT-36 (option b, Jay 2026-08-01) — VALIDATE BEFORE THE MEMBER IS ASKED TO CONFIRM.
    //
    // The model's `original` string was the join key at COMMIT time, so a wording it invented matched nothing,
    // applied 0 rows, and the member was still told "your Reclaim List now reflects where you actually are".
    // The product lying to someone about their own data — the one thing this surface exists to get right.
    //
    // Resolving here means anything that reaches the confirmation is guaranteed to land. Unmatched lines are
    // dropped from the snapshot (an add goes through the normal path, not a refinement); if NOTHING resolves we
    // clear the proposal entirely, so the coach keeps talking instead of offering a save that cannot happen.
    const pending = turn.state.collected?.pendingRefinement;
    if (pending?.items?.length && !pending.items.every((i) => i.reclaimItemId)) {
      try {
        const { resolved, unmatched } = await resolveRefinement(
          db, memberId,
          pending.items.filter((i) => isTier(i.tier)).map((i) => ({ original: i.original, text: i.text, tier: i.tier as Tier })),
        );
        if (unmatched.length) {
          console.warn(
            `CAT-36: dropped ${unmatched.length} refined item(s) that matched no live Reclaim item for ` +
            `member=${memberId} — they never reach the confirmation: ${unmatched.map((u) => JSON.stringify(u.original)).join(', ')}`,
          );
        }
        if (resolved.length) pending.items = resolved;
        else {
          console.error(`CAT-36: NO refined item matched the live list for member=${memberId} — proposal withdrawn rather than promised.`);
          turn.state.collected!.pendingRefinement = undefined;
        }
      } catch (e) {
        console.error('CAT-36: could not resolve the refinement against the live list:', e);
      }
    }

    // On completion (the member confirmed the refinement) → COMMIT the snapshot to the live Reclaim List. Best-effort:
    // the member already saw the confirmation; a write hiccup never breaks the close.
    if (turn.complete) {
      const p = turn.state.collected?.pendingRefinement;
      const items = (p?.items ?? [])
        .filter((i) => isTier(i.tier))
        .map((i) => ({ original: i.original, text: i.text, tier: i.tier as Tier, reclaimItemId: i.reclaimItemId }));
      if (items.length && p) {
        // CAT-36(b/c) — DON'T TELL THEM IT SAVED WHEN IT DIDN'T. The commit outcome was swallowed entirely, so a
        // refinement that matched NOTHING (drifted reclaim_item table, or the model recording "originals" it
        // invented) applied 0 rows while the member was told their list now reflects them. That is the product
        // lying to someone about their own data — the one thing this surface exists to get right.
        //
        // We still don't interrupt them mid-ceremony over it; what changes is that a no-op is now LOUD in the
        // logs with the member id, so it is discoverable instead of silent. A visible correction path is the
        // follow-up, but silence was the actual defect.
        try {
          const res = await commitRefinement(db, memberId, { items, top3: p.top3 });
          if (!res.applied) {
            console.error(
              `CAT-36: C1 refinement applied 0 of ${items.length} items for member=${memberId} — the member was ` +
                `told their Reclaim List was updated but NOTHING changed. Likely a drifted reclaim_item table or ` +
                `model-invented originals that match no live item.`,
            );
          }
        } catch (e) {
          console.error('CAT-36: C1 refinement commit THREW after the member confirmed:', (e as Error).message);
        }
        // THE PLAY — the short answer to "what am I taking back", in the order the member put it. Its own try,
        // after the commit: the refinement is the thing that matters and a keeper failure must not touch it.
        try {
          const body = composeRefinedList(p.top3 ?? []);
          if (body) {
            await harvestSignal(
              db,
              memberId,
              { kind: 'plan', ref: 'c1', keeperType: 'plan', destinationIntent: 'keeper', payloadRef: body, label: 'Your Reclaim List, refined', confirmed: true },
              'reclaim',
            );
          }
        } catch (e) {
          console.error(`C1 Playbook play failed for member=${memberId}:`, (e as Error).message);
        }
      }
      try {
        await markSessionClosed(db, memberId, 'RCL-C1');
      } catch {
        /* swallow — the forecast advance is best-effort */
      }
    }
    await persistReclaimArcSession(db, memberId, session, history, message, turn.reply, turn);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  } catch (e) {
    // LOUD, BECAUSE A DEAD END IS THE ONE FAILURE THE MEMBER CANNOT ROUTE AROUND.
    //
    // This was a bare `catch` returning the generic line with NO logging — in all four arcs, identically. Donna
    // hit it three times in Reclaim C1 on 2026-09-03, refreshed, hit it again, and escaped only by typing
    // something else ("can we try moving on?"). Nothing was recorded: no member, no session, no stage, no error.
    // The only reason anyone knows it happened is that she screenshotted it.
    //
    // A swallowed read renders as a confident lie; a swallowed THROW renders as a wall. Same defect class, worse
    // surface — she was stuck, and we had nothing to look at. [[swallowed-read-renders-as-truth]]
    //
    // NO MEMBER TEXT IN THE LOG. The length tells us whether size was the trigger; the words are hers and belong
    // behind the wall. Stage + session + error are what actually make the next occurrence diagnosable.
    await recordTurnFailure(memberId, {
      arc: 'reclaim',
      session: session ?? 'RECLAIM',
      stage: (state as { stage?: string } | undefined)?.stage ?? 'unknown',
      msgLen: (message ?? '').length,
      error: e,
    });
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}

// C4 — score the Challenge component (Ave1→Ave2) + persist the Checkpoint grinta_reading + set the capstone gate.
// Fires once, on the checkpoint→ceremony crossing. Best-effort (a write hiccup never breaks the ceremony). A clean 6
// (no pairwise). No new migration — writes the existing grinta_reading.
async function persistReclaimCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const challenge = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_CHALLENGE_ITEMS.length);
    if (challenge.length < CHECKPOINT_CHALLENGE_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_CHALLENGE_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (they moved at the earlier checkpoints); fall back to baseline.
    const carried = {
      reconnect: latest?.strands.reconnect ?? base?.strands.reconnect,
      rewire: latest?.strands.rewire ?? base?.strands.rewire,
      rebuild: latest?.strands.rebuild ?? base?.strands.rebuild,
    };
    const cp = scoreCheckpointStrand({ target: 'reclaim', baselineValues, newValues: challenge, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: challengeCheckpointResponsesMap(challenge), score: cp.score });
    // The capstone — closes Cycle 1 (the Loop). Greg's fired TWICE on 2026-08-07 (04:09 and again at 04:44) because
    // the cross was unguarded; markCheckpointClosed emits it on the first crossing only.
    await markCheckpointClosed(db, memberId, { assetId: 'RCL-C4', eventRef: 'RCL-CHK', phase: 'reclaim' });
    await maybeTriggerDraft(db, memberId, { kind: 'milestone', assetCode: 'RCL-CHK', assetName: 'The Reclaim Checkpoint' });
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The C4 ceremony reveal data: the Challenge COMPONENT move (Ave1→Ave2, foregrounded) + the composite + the Playbook
// seeds (the priorities the member clarified — their top-tier Reclaim List items).
export async function reclaimCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: ReclaimCeremonyData; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers, letter] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadReclaimCeremonyKeepers(db, memberId),
      // Her Legacy Letter, for the revisit beat. Best-effort and NEVER fatal: a ceremony that fails to open
      // because a letter could not be read would cost her the close of a whole cycle. Null falls back to the
      // early-Playbook-words copy, which is what everyone who started before the letter existed will get.
      getLegacyLetter(db, memberId).catch(() => null),
    ]);
    let grinta: ReclaimCeremonyData['grinta'] = null;
    if (latest && latest.strands.reclaim != null) {
      const now = latest.strands.reclaim; // the checkpoint's Challenge Ave2
      const baseline = base?.strands.reclaim ?? null; // Challenge Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return {
      ok: true,
      data: {
        grinta,
        keepers,
        badge: earnedBadgeReveal('reclaim'),
        legacyLetter: letter?.body ? { body: letter.body, datedFor: letter.datedFor } : null,
      },
    };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The Playbook seeds — what the member clarified in Reclaim: their TOP-tier Reclaim List items (from C1's refinement),
// falling back to the first few list items if none are tiered. Best-effort; empty degrades to the fallback copy.
async function loadReclaimCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const items = await getReclaimItems(db, memberId);
    const top = items.filter((i) => i.tier === 'top').map((i) => i.text);
    return (top.length ? top : items.map((i) => i.text)).slice(0, 3);
  } catch {
    return [];
  }
}
