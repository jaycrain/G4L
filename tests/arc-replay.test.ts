import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import { replayArc, maxQuestionsInAReply, completed, hasRepeatedReply, type ScriptTurn } from './arc-replay.ts';

// Phase 0 proof-of-life: the reusable harness replays a real arc walk through the pure kernel (runArcTurn via
// applyRewireTurn), threads state, and the detectors characterize it. No behavior change — this is the safety net the
// contracts (Phase 1+) get asserted on, and where Donna's bugs land as fixtures.

const FIVE_LIES = ["it's just age", 'the drink helps me unwind', 'no room for me', "I'm not that person", 'too late to start'];
const LAST_BEAT =
  'That last one is heavy, and you said it plainly. Look at all five — each keeps you where you are: the campaign. ' +
  'What’s the honest line you’d put in place of “it’s too late”?';

// A clean W1 walk: five domains (model beats), then a true line, then close.
const W1_WALK: ScriptTurn[] = [
  ...FIVE_LIES.map((lie, i) => ({ member: lie, model: { text: i === FIVE_LIES.length - 1 ? LAST_BEAT : 'That’s the story.' } })),
  { member: 'My body responds to what I ask of it — at any age', model: { text: 'Kept. Any others?' } },
  { member: "that's it", model: { text: 'ok' } },
];

test('arc-replay harness: replays a real W1 walk through the pure kernel + threads state', () => {
  const r = replayArc(applyRewireTurn, rewireOpening(), W1_WALK);
  assert.equal(r.steps.length, W1_WALK.length, 'one step per scripted turn');
  assert.ok(r.opening.reply.length > 0, 'opening rendered');
  // The arc actually advanced through it: it harvested the true line and reached completion on close.
  const harvested = r.steps.some((s) => (s.state.pendingHarvest ?? []).some((h) => h.label === 'Your true line'));
  assert.ok(harvested, 'the true line was harvested during replay');
  assert.ok(completed(r), 'a clean walk reaches completion');
});

test('arc-replay detectors: characterize the walk (question load, loops)', () => {
  const r = replayArc(applyRewireTurn, rewireOpening(), W1_WALK);
  // Phase 0 only MEASURES — these are the signals the contracts will later assert. A clean walk shouldn't loop.
  assert.equal(hasRepeatedReply(r), false, 'a clean walk does not repeat a prior reply verbatim');
  assert.ok(typeof maxQuestionsInAReply(r) === 'number', 'question-load detector runs');
});
