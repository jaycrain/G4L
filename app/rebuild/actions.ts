'use server';

import { getDb } from '../../lib/db/index.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import { setCommitment } from '../../lib/commitments/store.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Expectation, Turn } from '../../lib/agent/onboarding.ts';
import {
  rebuildEnabled,
  rebuildB1Opening,
  liveTurnRebuildB1,
  rebuildB2Opening,
  liveTurnRebuildB2,
  rebuildB3Opening,
  liveTurnRebuildB3,
  composePilotPlan,
  rebuildCheckpointOpening,
  liveTurnRebuildCheckpoint,
  REBUILD_B1_ARC,
  REBUILD_B2_ARC,
  REBUILD_B3_ARC,
  REBUILD_CHECKPOINT_ARC,
} from '../../lib/agent/rebuild.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';
import { scaleExpects, type ArcConfig } from '../../lib/agent/onboarding-staged.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../../lib/agent/arc-session.ts';
import { persistWhyReading, persistSkillsReading } from '../../lib/rebuild/store.ts';
import { persistCoachingPlan } from '../../lib/rebuild/plan-store.ts';
import { setPilotCommitments } from '../../lib/practice/mark.ts';
import { WHY_ITEM_COUNT } from '../../lib/rebuild/why-instrument.ts';
import { SKILLS_ITEM_COUNT } from '../../lib/rebuild/skills-instrument.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';
import { harvestSignal } from '../../lib/agent/harvest.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, controlCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_CONTROL_ITEMS, CHECKPOINT_CONTROL_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed, markCheckpointClosed } from '../../lib/curriculum/store.ts';
import { acknowledgeSessionBadge } from '../../lib/curriculum/view.ts';
import type { RebuildCeremonyData } from '../../lib/ceremony/rebuild-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';

// v2.4 Rebuild server actions. B1 (SDT) + B2 (self-management) are ADMINISTERED reads; B3 · "The Lifestyle Pilot" is
// the LIVE coaching turn (COACH mode) → a confirmed plan; B4 · "The Rebuild Checkpoint" is the administered Control
// read → the earned ceremony (lights Reclaim). Flag-gated (REBUILD). On completion each persists its artifact.
export type RebuildSession = 'b1' | 'b2' | 'b3' | 'checkpoint';

export async function startRebuildAction(
  memberId: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn =
    session === 'checkpoint'
      ? rebuildCheckpointOpening()
      : session === 'b3'
        ? rebuildB3Opening()
        : session === 'b2'
          ? rebuildB2Opening()
          : rebuildB1Opening();
  return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
}

// B4 — pairwise-average the 12 control responses → 6, score the Control component (Ave1→Ave2), persist the Checkpoint
// grinta_reading + light Reclaim. Fires once, on the checkpoint→ceremony crossing. Best-effort (a write hiccup never
// breaks the ceremony). The component change is recomputed at the ceremony from the readings.
async function persistRebuildCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const control = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_CONTROL_ITEMS.length);
    if (control.length < CHECKPOINT_CONTROL_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_CONTROL_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (they may have moved at §2e / R4); fall back to the baseline.
    const carried = {
      reconnect: latest?.strands.reconnect ?? base?.strands.reconnect,
      rewire: latest?.strands.rewire ?? base?.strands.rewire,
      reclaim: latest?.strands.reclaim ?? base?.strands.reclaim,
    };
    // NO REDUCTION STEP since V5 (2026-08-14): B4 administers six items and scores those six. The pairwise
    // 12→6 average is gone with the a/b pairs it existed to collapse — what is asked is now what is scored.
    const cp = scoreCheckpointStrand({ target: 'rebuild', baselineValues, newValues: control, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: controlCheckpointResponsesMap(control), score: cp.score });
    // → activePhaseIndex 3 (Reclaim is now "You're here"). assetId/eventRef differ here — see markCheckpointClosed.
    await markCheckpointClosed(db, memberId, { assetId: 'RBLD-B4', eventRef: 'RBD-CHK', phase: 'rebuild' });
    await maybeTriggerDraft(db, memberId, { kind: 'milestone', assetCode: 'RBD-CHK', assetName: 'The Rebuild Checkpoint' });
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The B4 ceremony reveal data: the Control COMPONENT move (Ave1→Ave2, foregrounded) + the composite + the Playbook
// seeds (the pilot plan). Recomputes the component change from the readings (persist stores the COMPOSITE change).
export async function rebuildCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: RebuildCeremonyData; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadRebuildCeremonyKeepers(db, memberId),
    ]);
    let grinta: RebuildCeremonyData['grinta'] = null;
    if (latest && latest.strands.rebuild != null) {
      const now = latest.strands.rebuild; // the checkpoint's Control Ave2
      const baseline = base?.strands.rebuild ?? null; // Control Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return { ok: true, data: { grinta, keepers, badge: earnedBadgeReveal('rebuild') } };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The Playbook seeds revealed at the Rebuild ceremony — the member's pilot plan (their two small changes). Best-effort;
// missing keepers are simply skipped (graceful degrade → the empty-Playbook fallback copy).
async function loadRebuildCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const plan = (
      await db.query<{ body: string }>(
        `select body from playbook_entry where member_id=$1 and state='kept' and keeper_type='plan' order by created_at desc limit 1`,
        [memberId],
      )
    ).rows[0]?.body ?? null;
    return [plan].filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

// Per-turn save/resume (W-15 pattern, per Rebuild session). Keyed by (member, 'rebuild', session). Cleared on completion.
const beatBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

const rebuildArcFor = (session: RebuildSession): ArcConfig =>
  session === 'b2' ? REBUILD_B2_ARC : session === 'b3' ? REBUILD_B3_ARC : session === 'checkpoint' ? REBUILD_CHECKPOINT_ARC : REBUILD_B1_ARC;

async function persistRebuildArcSession(db: Db, memberId: string, session: RebuildSession, history: ConvMessage[], message: string, reply: string, turn: Turn): Promise<void> {
  try {
    if (turn.complete || turn.state.stage === 'ceremony') {
      await clearArcSession(db, memberId, 'rebuild', session);
      return;
    }
    const messages: ConvMessage[] = [...history, { role: 'member', text: message }, ...beatBubbles(reply)];
    await saveArcSession(db, memberId, 'rebuild', turn.state, messages, session);
  } catch {
    // swallow — resume is best-effort; the turn already succeeded for the member.
  }
}

export async function loadRebuildSessionAction(
  memberId: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; session?: { state: ConvState; messages: ConvMessage[]; expects?: Expectation }; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const saved = await loadArcSession(db, memberId, 'rebuild', session);
    if (!saved || saved.messages.length === 0) return { ok: true };
    const answered = saved.state.administeredResponses?.length ?? 0;
    const expects = scaleExpects(rebuildArcFor(session), saved.state.stage as never, false, answered);
    return { ok: true, session: { state: saved.state, messages: saved.messages, expects } };
  } catch {
    return { ok: false, error: 'Could not load your session.' };
  }
}

export async function rebuildTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string; earnedBadge?: { id: string; name: string } | null }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
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
    // B4 is ADMINISTERED (deterministic Likert parse) — no model call. On the checkpoint→ceremony crossing it scores
    // the Control component + persists the reading + lights Reclaim.
    if (session === 'checkpoint') {
      const turn = liveTurnRebuildCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistRebuildCheckpoint(db, memberId, state, turn);
      await persistRebuildArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // B3 is a LIVE coaching turn (COACH mode — the model coaches, the engine holds the completeness contract).
    if (session === 'b3') {
      const turn = await liveTurnRebuildB3(state, history, message);
      const db = (await getDb()) as unknown as Db;
      let b3Badge: { id: string; name: string } | null = null;
      if (turn.complete) {
        const activity = (turn.state.collected?.pilotActivity ?? '').trim();
        const diet = (turn.state.collected?.pilotDiet ?? '').trim();
        if (activity && diet) {
          // DURABLE first-class commitments (0060) — the real home for the two changes now, so they survive past the
          // pilot week and every surface reads one source. This replaces relying on the coaching_plan artifact (which
          // could vanish). Best-effort at the close so a write hiccup never blocks completion; the member can also set
          // them directly (the reliable path).
          try {
            await setCommitment(db, memberId, 'activity', activity, 'b3');
            await setCommitment(db, memberId, 'diet', diet, 'b3');
          } catch {
            /* swallow — best-effort at the close; the member can set/confirm them directly */
          }
          // Persist the plan artifact (coaching_plan) + a Playbook keeper (§5 — the two small changes, their words).
          try {
            const days = { activityDays: turn.state.collected?.pilotActivityDays, dietDays: turn.state.collected?.pilotDietDays };
            await persistCoachingPlan(db, memberId, 'rebuild', { activityChange: activity, dietChange: diet, ...days });
            // The week grid's ROWS (Greg's tracker). Separate try from the plan above, deliberately: a failure here
            // must not lose the plan itself. Same lesson as the Playbook harvest silent-drop, where one throw inside
            // a shared try aborted a commit that had already succeeded.
          } catch {
            /* swallow — best-effort; the member still committed their plan */
          }
          try {
            await setPilotCommitments(db, memberId, {
              activityChange: activity,
              dietChange: diet,
              activityDays: turn.state.collected?.pilotActivityDays,
              dietDays: turn.state.collected?.pilotDietDays,
            });
          } catch (e) {
            console.error(`B3: could not write practice commitments for member=${memberId}:`, e);
          }
          // harvestSignal commits the Lifestyle Pilot keeper even if the QI moment-emit fails (the prod silent-drop
          // that lost session keepers) — and logs on failure instead of swallowing blind.
          await harvestSignal(
            db,
            memberId,
            { kind: 'plan', ref: 'b3', keeperType: 'plan', destinationIntent: 'keeper', payloadRef: composePilotPlan(activity, diet), label: 'Your Lifestyle Pilot' },
            'rebuild',
          );
        }
        // Open the pilot logging week (Part B) — the plan-aware daily nudge rides the practice-week scaffold.
        try {
          await startPracticeWeek(db, memberId, 'b3_pilot');
        } catch {
          /* swallow — the logging nudge is a bonus, not load-bearing */
        }
        // Mark B3 closed so the v2.4 forecast advances the member B3 → B4 (best-effort).
        try {
          await markSessionClosed(db, memberId, 'RBLD-B3');
          // Earn the milestone (idempotent) but do NOT surface the badge beat here — B3 only SETS UP the pilot; the
          // "week of noticing" is celebrated in the Rebuild ceremony, so a beat at the close is a duplicate (Donna).
          await acknowledgeSessionBadge(db, memberId, 'RBLD-B3');
        } catch {
          /* swallow — the session still completed; the forecast advance is best-effort */
        }
      }
      await persistRebuildArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge: b3Badge };
    }
    // Both B1 and B2 are ADMINISTERED (deterministic Likert parse) — no model call needed.
    const turn = session === 'b2' ? liveTurnRebuildB2(state, history, message) : liveTurnRebuildB1(state, history, message);
    const db = (await getDb()) as unknown as Db;
    let earnedBadge: { id: string; name: string } | null = null;
    if (turn.complete) {
      const responses = turn.state.administeredResponses ?? [];
      if (session === 'b2') {
        // Score the 24 responses → the self-management profile → store it. Then open the skill-noticing practice week
        // (Part B). Both best-effort — a write hiccup never breaks the member's close.
        const r = responses.slice(0, SKILLS_ITEM_COUNT);
        if (r.length === SKILLS_ITEM_COUNT) {
          try {
            await persistSkillsReading(db, memberId, r);
          } catch (e) {
            // Swallowed so a write hiccup never breaks the member's close — but LOGGED. A silent swallow here is
            // invisible until a member reports a missing Read on the Playbook (Jay, 2026-08-08). The Playbook
            // harvest drop was this exact shape: a write that threw on prod-postgres ONLY, inside a bare catch.
            console.error(`B2 self-management reading FAILED to persist for member=${memberId}:`, (e as Error).message);
          }
        }
        try {
          await startPracticeWeek(db, memberId, 'b2_noticing');
        } catch {
          /* swallow — the noticing nudge is a bonus, not load-bearing */
        }
      } else {
        // B1: score the 12 responses → the SDT profile → store it (RB-1: stored, not displayed).
        const r = responses.slice(0, WHY_ITEM_COUNT);
        if (r.length === WHY_ITEM_COUNT) {
          try {
            await persistWhyReading(db, memberId, r);
          } catch (e) {
            // Logged, not silent — see the B2 note above. This register is what "your why" reads from.
            console.error(`B1 motivation reading FAILED to persist for member=${memberId}:`, (e as Error).message);
          }
        }
      }
      // Mark the Session closed so the v2.4 forecast advances the member (B1 → B2 → B3). Best-effort.
      try {
        const assetId = session === 'b2' ? 'RBLD-B2' : 'RBLD-B1';
        await markSessionClosed(db, memberId, assetId);
        earnedBadge = await acknowledgeSessionBadge(db, memberId, assetId); // newly-earned milestone → named at the close
      } catch {
        /* swallow — the session still completed; the forecast advance is best-effort */
      }
    }
    await persistRebuildArcSession(db, memberId, session, history, message, turn.reply, turn);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
