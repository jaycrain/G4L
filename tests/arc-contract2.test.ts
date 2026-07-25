import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawoutShouldReflect } from '../lib/agent/onboarding-staged.ts';
import { memberWantsToAdvance } from '../lib/agent/onboarding-intent.ts';

// Contract 2 — advance (docs/arc-reliability-hardening.md, Phase 2, slice A: the loop-guard). A draw-out stage must
// honor the member's "move on" (the Independence Guarantee) and advance rather than re-pose — never loop (#3 window).

test('memberWantsToAdvance: catches move-on / done, ignores real drawing-out', () => {
  for (const yes of ['move on', 'let’s move on', "that's it", 'we already did this, move on', "I'm done", 'keep going']) {
    assert.equal(memberWantsToAdvance(yes), true, yes);
  }
  // must NOT fire on genuine drawing-out content — that's the flattening guardrail
  assert.equal(memberWantsToAdvance('I woke up with a song in my head, tons of energy'), false);
  assert.equal(memberWantsToAdvance('the promotion falling through — that hollowed me out'), false);
});

test('drawoutShouldReflect: a move-on signal advances immediately; without it, engaged drawing-out keeps going', () => {
  // #3 fix: member wants to move → advance NOW, regardless of depth/model (never loop for another Tuesday).
  assert.equal(drawoutShouldReflect('And another Tuesday a year out?', false, 1, 2, 4, true), true);
  // no move-on, model still probing below the floor → keep drawing out (unchanged behavior, no premature advance).
  assert.equal(drawoutShouldReflect('What else do you notice about that morning?', false, 1, 2, 4, false), false);
  // the existing advance paths are untouched: model's depth signal at/above the floor still advances.
  assert.equal(drawoutShouldReflect('You saw it plainly.', true, 2, 2, 4, false), true);
  // and the hard cap still advances so nothing can trap the member even without a move-on phrase.
  assert.equal(drawoutShouldReflect('And more?', false, 4, 2, 4, false), true);
});
