// THE PICTURE IS WHAT HE DESCRIBED, NOT WHAT HE ASKED US.
//
// Jay's walk, 2026-08-25. His Visualization keeper came back as one welded sentence:
//
//   "Big Sugar Sorry, I thought that was on my Reclaim List. It's a gravel race I'm signed up for in October
//    Can you add it to my list?"
//
// A destination, an apology and a housekeeping request to the Companion, offered back as the scene he had built.
//
// WHY THE EXISTING GUARD DID NOT CATCH IT. harvest.ts applies isConversationalMeta at "the single seam every
// arc's keepers cross" — deliberately central, and correct. But W2 COMPOSES the picture from every message the
// beat collects, so the seam only ever sees the finished join. Filtering there would have dropped "Big Sugar"
// and the race along with the request. The check has to run where the pieces are still separate.
//
// AND THE PREDICATE HAD A HOLE. "Can you add it to my list?" is neither a repeat-claim nor a question about our
// conduct (isConversationalMeta), and isAboutTheApp had the product noun but no fix-verb — asking politely is a
// different shape from "you need to change this". The request form is now part of it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAboutTheApp, isConversationalMeta } from '../lib/agent/conversational-meta.ts';

const JAY = [
  'Big Sugar',
  "Sorry, I thought that was on my Reclaim List. It's a gravel race I'm signed up for in October",
  'Can you add it to my list?',
];

const kept = (pieces: string[]) => pieces.filter((p) => !isConversationalMeta(p) && !isAboutTheApp(p));

test("the housekeeping request is dropped and the member's own scene survives", () => {
  const out = kept(JAY);
  assert.ok(!out.includes('Can you add it to my list?'), 'the request to the Companion is still in the picture');
  assert.ok(out.includes('Big Sugar'), 'the destination was dropped with it');
  assert.ok(out.some((p) => p.includes('gravel race')), 'the race detail was dropped with it');
});

test('A MIXED LINE IS KEPT — losing his own words is the more expensive mistake', () => {
  // The apology carries the race with it. Better to keep an imperfect sentence than to lose real detail: the
  // member can edit a keeper, but cannot recover one we never offered.
  assert.ok(kept(JAY).length >= 2);
});

test('the request form does not swallow a real want', () => {
  for (const real of [
    'I want work that pays me what I am worth',
    'I want to ride with my friends again',
    'Can you believe how long it has been?', // request form, no product noun
    'Long rides on weekends',
  ]) {
    assert.equal(kept([real]).length, 1, `a real line was filtered: ${real}`);
  }
});

test('and it does catch the shape it was added for', () => {
  for (const meta of ['Can you add it to my list?', 'Could you change how the dashboard shows this?']) {
    assert.equal(kept([meta]).length, 0, `not caught: ${meta}`);
  }
});
