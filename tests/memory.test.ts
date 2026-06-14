import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectFoldBatch } from '../lib/agent/memory.ts';

const mk = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ seq: i + 1, role: i % 2 ? 'agent' : 'member', text: `m${i + 1}` }));

test('no fold until enough messages have aged out of the recall window', () => {
  // window 40, batch 10. 45 messages → aged-out are seq ≤ 5 → only 5 < 10 → null
  assert.equal(selectFoldBatch(mk(45), 0), null);
});

test('folds the aged-out batch once the threshold is met', () => {
  // 60 messages: cutoff = 60 - 40 = 20; due = seq 1..20 (≥10) → fold them
  const r = selectFoldBatch(mk(60), 0);
  assert.ok(r);
  assert.equal(r!.batch.length, 20);
  assert.equal(r!.batch[0]!.seq, 1);
  assert.equal(r!.newThroughSeq, 20);
});

test('never re-folds already-folded messages', () => {
  // throughSeq 20, 60 msgs: cutoff 20, nothing with seq > 20 && ≤ 20 → null
  assert.equal(selectFoldBatch(mk(60), 20), null);
  // 75 msgs, throughSeq 20: cutoff 35, due = seq 21..35 (15 ≥ 10) → fold
  const r = selectFoldBatch(mk(75), 20);
  assert.ok(r);
  assert.equal(r!.batch.length, 15);
  assert.equal(r!.batch[0]!.seq, 21);
  assert.equal(r!.newThroughSeq, 35);
});

test('empty thread → nothing to fold', () => {
  assert.equal(selectFoldBatch([], 0), null);
});

test('custom window/batch honored', () => {
  // window 5, batch 3, 10 msgs: cutoff 5, due 1..5 (≥3) → fold
  const r = selectFoldBatch(mk(10), 0, 5, 3);
  assert.ok(r);
  assert.equal(r!.batch.length, 5);
  assert.equal(r!.newThroughSeq, 5);
});
