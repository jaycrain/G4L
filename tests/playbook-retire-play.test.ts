import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKeptEntry } from '../lib/playbook/store.ts';
import type { PlaybookEntry } from '../lib/playbook/store.ts';

// Retiring the wrong play is a SILENT edit to the member's own operating manual — no error, no undo prompt, and
// they may not notice for weeks. So this matcher is anchored and refuses rather than guesses: the Companion asks
// which one instead of picking the nearest. These tests exist for the refusals more than the matches.

const e = (id: string, body: string, extra: Partial<PlaybookEntry> = {}): PlaybookEntry =>
  ({ id, body, state: 'kept', section: 'what_works', keeperType: 'plan', pinned: false, ...extra }) as PlaybookEntry;

const KEPT = [
  e('1', 'The false start protocol — name it, reset, go again'),
  e('2', 'Walk at lunch instead of eating at my desk'),
  e('3', 'Call my brother on Sundays'),
];

test('an exact phrase finds its play', () => {
  const r = matchKeptEntry(KEPT, 'Call my brother on Sundays');
  assert.equal(r.entry?.id, '3');
  assert.equal(r.ambiguous, false);
});

test('the words a member would actually use find it — case and spacing are irrelevant', () => {
  assert.equal(matchKeptEntry(KEPT, 'the FALSE   start protocol').entry?.id, '1');
  assert.equal(matchKeptEntry(KEPT, 'walk at lunch').entry?.id, '2');
});

test('AMBIGUOUS REFUSES — two plays match, so it picks NEITHER', () => {
  // The dangerous case. "walk" hits two; guessing edits the wrong one and says nothing.
  const many = [...KEPT, e('4', 'Walk the dog before work')];
  const r = matchKeptEntry(many, 'walk');
  assert.equal(r.entry, null, 'no entry is chosen');
  assert.equal(r.ambiguous, true, 'and the caller is told to ask, not guess');
});

test('a better tier beats several worse ones — an exact hit is not drowned by loose containment', () => {
  const many = [...KEPT, e('4', 'Call my brother on Sundays, and my sister when I can')];
  const r = matchKeptEntry(many, 'Call my brother on Sundays');
  assert.equal(r.entry?.id, '3', 'the exact body wins outright');
  assert.equal(r.ambiguous, false);
});

test('something they never kept matches nothing, and is NOT reported as ambiguous', () => {
  const r = matchKeptEntry(KEPT, 'thirty minutes of meditation');
  assert.equal(r.entry, null);
  assert.equal(r.ambiguous, false, 'no match and a confusing match are different problems, answered differently');
});

test('only KEPT, non-journal entries are retirable', () => {
  const mixed = [
    e('p', 'Walk at lunch instead of eating at my desk', { state: 'proposed' }),
    e('j', 'Walk at lunch instead of eating at my desk', { section: 'journal' }),
  ];
  const r = matchKeptEntry(mixed, 'walk at lunch');
  assert.equal(r.entry, null, 'a proposal is not yet theirs to retire, and the journal is intake, not a play');
});

test('an empty phrase is inert', () => {
  assert.equal(matchKeptEntry(KEPT, '   ').entry, null);
  assert.equal(matchKeptEntry(KEPT, '').ambiguous, false);
});
