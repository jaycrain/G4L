import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReclaimList,
  validateDoor,
  validateReconnectOutput,
} from '../lib/member/reclaim.ts';
import { DOOR_SLUGS } from '../lib/doors.ts';

const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

test('reclaim list must be exactly 7 non-empty items', () => {
  assert.equal(validateReclaimList(seven).ok, true);
  assert.equal(validateReclaimList(seven.slice(0, 6)).ok, false);
  assert.equal(validateReclaimList([...seven, 'h']).ok, false);
  assert.equal(validateReclaimList(['a', 'b', 'c', 'd', 'e', 'f', '  ']).ok, false);
});

test('the 8 canonical doors validate; unknown doors do not', () => {
  assert.equal(DOOR_SLUGS.length, 8);
  for (const slug of DOOR_SLUGS) assert.equal(validateDoor(slug).ok, true);
  assert.equal(validateDoor('the_career').ok, false); // stale MA v1.1 name
  assert.equal(validateDoor('').ok, false);
});

test('full Reconnect output validates the frozen contract together', () => {
  assert.equal(
    validateReconnectOutput({ reclaimList: seven, door: 'vanishing', baselineIdScore: 42.5 }).ok,
    true,
  );
  const bad = validateReconnectOutput({ reclaimList: seven.slice(0, 5), door: 'nope', baselineIdScore: 130 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3); // list + door + score all flagged
});
