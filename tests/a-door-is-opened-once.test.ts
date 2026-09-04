// THE ENGINE DOES NOT OPEN A DOOR THE MODEL HAS ALREADY OPENED.
//
// Jennifer, 2026-09-04. Two consecutive Companion messages, both introducing the same Door:
//
//   "That one's drawn out. Let me take it in. NEXT IS THE AGING PARENTS. Not the label — take me back to how it
//    actually went with your dad."
//   "THEN LET'S TAKE THE AGING PARENTS. Same thing — not the label, what actually happened."
//
// She reported it as a "duplicate entry", which is exactly what it is. The model announced the next Door in its
// own prose and the engine appended its scripted opener for the SAME Door.
//
// SAME FAMILY AS THE STACKED QUESTION, and the same rule settles it: one ask per turn, and the model's own words
// are not something to talk over. The engine owns STRUCTURE, the model owns CONTENT — and when the model has
// already done the structural thing, the engine's job is to be quiet. [[drawout-rhythm-model-owns-questions]]
//
// DETERMINISTIC. It asks whether the receipt NAMES that Door, never what the model meant by it. Reading intent
// out of prose is the inference that got stage-agreement reverted. [[stage-agreement-invariant]]

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const atConfirm = (): ConvState => ({
  stage: 'doors', awaitingConfirm: true,
  collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'aging_parents'], doorsExcavated: [] } as Collected,
} as unknown as ConvState);

const bank = (modelText: string) =>
  applyReconnectTurn(atConfirm(), [], "yes, that's it", { text: modelText, replyIntent: 'done' } as never, RECONNECT_R2_ARC);

test("HERS: the model names the next Door, so the engine does not name it again", () => {
  const out = bank("That one's drawn out. Let me take it in. Next is The Aging Parents. Not the label — take me "
    + 'back to how it actually went with your dad.');
  const opened = (out.reply.match(/aging parents/gi) ?? []).length;
  assert.equal(opened, 1, `The Aging Parents introduced ${opened} times in one turn:\n${out.reply}`);
  assert.doesNotMatch(out.reply, /Then let's take/i, 'the scripted opener was appended over the model’s own');
});

test('but the opener STILL lands when the model has not named it', () => {
  // The control. Without this the fix could pass by never opening the next Door at all — which would strand her
  // between Doors with nothing asked.
  const out = bank('That one is drawn out. Let me take it in.');
  assert.match(out.reply, /Then let's take The Aging Parents/i, 'the next Door was never opened');
});

test('and the Door is still banked either way — the fix is about the WORDS, not the queue', () => {
  for (const text of [
    "Let me take it in. Next is The Aging Parents. Take me back to how it went.",
    'That one is drawn out. Let me take it in.',
  ]) {
    const out = bank(text);
    assert.deepEqual((out.state.collected as Collected).doorsExcavated, ['body'],
      'the finished Door must be banked whichever way the turn is worded');
  }
});
