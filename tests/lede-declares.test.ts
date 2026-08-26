// A LEDE DECLARES WHAT THE THING IS. It does not invent an objection so it can refute one.
//
// Jay, 2026-08-26, on C1's teaching card: "a little cringey — 'not a detour'." It read "Why revisiting your list
// is the work, not a detour from it." Nothing anywhere in C1 suggests a member thinks revisiting their list is a
// detour. The clause was there to sound insightful, and a reader feels the manufactured strawman even when they
// cannot name it. Same family as the cadences thinned out of the Companion's voice in August.
//
// THE RULE COMES WITH ITS EXEMPLAR, because a rule against overuse written WITHOUT its good example gets
// implemented as a ban — that has happened twice on this project. B2's lede negates too, and it stays:
//
//     "Why this is a set of skills, not a question of willpower"
//
// A member genuinely arrives believing self-management is willpower. Denying it is the teaching, so the clause
// carries content. The test is not "does it negate" but "is the thing being denied something they actually
// think." This file pins BOTH so neither drifts: the good one cannot be tidied away by someone applying the rule
// mechanically, and the bad shape cannot come back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_EXPLORE } from '../lib/content/explore.ts';

const ledes = () => Object.entries(ASSET_EXPLORE).map(([k, v]) => [k, (v as { lede: string }).lede] as const);

test('no lede manufactures an objection to knock down', () => {
  // The banned shape is a trailing negation of something the copy never raised. Enumerated rather than pattern-
  // matched: "does the member believe this" is a judgement, and a regex that tried would either miss the next one
  // or eat the willpower line. What a test CAN do is refuse the specific phrasings we have already ruled on.
  const RULED_OUT = [/not a detour/i, /rather than a detour/i, /not a distraction/i, /not a step back/i];
  const offenders: string[] = [];
  for (const [key, lede] of ledes()) {
    for (const re of RULED_OUT) if (re.test(lede)) offenders.push(`${key}: "${lede}"`);
  }
  assert.deepEqual(offenders, [], `a lede is refuting something nobody said:\n${offenders.join('\n')}`);
});

test('the willpower lede is KEPT — negation is not the fault', () => {
  const b2 = ledes().find(([k]) => k === 'b2')?.[1];
  assert.equal(
    b2,
    'Why this is a set of skills, not a question of willpower',
    'b2 negates a belief the member actually holds — that is content, and removing it would be applying the rule mechanically',
  );
});

test('C1 declares', () => {
  assert.equal(ledes().find(([k]) => k === 'c1')?.[1], 'Why revisiting your list is the work');
});

test('every lede still says what it is about', () => {
  for (const [key, lede] of ledes()) {
    assert.ok(lede.trim().length > 12, `${key} has no lede`);
    assert.ok(!/\.$/.test(lede.trim()), `${key}'s lede ends in a full stop — these are headings, not sentences`);
  }
});
