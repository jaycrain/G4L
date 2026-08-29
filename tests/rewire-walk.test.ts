// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE WALK — REWIRE. Can a member get through every session in the phase?
//
// Third of the walk gates (onboarding → reconnect → here). The shape they all share: drive the engine the way the
// CLIENT does, answering only the surface it actually handed back, and assert the things that must never be false.
// Not copy, not turn counts, not how long a draw-out runs — those are meant to change.
//
// REWIRE IS FOUR SEPARATE SESSIONS, each with its own entry point, so this is a TABLE rather than one walk. That
// matters more than it looks: a bug in W3 is invisible to a test of W1, and until now nothing walked any of them
// end to end. The failures that reached members all week were "a required surface did not appear at its beat",
// and four unwalked sessions are four places that can happen unseen.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRewireTurn, rewireOpening,
  applyRewireW2Turn, rewireW2Opening,
  applyRewireW3Turn, rewireW3Opening,
  applyRewireCheckpointTurn, rewireCheckpointOpening,
} from '../lib/agent/rewire.ts';
import { claimsGateOutcome } from '../lib/agent/gate-claims.ts';
import { walkSession, instrumentRunIsWhole, type SessionApply } from './walk-driver.ts';
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
  { id: 'W1 · the domains',    apply: applyRewireTurn,           opening: () => rewireOpening(COMMITTED) },
  { id: 'W2 · the anchor',     apply: applyRewireW2Turn,         opening: () => rewireW2Opening(COMMITTED) },
  { id: 'W3 · the true line',  apply: applyRewireW3Turn,         opening: () => rewireW3Opening(null) },
  { id: 'W-checkpoint',        apply: applyRewireCheckpointTurn, opening: () => rewireCheckpointOpening() },
];

for (const s of SESSIONS) {
  test(`REWIRE ${s.id} — she can actually get to the end of it`, () => {
    // The strongest assertion here, and the one I first left out: a session she cannot finish is the worst failure
    // this phase has, and it is invisible to every unit test of the functions inside it. `finished` means the
    // engine ended the session on its own terms — not that the driver ran out of turns.
    const { finished, turns } = walkSession(s.apply, s.opening(), cooperative);
    assert.ok(turns.length > 1, `${s.id}: the session did not run at all`);
    assert.ok(finished, `${s.id}: the member could not reach the end — the session never completed`);
  });

  test(`REWIRE ${s.id} — the Companion is never silent`, () => {
    // A model turn that records something and writes no prose shipped an EMPTY reply in onboarding: a blank bubble
    // and a conversation that has visibly stopped, with nothing for her to do but talk into the silence.
    const mute = (state: ConvState) => ({ ...cooperative(state), text: '' });
    for (const model of [cooperative, mute]) {
      for (const turn of walkSession(s.apply, s.opening(), model).turns) {
        assert.ok(turn.reply.trim().length > 0, `${s.id}: a turn shipped an empty reply at stage "${turn.state.stage}"`);
      }
    }
  });

  test(`REWIRE ${s.id} — no turn claims the work is done before it is`, () => {
    for (const turn of walkSession(s.apply, s.opening(), cooperative).turns) {
      if (turn.complete) continue;
      assert.equal(
        claimsGateOutcome(turn.reply),
        false,
        `${s.id}: a mid-session turn claimed an outcome — "${turn.reply.slice(0, 70)}"`,
      );
    }
  });

  test(`REWIRE ${s.id} — any instrument it administers arrives whole and in order`, () => {
    // Frozen instruments are a data contract. A session that renders the scale but drops or repeats an item would
    // pass a coverage check while writing a wrong number to her dashboard. Grouped per stage on purpose: a flat
    // count conflates two instruments in the same phase, which is how the first Reconnect gate read 30-for-24.
    const { scaleByStage } = walkSession(s.apply, s.opening(), cooperative);
    // ACROSS STAGES, not per stage. An instrument may be administered in halves — B1 delivers six items either
    // side of Greg's eating elicitation — so "starts at item 1" is a property of the SESSION, and "contiguous,
    // nothing skipped or repeated" is the property of each stage. instrumentRunIsWhole holds both.
    const broken = instrumentRunIsWhole(scaleByStage);
    assert.equal(broken, null, `${s.id}: ${broken}`);
    for (const [stage, items] of Object.entries(scaleByStage)) {
      assert.ok(items.length > 0, `${s.id}: "${stage}" expected a scale but delivered nothing`);
      assert.ok(new Set(items).size === items.length, `${s.id}: an item at "${stage}" was asked twice`);
    }
  });
}

test('REWIRE — a model that runs ahead cannot strand her in a session', () => {
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
