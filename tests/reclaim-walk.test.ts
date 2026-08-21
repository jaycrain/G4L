// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE WALK — RECLAIM. Can a member get through every session in the phase?
//
// Third of the walk gates (onboarding → reconnect → here). The shape they all share: drive the engine the way the
// CLIENT does, answering only the surface it actually handed back, and assert the things that must never be false.
// Not copy, not turn counts, not how long a draw-out runs — those are meant to change.
//
// RECLAIM IS FOUR SEPARATE SESSIONS, each with its own entry point, so this is a TABLE rather than one walk.
// Reclaim was flipped live "as is" and is known-rough — the W-28 entry/exit and the Loop questions are still open
// with Jay and Greg. That is precisely why it wants a gate: rough is a reason to know when it breaks, not a reason
// to leave it unwatched. This asserts only what must be true however those open questions land.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReclaimC1Turn, reclaimC1Opening,
  applyReclaimC2Turn, reclaimC2Opening,
  applyReclaimC3Turn, reclaimC3Opening,
  applyReclaimCheckpointTurn, reclaimCheckpointOpening,
} from '../lib/agent/reclaim.ts';
import { claimsGateOutcome } from '../lib/agent/gate-claims.ts';
import { walkSession, isCompleteInOrder, type SessionApply } from './walk-driver.ts';
import type { ConvState, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

const COMMITTED = {
  identityNoun: 'Maker',
  gap: 'I lost my job two years ago and the whole shape of my week went with it.',
  doors: ['career_cliff' as const],
  reclaimList: ['get my strength back', 'a creative job', 'peace at home'],
};

/** A cooperative model: gives prose every turn and signals each beat drawn out when the engine looks for it. */
const cooperative = (state: ConvState): ModelTurn => ({
  text: 'Say more about that.',
  replyIntent: 'done' as const,
  ...(state.stage === 'domains' ? { depthReady: true } : {}),
  ...(state.stage === 'anchor' || state.stage === 'image' ? { depthReady: true } : {}),
});

const SESSIONS: { id: string; apply: SessionApply; opening: () => Turn }[] = [
  { id: 'C1 · the refine',  apply: applyReclaimC1Turn,         opening: () => reclaimC1Opening(COMMITTED.reclaimList) },
  { id: 'C2 · the audit',   apply: applyReclaimC2Turn,         opening: () => reclaimC2Opening() },
  { id: 'C3 · quality days',apply: applyReclaimC3Turn,         opening: () => reclaimC3Opening() },
  { id: 'C-checkpoint',     apply: applyReclaimCheckpointTurn, opening: () => reclaimCheckpointOpening() },
];

// SESSIONS THIS DRIVER CANNOT YET FINISH, named rather than quietly skipped.
//
// C1, C2 and C3 run the COACH gate (propose → confirm → commit), which needs answers shaped to whatever it just
// proposed. The generic driver types substantive prose and plain affirmations, and neither satisfies that gate —
// all three run to the turn cap.
//
// THIS IS A LIMIT OF THE HARNESS, NOT A BUG IN THE PHASE — and that is now known rather than assumed. Donna
// walked all three the same evening (2026-08-21 00:22Z, reclaim_checkpoint_passed), and C2 wrote a complete
// Bigger World Audit: twenty items, computed priorities, her reflections in her own words. The sessions finish.
//
// Recorded here because the previous version of this comment said the answer was unknown, and a comment that
// keeps claiming uncertainty after the uncertainty is resolved is the same failure as context that claims what it
// stopped tracking — it sends the next reader to re-derive something already settled.
//
// So they are excluded from the completion check ONLY, still walked for every other invariant. Making the driver
// coach-gate-aware is still worth doing: it would turn "a member got through once" into a standing guarantee.
const CANNOT_DRIVE_TO_END = new Set(['C1 · the refine', 'C2 · the audit', 'C3 · quality days']);

for (const s of SESSIONS) {
  test(`RECLAIM ${s.id} — she can actually get to the end of it`, { skip: CANNOT_DRIVE_TO_END.has(s.id) && 'driver cannot yet answer the coach gate — see CANNOT_DRIVE_TO_END' }, () => {
    // The strongest assertion here: a session she cannot finish is the worst failure a phase has, and it is
    // invisible to every unit test of the functions inside it. `finished` means the engine ended the session on
    // its own terms — not that the driver ran out of turns.
    const { finished, turns } = walkSession(s.apply, s.opening(), cooperative);
    assert.ok(turns.length > 1, `${s.id}: the session did not run at all`);
    assert.ok(finished, `${s.id}: the member could not reach the end — the session never completed`);
  });

  test(`RECLAIM ${s.id} — the Companion is never silent`, () => {
    // A model turn that records something and writes no prose shipped an EMPTY reply in onboarding: a blank bubble
    // and a conversation that has visibly stopped, with nothing for her to do but talk into the silence.
    const mute = (state: ConvState) => ({ ...cooperative(state), text: '' });
    for (const model of [cooperative, mute]) {
      for (const turn of walkSession(s.apply, s.opening(), model).turns) {
        assert.ok(turn.reply.trim().length > 0, `${s.id}: a turn shipped an empty reply at stage "${turn.state.stage}"`);
      }
    }
  });

  test(`RECLAIM ${s.id} — no turn claims the work is done before it is`, () => {
    for (const turn of walkSession(s.apply, s.opening(), cooperative).turns) {
      if (turn.complete) continue;
      assert.equal(
        claimsGateOutcome(turn.reply),
        false,
        `${s.id}: a mid-session turn claimed an outcome — "${turn.reply.slice(0, 70)}"`,
      );
    }
  });

  test(`RECLAIM ${s.id} — any instrument it administers arrives whole and in order`, () => {
    // Frozen instruments are a data contract. A session that renders the scale but drops or repeats an item would
    // pass a coverage check while writing a wrong number to her dashboard. Grouped per stage on purpose: a flat
    // count conflates two instruments in the same phase, which is how the first Reconnect gate read 30-for-24.
    // C2's audit numbers its items GLOBALLY across eight sub-stages (audit-physical, audit-b-physical, …), so a
    // per-stage "must start at 1" reads [3,4,5] as a broken instrument when it is item 3, 4 and 5 of twenty. The
    // contract is over the WHOLE session: every item exactly once, ascending, none skipped or repeated.
    const { scaleByStage } = walkSession(s.apply, s.opening(), cooperative);
    const all = Object.values(scaleByStage).flat().sort((a, b) => a - b);
    if (all.length) {
      assert.ok(isCompleteInOrder(all, all.length), `${s.id}: the instrument was not delivered whole — [${all.join(',')}]`);
      const asked = Object.values(scaleByStage).flat();
      assert.equal(new Set(asked).size, asked.length, `${s.id}: an item was asked twice`);
    }
  });
}

test('RECLAIM — a model that runs ahead cannot strand her in a session', () => {
  // Donna's failure, generalised: the model behaving as though it is further along than the engine, then
  // apologising and doing it again. The engine referees; the model does not get to decide the beat is over.
  const runsAhead = (state: ConvState): ModelTurn => ({
    ...cooperative(state),
    text: 'That’s your true line. It lives on your dashboard now. That’s plenty for today.',
  });
  for (const s of SESSIONS) {
    // Same honesty as above: a session the driver cannot carry past its coach gate cannot be asked to prove it
    // advances. It is still walked, and still held to "never silent / never claims early" below.
    if (CANNOT_DRIVE_TO_END.has(s.id)) continue;
    const { turns, state } = walkSession(s.apply, s.opening(), runsAhead);
    assert.ok(turns.length > 1, `${s.id}: the session must actually run`);
    assert.ok(
      turns.some((t) => t.complete) || state.stage !== s.opening().state.stage,
      `${s.id}: a run-ahead model left the session stuck on its opening beat`,
    );
  }
});
