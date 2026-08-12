import { test } from 'node:test';
import assert from 'node:assert/strict';

// C1 "Looking Forward" exists to find the ANCHOR — the one goal the rest of the list organises itself around. The
// summary card rendered the list in stored order, so Jay's anchor ("Finish in top 20% of my age group at Big Sugar")
// sat FOURTH under a heading reporting what he'd just built. "Shouldn't the starred item be on top. That was the
// whole point of Looking Forward."
//
// The ordering is a pure transform, so it is asserted directly rather than through a DB read.
type Item = { text: string; tier?: string | null };
const order = (items: Item[]) =>
  items
    .filter((i) => i.tier !== 'no_longer_central')
    .map((i, idx) => ({ i, idx }))
    .sort((a, b) => Number(b.i.tier === 'top') - Number(a.i.tier === 'top') || a.idx - b.idx)
    .map((x) => x.i.text);

// Jay's real list, in the order the card showed it.
const JAYS: Item[] = [
  { text: 'Eating oatmeal, salad, and a light dinner...' },
  { text: 'Yoga and kettlebell work 3 times per week' },
  { text: 'VO2 Max and Threshold interval rides' },
  { text: 'Finish in top 20% of my age group at Big Sugar', tier: 'top' },
  { text: 'One sustained climb per weekend' },
];

test("the anchor leads — it's what the Session was for", () => {
  assert.equal(order(JAYS)[0], 'Finish in top 20% of my age group at Big Sugar');
});

test('everything else keeps the order the member put it in', () => {
  assert.deepEqual(order(JAYS).slice(1), [
    'Eating oatmeal, salad, and a light dinner...',
    'Yoga and kettlebell work 3 times per week',
    'VO2 Max and Threshold interval rides',
    'One sustained climb per weekend',
  ]);
});

test('set-aside items stay off the card entirely', () => {
  const withDropped = [...JAYS, { text: 'Something I let go of', tier: 'no_longer_central' }];
  assert.ok(!order(withDropped).includes('Something I let go of'));
});

test('no anchor yet — the list is simply left alone, not reshuffled', () => {
  const none = JAYS.map((i) => ({ text: i.text }));
  assert.deepEqual(order(none), none.map((i) => i.text));
});

test('more than one starred item keeps their relative order', () => {
  const two: Item[] = [{ text: 'a' }, { text: 'b', tier: 'top' }, { text: 'c' }, { text: 'd', tier: 'top' }];
  assert.deepEqual(order(two), ['b', 'd', 'a', 'c']);
});
