import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReclaimList,
  validateDoors,
  validateReconnectOutput,
  RECLAIM_LIST_MIN,
} from '../lib/member/reclaim.ts';
import { DOOR_SLUGS, matchDoors } from '../lib/doors.ts';

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
