import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterFeedback } from '../lib/admin/feedback-filter.ts';

// The counts on the chips and the list under them come from ONE pass, on purpose. A chip reading "bug 4"
// above a list of three is the same class of bug as "0 members · 2 active": two numbers on one card built
// from different populations, where the card contradicts itself and neither number can be trusted.

const item = (over: Partial<{ id: string; kind: string; surface: string | null; status: string }> = {}) =>
  ({ id: over.id ?? 'x', kind: over.kind ?? 'bug', status: (over.status ?? 'new') as never,
     body: 'b', createdAt: new Date().toISOString(), surface: over.surface === undefined ? '/program' : over.surface }) as never;

const ALL = [
  item({ id: '1', kind: 'bug', surface: '/program' }),
  item({ id: '2', kind: 'bug', surface: '/dashboard' }),
  item({ id: '3', kind: 'idea', surface: '/program' }),
  item({ id: '4', kind: 'praise', surface: null }),
];

test('no filter shows everything, and the tallies count the whole set', () => {
  const { shown, kinds, surfaces } = filterFeedback(ALL, {});
  assert.equal(shown.length, 4);
  assert.deepEqual(kinds, [{ value: 'bug', n: 2 }, { value: 'idea', n: 1 }, { value: 'praise', n: 1 }]);
  assert.deepEqual(surfaces, [{ value: '/program', n: 2 }, { value: '/dashboard', n: 1 }]);
});

test('a chip count always matches the list it filters to', () => {
  // The property that matters: click "bug 2" and you get exactly 2 rows. If these ever disagree the page is
  // lying about its own contents.
  const { kinds } = filterFeedback(ALL, {});
  for (const k of kinds) {
    const { shown } = filterFeedback(ALL, { kind: k.value });
    assert.equal(shown.length, k.n, `chip said ${k.value} ${k.n} but the list had ${shown.length}`);
  }
});

test('kind and surface compose rather than replacing each other', () => {
  const { shown } = filterFeedback(ALL, { kind: 'bug', surface: '/program' });
  assert.equal(shown.length, 1);
  assert.equal((shown[0] as { id: string }).id, '1');
});

test('an item with no surface is not counted as a surface, and is not lost', () => {
  // A null surface must not become a phantom "" chip — but the item still has to appear unfiltered.
  const { surfaces } = filterFeedback(ALL, {});
  assert.ok(!surfaces.some((s) => !s.value), 'a blank surface must not become a chip');
  assert.equal(filterFeedback(ALL, {}).shown.length, 4);
});

test('a filter matching nothing returns empty rather than falling back to everything', () => {
  // Silently showing all results for an unmatched filter would be the "swallowed error renders as truth"
  // shape again: the operator would think they were looking at a filtered view when they were not.
  const { shown } = filterFeedback(ALL, { kind: 'nonsense' });
  assert.equal(shown.length, 0);
});
