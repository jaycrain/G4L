import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reclaimAddIntent } from '../lib/member/reclaim.ts';

test('reclaimAddIntent · Jay walk: meta-preamble add is caught, wrapper stripped', () => {
  assert.equal(
    reclaimAddIntent("I'd like to add to the list. Have more energy to be involved in my kids' lives"),
    "Have more energy to be involved in my kids' lives",
  );
});

test('reclaimAddIntent · explicit add phrasings extract the want', () => {
  assert.equal(reclaimAddIntent('add ride the Alps with my brother to my list'), 'ride the Alps with my brother');
  assert.equal(reclaimAddIntent('can you add golf on weekends'), 'golf on weekends');
  assert.equal(reclaimAddIntent('please add more time reading to my reclaim list'), 'more time reading');
  assert.equal(reclaimAddIntent('I want to add getting back to painting'), 'getting back to painting');
  assert.equal(reclaimAddIntent('put travel to Europe on my list'), 'travel to Europe');
});

test('reclaimAddIntent · positional "put X at the top" is a REORDER, not an add', () => {
  assert.equal(reclaimAddIntent('put race Moab at the top'), null);
  assert.equal(reclaimAddIntent('move the riding one up'), null);
});

test('reclaimAddIntent · a want merely MENTIONED (no add cue) is NOT auto-captured', () => {
  assert.equal(reclaimAddIntent('I miss riding my bike on the weekends'), null);
  assert.equal(reclaimAddIntent('honestly I just want to feel like myself again'), null);
  assert.equal(reclaimAddIntent("I'm tired and a bit stuck this week"), null);
  assert.equal(reclaimAddIntent('I raised the round, that one is done'), null);
});

test('reclaimAddIntent · empty / trivial → null', () => {
  assert.equal(reclaimAddIntent(''), null);
  assert.equal(reclaimAddIntent('add'), null); // no want
});
