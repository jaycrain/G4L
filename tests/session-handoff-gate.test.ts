// THE END CARD MUST RAISE FOR THE SESSIONS THAT MAKE NOTHING YOU CAN LIST.
//
// Jay finished B2 on 2026-08-26 and found two skill rows on his Playbook he could not account for: "where did
// these come from? I'm seeing the summary in What you've learned but didn't notice it getting teed up as a
// tracker."
//
// The reason was a single JSX condition. The end card gated on "at least one filled artifact slot", and B1, B2
// and C2 are administered instruments whose artifact is a qualitative frame with an EMPTY slots array — never a
// bare score, which is governance, not an oversight. So for those three the card never rendered at all, and
// `whereItLives.b2` ("your development map is in your Playbook") had been authored, tested, and shown to nobody.
//
// The sixth instance of the shape Jay's walk kept turning up: A RULE THAT EXISTS AND DOES NOT RUN. It is worse
// than a missing rule, because the authored copy and the passing test both read as "solved".
//
// This tests the real gate — workspace-session.tsx calls this exact function — rather than a restatement of it.
// The bug it replaces was invisible to every unit test we had, because it lived in a render condition.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasHandoff, trackerKindFor } from '../lib/content/session-tracker.ts';
import { whereItLives } from '../lib/content/where-it-lives.ts';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';

test('B2 raises the card on a tracker alone — no slots, no excuses', () => {
  assert.equal(hasHandoff({ filledSlots: 0, hasTracker: true, hasDestination: true }), true);
});

test('an administered instrument with no tracker still raises on its destination', () => {
  // B1 opens no practice week. It still made something — "your why, in your own words" — and still has a page.
  assert.equal(trackerKindFor('b1'), null, 'B1 opens no week; this test is about the destination alone');
  assert.equal(hasHandoff({ filledSlots: 0, hasTracker: false, hasDestination: true }), true);
});

test('a checkpoint still goes straight home', () => {
  // No artifact, no week, no page — its line is "there is nothing to file from this one", and B4 hands to a
  // ceremony. A card here would be a second receipt for one moment.
  assert.equal(hasHandoff({ filledSlots: 0, hasTracker: false, hasDestination: false }), false);
});

test('EVERY SESSION THAT MAKES SOMETHING NOW HAS A CLOSE THAT SPEAKS', () => {
  // The regression in one assertion: for each Session, does the close have anything to hand over? Only the three
  // checkpoints may answer no. Before the fix, b1/b2/c2 answered no too, and that was the bug.
  const silent = SESSION_KEYS.filter(
    (k) => !hasHandoff({
      filledSlots: 0, // the worst case — an instrument that fills no slots
      hasTracker: !!trackerKindFor(k),
      hasDestination: !!whereItLives(k).href,
    }),
  );
  assert.deepEqual(
    [...silent].sort(),
    ['b4', 'c4', 'rewire-checkpoint'],
    `these Sessions close without handing the member anything: ${silent.join(', ')}`,
  );
});
