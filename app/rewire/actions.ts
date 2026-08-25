'use server';

import { getDb } from '../../lib/db/index.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Expectation, Turn } from '../../lib/agent/onboarding.ts';
import {
  rewireEnabled,
  rewireOpening,
  liveTurnRewire,
  rewireW2Opening,
  liveTurnRewireW2,
  rewireW3Opening,
  liveTurnRewireW3,
  rewireCheckpointOpening,
  liveTurnRewireCheckpoint,
  REWIRE_ARC,
  REWIRE_W2_ARC,
  REWIRE_W3_ARC,
  REWIRE_CHECKPOINT_ARC,
  type W3Callback,
} from '../../lib/agent/rewire.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';
import { expectsForState, type ArcConfig } from '../../lib/agent/onboarding-staged.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../../lib/agent/arc-session.ts';
import { loadReconnectCaptures } from '../../lib/agent/reconnect.ts';
import { drainHarvest, type KeeperProposal } from '../../lib/agent/harvest.ts';
import { startPracticeWeek, latestImageKeeper } from '../../lib/practice/store.ts';
import { saveW3Triggers } from '../../lib/rewire/w3-triggers.ts';
import { saveW3Moves, saveW3CheckInCue } from '../../lib/rewire/w3-moves.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, commitmentCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_COMMITMENT_ITEMS, CHECKPOINT_COMMITMENT_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed, markCheckpointClosed } from '../../lib/curriculum/store.ts';
import { acknowledgeSessionBadge } from '../../lib/curriculum/view.ts';
import type { RewireCeremonyData } from '../../lib/ceremony/rewire-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';
import { carryForward, describeCarryForward } from '../../lib/curriculum/retention.ts';

// Which Rewire session — W1/W2/W3 (the three Sessions) or the R4 'checkpoint' (the administered Commitment read →
// ceremony). All ride the same flag + surface; W2 reads the Reclaim List, W3 pulls W1/W2 keepers forward, the
// checkpoint scores the Commitment component + lights Rebuild.
export type RewireSession = 'w1' | 'w2' | 'w3' | 'checkpoint';

// The member's W1 true lines (principle keepers) — pulled forward at the W3 Reframe. Graceful degrade to [] if none.
async function loadTrueLines(db: Db, memberId: string): Promise<string[]> {
  try {
    return (
      await db.query<{ body: string }>(
        `select body from playbook_entry where member_id=$1 and state='kept' and keeper_type='principle' order by created_at`,
        [memberId],
      )
    ).rows.map((r) => r.body);
  } catch {
    return [];
  }
}

// v2.3 Rewire server actions (W1 · the Disinformation Audit). Flag-gated (REWIRE). Conversation state is held
// client-side for the walk; the true lines the member writes are harvested to the Playbook (default-emit,
// member-owned) as they land. W1 reads the committed captures (gap + Reclaim List) to SEED the true-line work from
// the member's own prior honest lines (W-40) — never introduce the true line cold.

export async function startRewireAction(
  memberId: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'w2') {
    // W2 opens on the Reclaim List (the callback seam) — read the committed captures; graceful degrade if null/thin.
    const db = (await getDb()) as unknown as Db;
    const committed = await loadReconnectCaptures(db, memberId);
    const turn = rewireW2Opening(committed);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  if (session === 'w3') {
    // W3 pulls the prior tools FORWARD — the W1 true lines + the W2 image — plus grounding. Graceful degrade to [].
    const db = (await getDb()) as unknown as Db;
    const [committed, trueLines, image] = await Promise.all([
      loadReconnectCaptures(db, memberId),
      loadTrueLines(db, memberId),
      latestImageKeeper(db, memberId).catch(() => null),
    ]);
    const cb: W3Callback = {
      trueLines,
      image: image ?? undefined,
      reclaimList: committed?.reclaimList ?? [],
      identityNoun: committed?.identityNoun,
    };
    const turn = rewireW3Opening(cb);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  if (session === 'checkpoint') {
    const turn = rewireCheckpointOpening();
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  // W1 (W-40): seed the true-line work from the member's own prior honest lines — load their gap story + Reclaim List.
  const db = (await getDb()) as unknown as Db;
  const committed = await loadReconnectCaptures(db, memberId);
  const turn = rewireOpening(committed);
  return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
}

// R4 — score the Commitment component (Ave1→Ave2) + persist the Checkpoint grinta_reading + light Rebuild. Fires once,
// on the checkpoint→ceremony crossing. Best-effort (a write hiccup never breaks the ceremony). Component change is
// recomputed at the ceremony from the readings; here we persist the reading + set the gate.
async function persistRewireCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const commitment = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_COMMITMENT_ITEMS.length);
    if (commitment.length < CHECKPOINT_COMMITMENT_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_COMMITMENT_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (reconnect may have moved at §2e); fall back to the baseline.
    const carried = { reconnect: latest?.strands.reconnect ?? base?.strands.reconnect, rebuild: latest?.strands.rebuild ?? base?.strands.rebuild, reclaim: latest?.strands.reclaim ?? base?.strands.reclaim };
    const cp = scoreCheckpointStrand({ target: 'rewire', baselineValues, newValues: commitment, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: commitmentCheckpointResponsesMap(commitment), score: cp.score });
    // → activePhaseIndex 2 (Rebuild is now "You're here"). Records the completion + crosses ONCE (markCheckpointClosed).
    await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });
    await maybeTriggerDraft(db, memberId, { kind: 'milestone', assetCode: 'RWR-CHK', assetName: 'The Rewire Checkpoint' });
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The R4 ceremony reveal data: the Commitment COMPONENT move (Ave1→Ave2, foregrounded) + the composite (background) +
// the three tools (keepers). Recomputes the component change from the readings (persist stores the COMPOSITE change).
export async function rewireCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: RewireCeremonyData; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadCeremonyKeepers(db, memberId),
    ]);
    let grinta: RewireCeremonyData['grinta'] = null;
    if (latest && latest.strands.rewire != null) {
      const now = latest.strands.rewire; // the checkpoint's Commitment Ave2
      const baseline = base?.strands.rewire ?? null; // Commitment Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return { ok: true, data: { grinta, keepers, badge: earnedBadgeReveal('rewire') } };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The three tools revealed together — the W1 true line (principle), the W2 image (lights_you_up), the W3 protocol
// (recovery_move), in a stable reveal order. Best-effort; missing ones are simply skipped (graceful degrade).
async function loadCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const pick = async (type: string) =>
      (await db.query<{ body: string }>(`select body from playbook_entry where member_id=$1 and state='kept' and keeper_type=$2 order by created_at desc limit 1`, [memberId, type])).rows[0]?.body ?? null;
    const [line, image, protocol] = await Promise.all([pick('principle'), pick('lights_you_up'), pick('recovery_move')]);
    return [line, image, protocol].filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

// Drain the NEW harvest signals this turn (the true lines) → a member_event moment + an OFFER the member can keep.
// Nothing reaches the Playbook here: she decides inline (Jay, 2026-08-19). Best-effort — a harvest hiccup never
// fails the conversation turn, and losing an offer costs one line, never her words.
async function rewireHarvestOffers(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<KeeperProposal[]> {
  try {
    return await drainHarvest(db, memberId, prev, turn.state, 'rewire');
  } catch (e) {
    console.error(`[rewire] harvest drain failed for member=${memberId}:`, e);
    return [];
  }
}

// Per-turn save/resume (the same W-15 pattern Reconnect uses, now per Rewire session). Keyed by (member, 'rewire', session)
// so a refresh mid-W1 resumes W1 exactly, not W2. Cleared once the session completes — its keepers/scores persist on
// their own. Best-effort: a save hiccup never breaks the member's turn.
const beatBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

const rewireArcFor = (session: RewireSession): ArcConfig =>
  session === 'w2' ? REWIRE_W2_ARC : session === 'w3' ? REWIRE_W3_ARC : session === 'checkpoint' ? REWIRE_CHECKPOINT_ARC : REWIRE_ARC;

async function persistRewireArcSession(db: Db, memberId: string, session: RewireSession, history: ConvMessage[], message: string, reply: string, turn: Turn): Promise<void> {
  try {
    if (turn.complete || turn.state.stage === 'ceremony') {
      await clearArcSession(db, memberId, 'rewire', session); // completed — the keepers/scores persist on their own
      return;
    }
    const messages: ConvMessage[] = [...history, { role: 'member', text: message }, ...beatBubbles(reply)];
    await saveArcSession(db, memberId, 'rewire', turn.state, messages, session);
  } catch {
    // swallow — resume is best-effort; the turn already succeeded for the member.
  }
}

// Resume the in-flight Rewire session on mount (or null). Recomputes the scale chips from the resumed stage so a refresh
// mid-checkpoint restores the chip row on the right item.
export async function loadRewireSessionAction(
  memberId: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; session?: { state: ConvState; messages: ConvMessage[]; expects?: Expectation }; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const saved = await loadArcSession(db, memberId, 'rewire', session);
    if (!saved || saved.messages.length === 0) return { ok: true }; // nothing to resume → the client starts fresh
    const answered = saved.state.administeredResponses?.length ?? 0;
    const expects = expectsForState(rewireArcFor(session), saved.state, answered);
    return { ok: true, session: { state: saved.state, messages: saved.messages, expects } };
  } catch {
    return { ok: false, error: 'Could not load your session.' };
  }
}

export async function rewireTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string; earnedBadge?: { id: string; name: string } | null; proposals?: KeeperProposal[] }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
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
    // The R4 checkpoint is ADMINISTERED (deterministic Likert parse) — no model call. On the checkpoint→ceremony
    // crossing it scores the Commitment component + persists the reading + lights Rebuild.
    if (session === 'checkpoint') {
      const turn = liveTurnRewireCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistRewireCheckpoint(db, memberId, state, turn);
      await persistRewireArcSession(db, memberId, session, history, message, turn.reply, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    const db = (await getDb()) as unknown as Db;
    // CARRY-FORWARD (lib/curriculum/retention.ts) — each Rewire Session loads what came before it, per its own
    // Engineering Memo's `load prior module context` line: W1 loads Reconnect, W2 adds W1, W3 adds W2. Resolved
    // here at the boundary so the engines stay pure. Guarded: losing it costs the connective tissue, not the turn.
    const carried = describeCarryForward(await carryForward(db, memberId, session).catch(() => []));
    // Every session turn is a live model turn — the model supplies the reflection; the kernel sequences + harvests.
    const turn =
      session === 'w3'
        ? await liveTurnRewireW3(state, history, message, carried)
        : session === 'w2'
          ? await liveTurnRewireW2(state, history, message, carried)
          : await liveTurnRewire(state, history, message, carried);
    const proposals = await rewireHarvestOffers(db, memberId, state, turn); // true lines / image / protocol → OFFERS
    // On completion: (1) mark the Session CLOSED so the curriculum forecast advances the member W1→W2→W3→Checkpoint
    // (the v2.3 conversational sessions complete via the kernel, not the step player); (2) open the practice week
    // (Decision MM R4). Both best-effort — a hiccup never fails the conversation turn.
    let earnedBadge: { id: string; name: string } | null = null;
    if (turn.complete) {
      const assetId = session === 'w1' ? 'RWR-W1' : session === 'w2' ? 'RWR-W2' : session === 'w3' ? 'RWR-W3' : null;
      if (assetId) {
        try {
          await markSessionClosed(db, memberId, assetId);
          earnedBadge = await acknowledgeSessionBadge(db, memberId, assetId); // newly-earned milestone → the Companion names it at the close
        } catch {
          /* swallow — the session still completed for the member; the forecast advance is best-effort */
        }
      }
      if (session === 'w2' || session === 'w3') {
        try {
          await startPracticeWeek(db, memberId, session === 'w3' ? 'w3_logging' : 'w2_image');
        } catch {
          /* swallow — the session still completed; the nudge is a bonus, not load-bearing */
        }
      }
      // W3's triggers become the ROWS of the monitoring week (lib/rewire/w3-triggers.ts). They already survive as
      // prose inside the recovery_move keeper, which is right for recall and useless as a picker — and Greg's
      // tracker needs "which named trigger" as a choosable list. Their own words, verbatim; the system never
      // supplies or rewords a trigger. SEPARATE try from the week above: a failure here must not cost the member
      // their practice week, and vice versa (the harvest silent-drop taught us to stop sharing a swallowed try).
      if (session === 'w3') {
        try {
          const named = (turn.state?.collected?.w3Triggers ?? []) as string[];
          const n = await saveW3Triggers(db, memberId, named);
          if (named.length && !n) console.error(`w3 triggers: member=${memberId} named ${named.length}, saved 0`);
        } catch (e) {
          console.error(`w3 triggers persist failed for member=${memberId}:`, e);
        }
        // HER THREE MOVES BECOME THE WEEK'S ROWS (2026-08-22). Saved beside the triggers, in the same best-effort
        // shape and for the same reason — a throw here must never cost her the session she just finished — and in
        // its OWN try, so a trigger failure cannot take the moves down with it.
        try {
          const c = (turn.state?.collected ?? {}) as { w3Redirect?: string; w3Reframe?: string; w3Image?: string };
          // HER CUE BECOMES THE WEEK'S FIRST ROW (Greg's Stage 4, built 2026-08-22). Absent when she skipped the
          // question — the row simply does not render, rather than reappearing as a generic label.
          const cue = (turn.state?.collected as { w3CheckInCue?: string })?.w3CheckInCue;
          if (cue) await saveW3CheckInCue(db, memberId, cue);
          const saved = await saveW3Moves(db, memberId, {
            redirect: c.w3Redirect ?? null,
            reframe: c.w3Reframe ?? null,
            // Restart's words are her W2 IMAGE — the scene Greg's Restart sends her back to.
            restart: c.w3Image ?? null,
          });
          if (!saved) console.error(`w3 moves: member=${memberId} saved 0 of 3`);
        } catch (e) {
          console.error(`w3 moves persist failed for member=${memberId}:`, e);
        }
      }
    }
    await persistRewireArcSession(db, memberId, session, history, message, turn.reply, turn); // save transcript for resume (or clear on completion)
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge, proposals };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
