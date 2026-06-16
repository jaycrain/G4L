import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReclaimList,
  validateDoors,
  validateReconnectOutput,
  RECLAIM_LIST_MIN,
} from '../lib/member/reclaim.ts';
import { DOOR_SLUGS, matchDoors, correctDoors } from '../lib/doors.ts';

const five = ['a', 'b', 'c', 'd', 'e'];

test('reclaim list needs at least the minimum non-empty items, with no maximum', () => {
  assert.equal(RECLAIM_LIST_MIN, 3);
  assert.equal(validateReclaimList(['a', 'b', 'c']).ok, true); // exactly the floor
  assert.equal(validateReclaimList(['a', 'b']).ok, false); // below the floor
  assert.equal(validateReclaimList(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']).ok, true); // no max
  assert.equal(validateReclaimList(['a', 'b', '  ']).ok, false); // empty item rejected
});

test('one or more of the canonical doors validate; unknown / empty do not', () => {
  assert.equal(DOOR_SLUGS.length, 9); // 8 original + The Full House (family-formation Fade)
  assert.equal(validateDoors(['full_house']).ok, true);
  assert.equal(validateDoors(['vanishing']).ok, true);
  assert.equal(validateDoors(['vanishing', 'body']).ok, true); // multi-Door
  assert.equal(validateDoors([]).ok, false); // at least one required
  assert.equal(validateDoors(['the_career']).ok, false); // stale MA v1.1 name
  assert.equal(validateDoors('vanishing').ok, false); // must be an array
});

test('matchDoors maps free text to one or more Doors in canonical order', () => {
  assert.deepEqual(matchDoors('the empty nest'), ['empty_nest']);
  assert.deepEqual(matchDoors('aging parents and the marriage'), ['aging_parents', 'marriage']);
  assert.deepEqual(matchDoors('5'), ['body']); // numbered, back-compat
  // The Full House maps from plain family-formation language, not just its title.
  assert.deepEqual(matchDoors('when I got married then had kids'), ['full_house']);
  assert.deepEqual(matchDoors('the full house'), ['full_house']);
  assert.deepEqual(matchDoors('nothing recognizable here'), []);
  // Caregiving-for-a-parent in plain words — the Door missed in testing (Joanne's 95-yo mom).
  assert.ok(matchDoors('taking care of my mother took over').includes('aging_parents'));
  assert.ok(matchDoors('caring for my 95 year old mom').includes('aging_parents'));
  assert.equal(matchDoors('more energy for my mom and my granddaughter').includes('aging_parents'), false); // a passing mention doesn't trip it
  // Joanne's full story surfaces BOTH doors, in canonical order.
  assert.deepEqual(matchDoors('bigger job, more responsibility, crazy hours — and caring for my 95 year old mom took over'), ['career_cliff', 'aging_parents']);
});

test('correctDoors fixes the marriage/young-kids mis-tag (Full House, not Empty Nest / Aging Parents)', () => {
  // Scott's story: married, then kids, wife's struggles became his to carry — the model wrongly tagged
  // aging_parents + empty_nest. Neither has any signal here, so both are corrected to The Full House.
  const narrative = 'When I got married. Then we had kids and she suffered and the responsibility fell on me. New job, alimony, gained weight.';
  assert.deepEqual(correctDoors(['aging_parents', 'empty_nest'], narrative), ['full_house']);
  // It keeps legitimately-signaled Doors alongside, and adds Full House.
  assert.deepEqual(correctDoors(['body'], narrative), ['body', 'full_house']);
  // It does NOT touch a genuine Empty Nest / Aging Parents story (their own signal is present).
  assert.deepEqual(correctDoors(['empty_nest'], 'the kids grew up and moved out, the house went quiet'), ['empty_nest']);
  assert.deepEqual(correctDoors(['aging_parents'], 'I became the one caring for my aging mother'), ['aging_parents']);
  // No Full House signal → leaves the model's doors alone.
  assert.deepEqual(correctDoors(['career_cliff'], 'my role was eliminated in a restructure'), ['career_cliff']);
});

test('full Reconnect output validates the contract together', () => {
  assert.equal(
    validateReconnectOutput({ reclaimList: five, doors: ['vanishing', 'body'], baselineIdScore: 42.5 }).ok,
    true,
  );
  const bad = validateReconnectOutput({ reclaimList: ['only', 'two'], doors: [], baselineIdScore: 130 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3); // list (too few) + doors (none) + score (out of range)
});
