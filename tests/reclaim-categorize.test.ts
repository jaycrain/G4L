import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeReclaimItems } from '../lib/beats/categorize.ts';
import { inferCategory } from '../lib/beats/category.ts';

// CATEGORY IS ROUTING, AND ROUTING THAT IS WRONG IS WORSE THAN ROUTING THAT IS ABSENT.
//
// A Reclaim item's category selects which Beats a member is served (lib/beats/serves.ts). The bug that prompted
// this: a persona walk tagged an open-water swimmer's "Getting in the ocean regularly" as `self`, because the v1
// keyword list has `swim` but not `ocean` — so the centre of the identity she came back for would have been fed
// identity content instead of movement.
//
// These tests run WITHOUT an API key, which is the point: they pin the degradation path. A member's signup can
// never depend on a categoriser being reachable, so "no key" must behave exactly as the old code did.

const KEY = process.env.ANTHROPIC_API_KEY;

test('with no API key it degrades to the keyword heuristic, unchanged', async (t) => {
  if (KEY) return t.skip('needs an unset ANTHROPIC_API_KEY to exercise the offline path');
  const items = ['Ride 3x a week', 'Dinner with friends', 'Raise $250k'];
  const got = await categorizeReclaimItems(items);
  assert.deepEqual(got, items.map(inferCategory), 'offline behaviour is byte-for-byte the old behaviour');
});

test('it always returns exactly one category per item', async (t) => {
  if (KEY) return t.skip('offline shape check');
  // Index-locking is the property that matters most. A short or long array from the model must never shift
  // another item's tag onto the wrong goal — a silent, confident mis-routing rather than a visible gap.
  for (const items of [[], ['one'], ['a', 'b', 'c', 'd', 'e']]) {
    const got = await categorizeReclaimItems(items);
    assert.equal(got.length, items.length, `${items.length} in, ${items.length} out`);
  }
});

test('every returned value is a legal category', async (t) => {
  if (KEY) return t.skip('offline shape check');
  // reclaim_item.category carries a CHECK constraint; anything outside the set fails the INSERT, which would
  // turn a metadata problem into a lost signup.
  const legal = new Set(['physical', 'self', 'social', 'outlook', 'life']);
  const got = await categorizeReclaimItems(['Get in the ocean', 'Call my brother', 'Save for the trip']);
  for (const c of got) assert.ok(legal.has(c), `${c} must satisfy the DB constraint`);
});

test('the keyword fallback still handles what it was always good at', async (t) => {
  if (KEY) return t.skip('offline');
  // Not everything needed a model. These are the cases the heuristic gets right, and the fallback must keep
  // getting them right on the day the categoriser is unreachable.
  assert.equal(inferCategory('Ride 3x a week'), 'physical');
  assert.equal(inferCategory('Dinner with friends every month'), 'social');
  assert.equal(inferCategory('Raise $250k for the venture'), 'life');
  assert.equal(inferCategory('Plan the next adventure'), 'outlook');
});

test('THE CASE THAT STARTED THIS — the heuristic gets it wrong, and we know it', async (t) => {
  if (KEY) return t.skip('offline');
  // Documented deliberately rather than "fixed" by bolting `ocean` onto the regex. The point of the model pass
  // is that the next member will say "back on the water", or "get my laps in", or something nobody listed —
  // and a keyword list can only ever chase the phrasings someone already thought of.
  assert.equal(
    inferCategory('Getting in the ocean regularly.'),
    'self',
    'still mis-tagged offline: this is exactly what the model pass exists to correct',
  );
});
