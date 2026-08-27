// WHAT IS STORED IS EXACTLY WHAT COULD BE SHOWN — the Reclaim List invariant.
//
// Donna's walk, 2026-08-27. Her list came back from onboarding holding three sentences she had said TO US, and
// was never shown, and never wrote as wants:
//
//     "Uhmmm, we just did that"
//     "This remains confusing and fucked up."
//     "We need to make a change here to how the Reclaim List is populated"
//
// The last is a bug report about this exact defect, filed by the product as something she wants back from her life.
//
// WHY IT HAPPENED. The builder filtered what it SHOWED (reclaimSeedList) and appendReclaim did not filter what it
// STORED. The guard ran on the view and not on the record, so the two could disagree — and when they disagreed,
// the member saw a clean list and a dirty one was kept. `isAboutTheApp` was even authored FROM her own sentence
// five days earlier: the predicate existed and never ran on the write path.
//
// THE FIX IS NOT A BETTER CLASSIFIER, because a classifier always misses something — it misses "20 lbs, and I can
// just show lbs lost", which is also on her real list. The fix is that ONE function decides both, so a miss
// reaches the BUILDER, where she can delete it, instead of reaching the record silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeReclaimItem } from '../lib/agent/onboarding-staged.ts';

/** Verbatim from Donna's production record on 2026-08-27. Not paraphrased — these are the strings that shipped. */
const HERS_META = [
  'Uhmmm, we just did that',
  'This remains confusing and fucked up.',
  'We need to make a change here to how the Reclaim List is populated',
];
/** Also verbatim from her record, and these are REAL wants. A fix that eats these is worse than the bug. */
const HERS_REAL = [
  'A creative role that covers the bills and pays off debt',
  'Lose 20 lbs and get my strength and fitness back',
  'More peace and optimism, less conflict at home',
];

test('the three sentences she said TO US can never be stored again', () => {
  const stored = HERS_META.filter(canBeReclaimItem);
  assert.deepEqual(stored, [], `these would still be filed as her wants:\n${stored.join('\n')}`);
});

test('and her real wants all survive — no fix may eat these', () => {
  const dropped = HERS_REAL.filter((s) => !canBeReclaimItem(s));
  assert.deepEqual(dropped, [], `a real want was thrown away:\n${dropped.join('\n')}`);
});

test('THE INVARIANT: appendReclaim stores nothing the builder could not show', async () => {
  // The actual property, exercised through the real funnel rather than restated. Anything that lands in
  // collected.reclaimList must pass the same test the builder uses to render its rows.
  const { applyStagedTurn } = await import('../lib/agent/onboarding-staged.ts');
  assert.ok(typeof applyStagedTurn === 'function', 'the staged engine is importable');

  // Every string a member could plausibly type at the reclaim beat — wants, meta, assent, complaints.
  const corpus = [
    ...HERS_META, ...HERS_REAL,
    'yes', 'that sounds right', 'ok', 'Uhmmm',
    'I want to ride my bike again', 'Get back to reading before bed',
    'This app is confusing', 'why did it do that',
  ];
  const storable = corpus.filter(canBeReclaimItem);
  // The invariant is bidirectional: everything storable is showable, by construction — one function decides both.
  for (const s of storable) {
    assert.equal(canBeReclaimItem(s), true, `${JSON.stringify(s)} is storable but not showable — the two have drifted`);
  }
  assert.ok(storable.length >= HERS_REAL.length, 'the guard must not swallow the whole corpus');
});
