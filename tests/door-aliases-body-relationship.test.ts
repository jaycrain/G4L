// THE TWO DOORS THAT COULD NOT BE MATCHED, AND THE ONE THAT MUST NOT BE (Jay's walk, 2026-08-25).
//
// The Body had NO aliases at all, so it was unreachable from prose. The Relationship had four, and all four named
// the ENDING — divorce, separated, my marriage ended — while its descriptor names the DRIFT: "the drift from
// partnership into just coexisting." The commonest shape of that Door was the one shape it could not recognise.
//
// THE REFUSAL CASE IS THE IMPORTANT ONE. On his walk the Companion was asked whether his weight gain was a Door
// and said it read as what the work taking over had COST him — downstream of The Grind, not a Door of its own.
// It gave the counterfactual that makes the rule legible: it is its own Door when the body changed on its own.
// That judgement was right, and a keyword matcher is exactly the thing that would have overridden it. So these
// aliases are built to leave that answer standing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDoors } from '../lib/doors.ts';

const doorsFor = (text: string): string[] => matchDoors(text);

// THE BODY NEEDED NOTHING. The queue item said it "has no aliases, so it can never be matched from prose" — and
// that was wrong: CONCRETE_PHYSICAL_EVENT in matchDoors has covered it as a primary signal since milie's walk.
// Pinned here so nobody 'fixes' the absent alias list again.
test('The Body is matched by the member’s own physical language, with no alias list', () => {
  for (const said of [
    'my body changed and I stopped being able to do what I used to',
    'bad knees, bad back — everything hurts now',
    "my shoulder doesn't rotate like it used to",
    'I never came back from the injury',
  ]) {
    assert.ok(doorsFor(said).includes('body'), `should surface The Body: "${said}"`);
  }
});

test('The Relationship recognises the DRIFT, not only the ending', () => {
  for (const said of [
    'we grew apart over about ten years',
    "we're more like roommates than anything else",
    'the marriage drifted into just coexisting',
  ]) {
    assert.ok(doorsFor(said).includes('marriage'), `should surface The Relationship: "${said}"`);
  }
});

test('WEIGHT DOES NOT SURFACE THE BODY — the Companion’s judgement stands', () => {
  // Jay's own story: the work took over, and the weight came after. The Companion called that a COST of The Grind
  // rather than a Door, and it was right. If a matcher contradicts it, the matcher is what changes.
  const said = 'the film took over everything and I put on a lot of weight';
  assert.ok(!doorsFor(said).includes('body'), 'weight downstream of the work is not The Body');
});

test('KNOWN over-match: a body part with no failure still surfaces The Body', () => {
  // "my knees are fine" tags The Body, because CONCRETE_PHYSICAL_EVENT matches a bare `knees?`. Recorded rather
  // than narrowed: catching the negation needs sentence-level parsing, and tightening the regex risks re-breaking
  // the walk it was written for ("my knee hurts, I can't run anymore, I throw my back out"). A Door proposed at
  // the gap confirm is a chip the member can tap off, so the cost of this is one wrong chip, not a wrong record.
  assert.ok(doorsFor('my knees are fine, honestly').includes('body'), 'documenting current behaviour, not endorsing it');
});

test('drifting from FRIENDS is not The Relationship', () => {
  // "The Relationship" is the partnership. Every alias is anchored to it precisely so this cannot land here.
  assert.ok(!doorsFor('my friends drifted away and I lost touch').includes('marriage'));
});
