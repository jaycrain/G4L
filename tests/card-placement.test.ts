// Donna reported the same sentence twice, five weeks apart: "questions appear above the field meant to answer
// them." The 2026-08-17 fix addressed cards vs MESSAGES. It never considered cards vs the ANSWER CONTROL, which
// renders at the bottom of the thread — so a card earned at the final message still split the question from its
// scale. These tests hold both halves, because fixing one and calling it done is what happened last time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeTeachingCards } from '../lib/teaching/card-placement.ts';

test('THE BUG: a card earned at the last message never separates the question from its answer control', () => {
  // Six messages, the sixth being an administered question with a 1-5 scale below the thread. R2's card was
  // earned right as that question arrived.
  const p = placeTeachingCards({ taught: ['r2'], cardAt: { r2: 6 }, messageCount: 6, awaitingAnswer: true });
  assert.deepEqual(p.before.get(5), ['r2'], 'the card moves ABOVE the question');
  assert.equal(p.after.get(5), undefined, 'and is NOT left sitting between the question and the scale');
});

test('with no control pending, the same card stays where it was earned', () => {
  // A conversational turn has its text box outside the thread, so nothing is split and the card reads in order.
  const p = placeTeachingCards({ taught: ['r2'], cardAt: { r2: 6 }, messageCount: 6, awaitingAnswer: false });
  assert.deepEqual(p.after.get(5), ['r2']);
  assert.equal(p.before.size, 0);
});

test('a mid-thread card is untouched — the 2026-08-17 fix still holds', () => {
  const p = placeTeachingCards({ taught: ['r1'], cardAt: { r1: 3 }, messageCount: 8, awaitingAnswer: true });
  assert.deepEqual(p.after.get(2), ['r1'], 'stays after the message it was earned at');
  assert.equal(p.before.size, 0);
});

test('several cards keep their own positions, and only the trailing one moves', () => {
  const p = placeTeachingCards({
    taught: ['r1', 'r2', 'r3'],
    cardAt: { r1: 2, r2: 5, r3: 9 },
    messageCount: 9,
    awaitingAnswer: true,
  });
  assert.deepEqual(p.after.get(1), ['r1']);
  assert.deepEqual(p.after.get(4), ['r2']);
  assert.deepEqual(p.before.get(8), ['r3'], 'only the one that would split the question moves');
});

test('a card earned before a RESUMED thread leads — its position was never observed', () => {
  const p = placeTeachingCards({ taught: ['r1'], cardAt: { r1: 12 }, messageCount: 4, awaitingAnswer: false });
  assert.deepEqual(p.leading, ['r1']);
  assert.equal(p.after.size, 0);
});

test('an unobserved card is omitted, never given an invented position', () => {
  const p = placeTeachingCards({ taught: ['r1', 'r2'], cardAt: { r1: 2 }, messageCount: 4, awaitingAnswer: false });
  assert.deepEqual(p.after.get(1), ['r1']);
  assert.equal(p.leading.length, 0);
  assert.equal([...p.after.values()].flat().length, 1, 'r2 has no position, so it does not render');
});

test('two cards landing on the same trailing question both move, in order', () => {
  const p = placeTeachingCards({
    taught: ['r1', 'r2'],
    cardAt: { r1: 4, r2: 4 },
    messageCount: 4,
    awaitingAnswer: true,
  });
  assert.deepEqual(p.before.get(3), ['r1', 'r2']);
});

test('an empty thread cannot crash the rule', () => {
  const p = placeTeachingCards({ taught: ['r1'], cardAt: { r1: 0 }, messageCount: 0, awaitingAnswer: true });
  assert.equal(p.leading.length, 0);
  assert.equal(p.before.size + p.after.size, 1, 'placed somewhere harmless rather than throwing');
});
