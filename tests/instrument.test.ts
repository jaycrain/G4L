import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMENSIONS,
  TOTAL_ITEMS,
  ITEMS_PER_DIMENSION,
  DIMENSION_ITEM_INDICES,
  validateResponses,
} from '../lib/idq/instrument.ts';

test('structure: 4 dimensions × 6 items = 24', () => {
  assert.equal(DIMENSIONS.length, 4);
  assert.equal(ITEMS_PER_DIMENSION, 6);
  assert.equal(TOTAL_ITEMS, 24);
  assert.deepEqual([...DIMENSIONS], ['physical', 'self', 'social', 'outlook']);
});

test('every item index 0..23 maps to exactly one dimension', () => {
  const all = DIMENSIONS.flatMap((d) => DIMENSION_ITEM_INDICES[d]);
  assert.equal(all.length, 24);
  assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i));
});

test('validateResponses accepts a valid 24-item Likert set', () => {
  assert.deepEqual(validateResponses(Array.from({ length: 24 }, () => 3)), { ok: true });
});

test('validateResponses rejects wrong length, out-of-range, and non-integers', () => {
  assert.equal(validateResponses(Array(23).fill(3)).ok, false);
  assert.equal(validateResponses([6, ...Array(23).fill(3)]).ok, false);
  assert.equal(validateResponses([0, ...Array(23).fill(3)]).ok, false);
  assert.equal(validateResponses([3.5, ...Array(23).fill(3)]).ok, false);
  assert.equal(validateResponses('nope').ok, false);
});
