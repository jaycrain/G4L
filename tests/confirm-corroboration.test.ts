// "She already answered that."
//
// Jennifer's Reconnect walk (2026-08-05): the Companion reflected her Tuesday back to her, asked "is that the one
// worth chasing?", and she said "Perfectly depicted." It asked again. She said "Yes." It asked again — the SAME
// sentence, three times running.
//
// Two independent faults, both here:
//   1. resolveGapConfirm short-circuits on the model's replyIntent, so her words were never read. The model said
//      'more'; the engine obeyed. (Fifth instance of the model-guess-overrules-member pattern.)
//   2. The rotating "tell me more" variants index on how many agent lines contain a '?'. The reflect fallbacks have
//      none, so once one fires the counter freezes and the same variant returns forever.
//
// THE LINE THIS MUST NOT CROSS: the draw-out itself is untouched. These fire only after the model has already
// decided to reflect and has ASKED. Praise is an answer only when there was a question. So every test below has a
// mirror: the reply that must still keep drawing out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfirmCorroborated, resolveGapConfirm } from '../lib/agent/onboarding-intent.ts';
import { isKeeperMaterial } from '../lib/agent/reconnect.ts';

const resolve = (msg: string, intent?: 'done' | 'more' | 'dispute') =>
  resolveConfirmCorroborated(msg, intent, isKeeperMaterial);

test('A CONFIRM SHE GAVE IS NOT RE-ASKED, even when the model says "more"', () => {
  for (const answer of ['Perfectly depicted.', 'Yes.', "That's exactly it.", 'Spot on', 'Wow. Yes.']) {
    assert.equal(resolve(answer, 'more'), 'done', `"${answer}" answered the question we asked`);
  }
});

test('BUT A REPLY CARRYING REAL MATERIAL STILL DRAWS OUT', () => {
  // The whole risk of the fix is over-firing — swallowing a genuine addition because it opened with a "yes".
  for (const more of [
    "Yes, and also Sarah's in it somewhere. A walk, or just a text.",
    "That's it — though I think the mornings matter more than the lifting does.",
    'Right. And there was the thing with my brother that I have not mentioned.',
  ]) {
    assert.equal(resolve(more, 'more'), 'addition', `"${more}" adds something — keep drawing out`);
  }
});

test('A DISPUTE IS NEVER OVERRULED', () => {
  // Asymmetric on purpose: a member pushing back must always be heard, however thin the words.
  assert.equal(resolve('No.', 'dispute'), 'dispute');
  assert.equal(resolve('Not really.', 'dispute'), 'dispute');
  assert.equal(resolve("That's not it at all.", 'dispute'), 'dispute');
});

test('the gate only overrules "more" — a model "done" passes through untouched', () => {
  assert.equal(resolve('Yes.', 'done'), 'done');
  assert.equal(resolve("Yes, and Sarah's back in it somewhere too", 'done'), 'done');
});

test('with no model signal at all, behaviour is exactly as before', () => {
  for (const m of ['Perfectly depicted.', "Yes, and also Sarah's in it", 'No, that is different']) {
    assert.equal(resolve(m, undefined), resolveGapConfirm(m, undefined), `unchanged for "${m}"`);
  }
});

test('THE DRAW-OUT IS NOT SHORTENED — praise is an answer only because we asked', () => {
  // This resolver is reached only from a stage's confirm(), i.e. after the model reflected and posed the question.
  // The gather path never consults it, so mid-draw-out warmth still contributes nothing and the beat continues.
  // Guard the property that makes that safe: praise carries no material, so it can never be mistaken for depth.
  assert.equal(isKeeperMaterial('Perfectly depicted.'), false);
  assert.equal(isKeeperMaterial("Yes, and also Sarah's in it somewhere. A walk, or just a text."), true);
});
