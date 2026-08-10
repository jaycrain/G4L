import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groundToMemberWords } from '../lib/agent/member-words.ts';

// ============================================================================================================
// GIVING THE MEMBER THEIR OWN WORDS BACK.
//
// Every case below is REAL. The member messages are what the C3 walk types, and the `stored` strings are what the
// live model actually recorded from them on 2026-08-09 — not invented failures. That matters: a fixture I made up
// would encode my guess about how the model drifts, and the whole point is that the drift was invisible until a
// live walk printed it.
// ============================================================================================================

// What the walk's member types, verbatim.
const SAID = [
  "Honestly the days that feel good all start the same way — a walk with Rosie before the house wakes. I also need seven hours of sleep, no negotiating on that one, and eating lunch away from my desk. Without those three it's not a good day.",
  'On top of that, what really helps is cooking something properly instead of grazing, ten minutes on the piano, and a real conversation with Marcus. Not essential, but they lift a day.',
  "What wrecks a day is opening email before I have had coffee — I'm behind before I've started — and saying yes to a late meeting.",
];

test('THE CASE THAT STARTED THIS — a compressed label recovers the detail the model dropped', () => {
  // She said "a walk with Rosie before the house wakes". It stored "Morning walk with Rosie" — reads fine, fits a
  // chip better, and the thing that made it hers is gone.
  const got = groundToMemberWords('Morning walk with Rosie', SAID);
  assert.equal(got.grounded, 'recovered');
  assert.equal(got.text, 'walk with Rosie before the house wakes');
});

test('a contraction the model introduced is undone — "I\'ve had" goes back to "I have had"', () => {
  const got = groundToMemberWords("Opening email before I've had coffee", SAID);
  assert.equal(got.grounded, 'recovered');
  assert.equal(got.text, 'opening email before I have had coffee', 'and the "What wrecks a day is" lead-in is trimmed');
});

test('sentence-casing is undone without touching the words', () => {
  // The most common drift, and the cheapest to fix: it IS her span, just capitalised for a bulleted list.
  for (const [stored, expected] of [
    ['Seven hours of sleep', 'seven hours of sleep'],
    ['Cooking something properly instead of grazing', 'cooking something properly instead of grazing'],
    ['Ten minutes on the piano', 'ten minutes on the piano'],
  ] as const) {
    const got = groundToMemberWords(stored, SAID);
    assert.equal(got.grounded, 'verbatim', stored);
    assert.equal(got.text, expected);
  }
});

test('a span that is already exactly theirs is returned untouched', () => {
  const got = groundToMemberWords('a real conversation with Marcus', SAID);
  assert.equal(got.grounded, 'verbatim');
  assert.equal(got.text, 'a real conversation with Marcus');
});

test('a dropped leading word is restored from their clause', () => {
  // "Lunch away from my desk" IS a substring of "eating lunch away from my desk", so this grounds verbatim to the
  // substring — their words, just not the whole phrase. That is acceptable: it is still only words she typed.
  const got = groundToMemberWords('Lunch away from my desk', SAID);
  assert.equal(got.grounded, 'verbatim');
  assert.equal(got.text, 'lunch away from my desk');
});

test('NEVER INVENT: something they never said is left alone, not force-matched to the nearest clause', () => {
  // The dangerous failure mode of any recovery scheme. If the model hallucinates an element, we must not quietly
  // rewrite it into an unrelated thing the member DID say — that manufactures a false memory in their own voice.
  const got = groundToMemberWords('Thirty minutes of meditation', SAID);
  assert.equal(got.grounded, 'none');
  assert.equal(got.text, 'Thirty minutes of meditation', 'kept as-is; the member confirms the list before it saves');
});

test('one incidental word in common is NOT enough to hijack a clause', () => {
  // "piano" appears in her text, but "Selling the piano to a stranger" is not something she said. A single
  // overlapping token must not drag it onto her contributor.
  const got = groundToMemberWords('Selling the piano to a stranger downtown', SAID);
  assert.equal(got.grounded, 'none');
});

test('empty and whitespace items are inert', () => {
  assert.equal(groundToMemberWords('', SAID).grounded, 'none');
  assert.equal(groundToMemberWords('   ', SAID).grounded, 'none');
});

test('no member text at all — nothing to ground against, so nothing is changed', () => {
  const got = groundToMemberWords('Morning walk with Rosie', []);
  assert.equal(got.grounded, 'none');
  assert.equal(got.text, 'Morning walk with Rosie');
});
