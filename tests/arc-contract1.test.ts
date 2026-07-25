import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptOnly, receiveThen } from '../lib/agent/onboarding-staged.ts';

// Contract 1 — one question per turn (docs/arc-reliability-hardening.md, Phase 1). The kernel helper that ends the
// "two questions stacked" class (Donna's #1 door double-opener, #4 door→IDQ): at a handoff the engine keeps the
// model's receipt and drops its trailing question, so the scripted opener is the single ask.

test('receiptOnly: strips the trailing question, keeps the reflection', () => {
  assert.equal(
    receiptOnly("That person didn't disappear.\n\nWas anyone taking care of you during that year?"),
    "That person didn't disappear.",
  );
  // multi-sentence receipt, one trailing ask
  assert.equal(receiptOnly('You held it together. You carried them. What did that cost you?'), 'You held it together. You carried them.');
  assert.equal(receiptOnly("That's the story."), "That's the story."); // no trailing question → unchanged
  assert.equal(receiptOnly('Was anyone taking care of you?'), ''); // ONLY a question → empty (opener will stand alone)
  assert.equal(receiptOnly(''), '');
  assert.equal(receiptOnly(undefined), '');
});

test('receiveThen: exactly one question — the opener — never the model’s stacked on top', () => {
  const opener = 'Take me back to how it happened — what did it quietly cost you?';
  const stacked = receiveThen('You held it together when it all fell apart.\n\nWho was holding you up?', opener);
  assert.equal((stacked.match(/\?/g) ?? []).length, 1, 'one question total (the opener), not two');
  assert.match(stacked, /You held it together/, 'the receipt is preserved (receive-before-you-move)');
  assert.doesNotMatch(stacked, /Who was holding you up\?/, "the model's trailing question is dropped");
  // when the model only asked, the opener stands alone (no empty receipt, no double)
  assert.equal(receiveThen('Who was holding you up?', opener), opener);
  // no model text → opener alone
  assert.equal(receiveThen('', opener), opener);
});
