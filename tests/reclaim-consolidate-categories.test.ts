import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consolidateReclaim, consolidateReclaimList } from '../lib/member/reclaim.ts';

// Data-integrity: consolidation must keep the Reclaim List and its CATEGORIES in LOCKSTEP. Before the fix, finalize
// consolidated the list (dropping closes/dups/folds) but index-matched the STALE categories → a kept item could
// inherit a neighbour's category, which drives its coaching path (identity-goal Beats vs life-goal self-marking).

test('consolidateReclaim · a dropped "close" item does not shift the remaining categories', () => {
  // "that's it" is a close phrase → dropped. Under the OLD index-match, "see friends more" would have inherited the
  // close's category ('people'); with lockstep it correctly keeps its own ('social').
  const items = ['get strong again', "that's it", 'see friends more'];
  const cats = ['physical', 'people', 'social'];
  const r = consolidateReclaim(items, cats);
  assert.deepEqual(r.items, ['get strong again', 'see friends more'], 'the close phrase is dropped');
  assert.deepEqual(r.categories, ['physical', 'social'], 'each surviving item keeps ITS OWN category — no shift');
});

test('consolidateReclaim · an exact duplicate collapses and its category drops (arrays stay aligned)', () => {
  const items = ['travel to japan', 'get strong', 'travel to japan'];
  const cats = ['life', 'physical', 'WRONG'];
  const r = consolidateReclaim(items, cats);
  assert.equal(r.items.length, r.categories.length, 'arrays stay the same length');
  const japan = r.items.findIndex((i) => /japan/i.test(i));
  assert.equal(r.categories[japan], 'life', 'the kept japan item keeps its own life category, never the dup’s WRONG');
  const strong = r.items.findIndex((i) => /strong/i.test(i));
  assert.equal(r.categories[strong], 'physical', 'get strong keeps physical — no shift from the collapse');
});

test('consolidateReclaim · degrades safely when categories are missing/short', () => {
  const r = consolidateReclaim(['a real want', 'another want'], []); // no categories provided
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.categories, ['', ''], 'missing categories become empty, still aligned by index');
});

test('consolidateReclaimList · items-only delegate is unchanged (existing callers safe)', () => {
  assert.deepEqual(consolidateReclaimList(['get strong', "that's it", 'run a 5k']), ['get strong', 'run a 5k'], 'close dropped, wants kept');
});
