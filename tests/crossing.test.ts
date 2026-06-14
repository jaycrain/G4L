import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossingToShow } from '../lib/curriculum/crossing.ts';

test('announces crossing into a new R once (then never again once seen)', () => {
  const c = crossingToShow('rewire', null);
  assert.ok(c);
  assert.equal(c!.prevLabel, 'Reconnect');
  assert.equal(c!.newLabel, 'Rewire');
  assert.match(c!.blurb, /rewiring/i);
  // already shown → no repeat
  assert.equal(crossingToShow('rewire', 'rewire'), null);
});

test('the start (Reconnect) is not a crossing', () => {
  assert.equal(crossingToShow('reconnect', null), null);
});

test('crossing into Rebuild after having seen Rewire still fires', () => {
  const c = crossingToShow('rebuild', 'rewire');
  assert.ok(c);
  assert.equal(c!.prevLabel, 'Rewire');
  assert.equal(c!.newLabel, 'Rebuild');
});
