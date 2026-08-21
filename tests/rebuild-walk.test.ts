// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE WALK — REBUILD. Can a member get through every session in the phase?
//
// Third of the walk gates (onboarding → reconnect → here). The shape they all share: drive the engine the way the
// CLIENT does, answering only the surface it actually handed back, and assert the things that must never be false.
// Not copy, not turn counts, not how long a draw-out runs — those are meant to change.
//
// REBUILD IS FOUR SEPARATE SESSIONS, each with its own entry point, so this is a TABLE rather than one walk. Note
// that most of them are DETERMINISTIC — they take no model at all — which makes it tempting to assume they cannot
// break the way a conversational beat does. They can: "she cannot reach the end" and "a turn shipped no words"
// are engine failures, and neither needs a model to go wrong.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRebuildB1Turn, rebuildB1Opening,
  applyRebuildB2Turn, rebuildB2Opening,
  applyRebuildB3Turn, rebuildB3Opening,
  applyRebuildCheckpointTurn, rebuildCheckpointOpening,
} from '../lib/agent/rebuild.ts';
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
  { id: 'B1 · the why',     apply: applyRebuildB1Turn,         opening: () => rebuildB1Opening() },
  { id: 'B2 · the skills',  apply: applyRebuildB2Turn,         opening: () => rebuildB2Opening() },
  { id: 'B3 · the pilot',   apply: applyRebuildB3Turn,         opening: () => rebuildB3Opening() },
  { id: 'B-checkpoint',     apply: applyRebuildCheckpointTurn, opening: () => rebuildCheckpointOpening() },
];

for (const s of SESSIONS) {
  test(`REBUILD ${s.id} — she can actually get to the end of it`, () => {
    // The strongest assertion here, and the one I first left out: a session she cannot finish is the worst failure
    // this phase has, and it is invisible to every unit test of the functions inside it. `finished` means the
    // engine ended the session on its own terms — not that the driver ran out of turns.
    const { finished, turns } = walkSession(s.apply, s.opening(), cooperative);
    assert.ok(turns.length > 1, `${s.id}: the session did not run at all`);
    assert.ok(finished, `${s.id}: the member could not reach the end — the session never completed`);
  });

  test(`REBUILD ${s.id} — the Companion is never silent`, () => {
    // A model turn that records something and writes no prose shipped an EMPTY reply in onboarding: a blank bubble
    // and a conversation that has visibly stopped, with nothing for her to do but talk into the silence.
    const mute = (state: ConvState) => ({ ...cooperative(state), text: '' });
    for (const model of [cooperative, mute]) {
      for (const turn of walkSession(s.apply, s.opening(), model).turns) {
        assert.ok(turn.reply.trim().length > 0, `${s.id}: a turn shipped an empty reply at stage "${turn.state.stage}"`);
      }
    }
  });

  test(`REBUILD ${s.id} — no turn claims the work is done before it is`, () => {
    for (const turn of walkSession(s.apply, s.opening(), cooperative).turns) {
      if (turn.complete) continue;
      assert.equal(
        claimsGateOutcome(turn.reply),
        false,
        `${s.id}: a mid-session turn claimed an outcome — "${turn.reply.slice(0, 70)}"`,
      );
    }
  });

  test(`REBUILD ${s.id} — any instrument it administers arrives whole and in order`, () => {
    // Frozen instruments are a data contract. A session that renders the scale but drops or repeats an item would
    // pass a coverage check while writing a wrong number to her dashboard. Grouped per stage on purpose: a flat
    // count conflates two instruments in the same phase, which is how the first Reconnect gate read 30-for-24.
    const { scaleByStage } = walkSession(s.apply, s.opening(), cooperative);
    for (const [stage, items] of Object.entries(scaleByStage)) {
      assert.ok(
        isCompleteInOrder(items, items.length),
        `${s.id}: the instrument at "${stage}" was not delivered in order — [${items.join(',')}]`,
      );
      assert.ok(new Set(items).size === items.length, `${s.id}: an item at "${stage}" was asked twice`);
    }
  });
}

test('REBUILD — a model that runs ahead cannot strand her in a session', () => {
  // Donna's failure, generalised: the model behaving as though it is further along than the engine, then
  // apologising and doing it again. The engine referees; the model does not get to decide the beat is over.
  const runsAhead = (state: ConvState): ModelTurn => ({
    ...cooperative(state),
    text: 'That’s your true line. It lives on your dashboard now. That’s plenty for today.',
  });
  for (const s of SESSIONS) {
    const { turns, state } = walkSession(s.apply, s.opening(), runsAhead);
    assert.ok(turns.length > 1, `${s.id}: the session must actually run`);
    assert.ok(
      turns.some((t) => t.complete) || state.stage !== s.opening().state.stage,
      `${s.id}: a run-ahead model left the session stuck on its opening beat`,
    );
  }
});
