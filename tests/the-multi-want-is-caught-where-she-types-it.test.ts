// SHE IS NEVER ASKED TO PICK ONE OF THE THINGS SHE JUST WROTE DOWN.
//
// Donna typed one line: "a creative role that covers the bills, rebuilds savings and pays off the debt".
// The engine's shape gate fired on it AFTER she had finished the builder and asked "Which one do you most want
// back? We'll start there — the rest aren't going anywhere." Answering that question REMOVED the two she didn't
// name. Proven, deterministically, before this fix:
//
//   BEFORE  • a creative role that covers the bills, rebuilds savings and pays off the debt
//   AFTER   • a creative role that covers the bills            <- the other two are gone
//
// Silent loss on the Reclaim List — the one artifact the whole program points at — under a sentence promising the
// opposite, in copy we wrote ourselves. Against the standing bar: never drop what they gave you.
//
// The protection already existed and did not reach her. The comment above the SPLIT branch says it exactly:
// "asking them to pick ONE would throw away the ones they didn't pick" — and that branch only runs when we can
// auto-split an enumeration. Hers is prose, so she fell into the branch its own author warned about.
//
// Jennifer typed the same shape numbered; Donna typed it as prose. Two members from different directions is how
// people write, not an edge case — so it is caught at the SOURCE now, in the builder, where she is still holding
// the intent. (Jay, 2026-08-29: "fix it at the source and not carry it forward.")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMultiWantParagraph, proposeProseSplit, reconcileReclaimShapes } from '../lib/agent/reclaim-shape.ts';

const DONNA = 'a creative role that covers the bills, rebuilds savings and pays off the debt';

test("Donna's line is offered as a split, in her own words", () => {
  assert.deepEqual(proposeProseSplit(DONNA), [
    'a creative role that covers the bills',
    'rebuilds savings',
    'pays off the debt',
  ]);
});

test('accepting the split leaves nothing for the engine to interrogate', () => {
  // The point of catching it here: the downstream gate that used to ask her to choose now has no shape to fire on,
  // so the "which one do you most want back?" turn never happens and cannot delete anything.
  const split = proposeProseSplit(DONNA)!;
  assert.equal(reconcileReclaimShapes(split), null, 'a clean list reaches the card with no proposal pending');
  // And declining is equally safe — her line survives verbatim; the card and the rail remain the way to edit it.
  assert.ok(isMultiWantParagraph(DONNA), 'the shape is still recognised; we simply stop resolving it by discarding');
});

test('it stays silent on one want that merely contains "and"', () => {
  // The failure mode of an eager splitter is worse than the one it fixes: chopping a single want into fragments
  // nobody typed. These are the real items from the same list.
  assert.equal(proposeProseSplit('lose the 20 lbs and rebuild my strength and fitness'), null);
  assert.equal(proposeProseSplit('less conflict day to day - peace and optimism'), null);
  assert.equal(proposeProseSplit('I want to run again'), null);
});

test('it refuses to offer a split that would produce an orphan fragment', () => {
  // "my knee" / "my back" are not wants anyone would type on their own. If any part comes out that thin the whole
  // proposal is wrong, and saying nothing beats offering her a bad split.
  assert.equal(proposeProseSplit('my knee, and my back'), null);
});

test('the builder asks BEFORE storing, and neither answer discards', () => {
  // Structural: the proposal must be parked in state, not applied. A future edit that adds the parts straight to
  // the list on detection would reintroduce mutation-without-consent, which is what the whole gate exists to stop.
  const src = readFileSync(new URL('../app/onboarding/reclaim-list-builder.tsx', import.meta.url), 'utf8');
  assert.ok(/setPendingSplit\(\{ raw: v, parts: proposed \}\)/.test(src), 'detection parks a proposal');
  assert.ok(/addAll\(pendingSplit\.parts\)/.test(src), 'accepting adds every part');
  assert.ok(/addAll\(\[pendingSplit\.raw\]\)/.test(src), 'declining keeps her line verbatim');
});
