// THE CHIPS ARE INVITED ONCE, NOT TWICE.
//
// From Marion's live persona walk, 2026-09-01. At the identity beat she was handed this:
//
//   "…That's why the arguing worked. It came from someone certain, who they trusted to tell them the truth.
//    Let me offer you a few words for that version of you. Tap one, or write your own — it's a handle, not a
//    verdict, and we can change it."
//   "Here are a few words for who that was — tap the one that fits, or write your own. It's a handle to hold
//    onto, not a label set in stone, and we can change it anytime."
//
// The model's preview of the affordance, then the engine's authored version of the same sentence. Two voices,
// one instruction, at the moment a member is deciding whether to name themselves — which is the moment the
// product can least afford to sound like a machine.
//
// receiptOnly could not catch it: it cuts at the first QUESTION in the last paragraph, and this invite is an
// imperative. Right contract, wrong shape. dropPickInvite covers the imperative at this one seam.
//
// WHAT THESE TESTS ARE REALLY GUARDING: that the cut takes the INVITE and leaves the REFLECTION. The reflection
// is the part that is about the member and the part we would most damage by over-cutting — so the fixture below
// is Marion's real turn, not a tidy one, and the assertion is that her sentence survives intact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropPickInvite, receiveThen } from '../lib/agent/onboarding-staged.ts';

const MARION_TURN =
  'Straight with them. No flattery. When you said something mattered, they believed you — because you’d never ' +
  'sold them anything before. That’s why the arguing worked. It came from someone certain, who they trusted to ' +
  'tell them the truth.\n\nLet me offer you a few words for that version of you. Tap one, or write your own — ' +
  'it’s a handle, not a verdict, and we can change it.';

test('the model’s preview of the chips is dropped', () => {
  const out = dropPickInvite(MARION_TURN);
  assert.ok(!/tap one/i.test(out), 'the model’s "Tap one" invite should be gone');
  assert.ok(!/write your own/i.test(out), 'the model’s "write your own" invite should be gone');
});

test('the reflection survives intact — we cut the invite, never the member’s moment', () => {
  const out = dropPickInvite(MARION_TURN);
  assert.ok(out.includes('That’s why the arguing worked.'), 'her reflection must survive');
  assert.ok(out.includes('they trusted to tell them the truth.'), 'the whole reflection, not a truncated one');
});

test('a turn that never previews the chips is returned untouched', () => {
  const plain = 'That sounds like it mattered to you. It came from someone certain.';
  assert.equal(dropPickInvite(plain), plain);
});

test('an invite occupying its own whole paragraph takes the paragraph with it', () => {
  const t = 'You were the one they believed.\n\nTap one, or write your own.';
  assert.equal(dropPickInvite(t), 'You were the one they believed.');
});

test('a model turn that is ONLY an invite leaves the engine to speak alone', () => {
  // receiveThen falls back to the opener when there is no receipt — which is exactly right here: if the model
  // said nothing but the invite, the authored line is the whole turn rather than an echo of one.
  const out = receiveThen(dropPickInvite('Tap one, or write your own.'), 'ENGINE_OPENER');
  assert.equal(out, 'ENGINE_OPENER');
});

test('end to end at the seam: the member is invited exactly once', () => {
  const reply = receiveThen(dropPickInvite(MARION_TURN), 'Here are a few words for who that was — tap the one that fits, or write your own.');
  const invites = (reply.match(/write your own/gi) ?? []).length;
  assert.equal(invites, 1, `the invite should appear once, found ${invites}`);
});
