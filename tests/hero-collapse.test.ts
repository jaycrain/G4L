// THE HERO COLLAPSES ON SCROLL, AND COMES BACK.
//
// Jay, 2026-08-26: "the conversation is the highest value real estate in the entire app." The hero is pinned so a
// member always knows which step they are on — right, and it spends ~200px the thread needs more. He chose
// collapse-on-scroll over a permanent shrink for both halves: everything to the conversation while reading, and
// scrolling up to get a header back is behaviour every member already has.
//
// WHAT THIS FILE GUARDS is the hysteresis, because that is the part with a failure mode that reads as a bug
// rather than a missing feature: a single threshold makes a thread resting near the boundary flutter between
// states on every wheel tick, which is worse than never collapsing at all.
//
// The CSS half was verified in a browser at both widths (desktop reclaims 160px, iPhone 233px) — and that
// measurement is what caught the rules being appended INSIDE `@media (max-width: 1000px)`, where they gave a
// phone everything and desktop exactly nothing while the diff looked correct.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroCollapseNext } from '../lib/dashboard/hero-collapse.ts';

test('it collapses only after a real scroll, not a nudge', () => {
  assert.equal(heroCollapseNext(false, 0), false);
  assert.equal(heroCollapseNext(false, 40), false, '40px is a twitch, not a read');
  assert.equal(heroCollapseNext(false, 60), true);
});

test('and it comes back near the top — the reason Jay chose this one', () => {
  assert.equal(heroCollapseNext(true, 20), true);
  assert.equal(heroCollapseNext(true, 4), false);
  assert.equal(heroCollapseNext(true, 0), false);
});

test('THE FLUTTER CANNOT HAPPEN — the two thresholds never overlap', () => {
  // A thread parked between 8 and 48 must hold whatever state it is in. With one threshold, every small wheel
  // movement across that line would toggle the header, which reads as the page fighting the member.
  for (const y of [9, 20, 33, 47]) {
    assert.equal(heroCollapseNext(true, y), true, `collapsed should HOLD at ${y}`);
    assert.equal(heroCollapseNext(false, y), false, `open should HOLD at ${y}`);
  }
});

test('it is idempotent — the same scroll position never changes its mind', () => {
  for (const y of [0, 8, 48, 400]) {
    const once = heroCollapseNext(false, y);
    assert.equal(heroCollapseNext(once, y), once, `unstable at ${y}`);
  }
});
