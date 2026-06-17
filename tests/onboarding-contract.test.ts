import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contractGaps,
  contractMet,
  gapIsNarrative,
  buildSummaryCard,
  doorsToConfirm,
} from '../lib/agent/onboarding-contract.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

// Regression harness: every onboarding failure we've hit in testing, frozen as a contract case.
// The contract is the single gate — a member is NOT done until every case here is satisfied.

test('gapIsNarrative: a fade STORY passes; a restated goal or a stub fails', () => {
  // Joanne run 2's actual failure — a Reclaim-List goal captured where the fade story belongs.
  assert.equal(gapIsNarrative("I'd like to lose 30 lbs"), false);
  assert.equal(gapIsNarrative('I want to get back in shape'), false);
  assert.equal(gapIsNarrative('lose 30 lbs', ['lose 30 lbs']), false); // verbatim reclaim item
  assert.equal(gapIsNarrative('tired'), false); // too short to be a story
  // Real narratives — including Greg's no-deficit "how/why" story — pass.
  assert.equal(gapIsNarrative('The career grew bigger and at the same time mom needed full-time caring; both landed at once and there was no room left for the Friend.'), true);
  assert.equal(gapIsNarrative("No pressing issues — just the growing awareness in my 60s that the window for bigger adventures won't stay open forever."), true);
  assert.equal(gapIsNarrative('My role was eliminated in a restructure and the riding quietly stopped.'), true);
});

test('JOANNE run 2 (the showstopper): door tagged but gap is a goal → NOT complete, missing gap', () => {
  // Exactly what was captured in her fresh run: identity + a 6-item list + doors, but gap="lose 30 lbs".
  const joanne2: Collected = {
    athleticPast: 'The person who organized parties and held the group together',
    identityNoun: 'Connector',
    reclaimList: ['Walk 3x a week with husband', 'Apple Fitness workouts', 'Lose 30 lbs', 'Friends over every other weekend', 'Concerts and Cub games', 'Time with Denise'],
    reclaimCategories: ['physical', 'physical', 'physical', 'social', 'social', 'social'],
    doors: ['aging_parents', 'empty_nest'],
    gap: "I'd like to lose 30 lbs",
  };
  assert.equal(contractMet(joanne2), false, 'must not hand off without the fade story');
  assert.deepEqual(contractGaps(joanne2), ['gap']);
  assert.equal(buildSummaryCard(joanne2).ready, false, 'the summary card cannot be presented as ready');
});

test('JOANNE run 1 (good): a real fade narrative → complete', () => {
  const joanne1: Collected = {
    athleticPast: 'A person who had time for friends and fun before work and caring for my mother took over',
    identityNoun: 'Friend',
    reclaimList: ['Walk + Apple Fitness 3 days a week', 'Eat well', 'Read a few days a week', 'Daily connection with Denise', 'More energy for family'],
    doors: ['career_cliff', 'aging_parents'],
    gap: 'The career grew bigger — longer hours, a global team — at the same time mom needed full-time caring. Both landed at once and there was no room left for the Friend.',
  };
  assert.equal(contractMet(joanne1), true);
  assert.deepEqual(contractGaps(joanne1), []);
  const card = buildSummaryCard(joanne1);
  assert.equal(card.ready, true);
  assert.equal(card.identityLabel, 'the Friend');
  assert.deepEqual(card.doors.map((d) => d.slug), ['career_cliff', 'aging_parents']);
});

test('GREG (no-deficit): a forward-looking "why" still satisfies the gap requirement', () => {
  const greg: Collected = {
    athleticPast: 'Someone who finds peak experiences in nature and adventure',
    identityNoun: 'Adventurer',
    reclaimList: ['Daily bike commute', 'Long gravel rides weekly', 'Solo bikepacking trips', 'Weekly sourdough', 'Cook with my wife most nights'],
    doors: ['body'],
    gap: 'No drift — just the growing awareness in my 60s that the window for bigger, more rigorous adventures will not stay open forever.',
  };
  assert.equal(contractMet(greg), true, 'a thriving member with a real "why" completes');
});

test('contract catches each missing slot independently', () => {
  const base: Collected = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped' };
  assert.equal(contractMet(base), true);
  assert.deepEqual(contractGaps({ ...base, athleticPast: undefined }), ['athleticPast']);
  assert.deepEqual(contractGaps({ ...base, identityNoun: undefined }), ['identity']);
  assert.deepEqual(contractGaps({ ...base, identityNoun: undefined, identitySkipped: true }), [], 'opt-out counts as identity');
  assert.deepEqual(contractGaps({ ...base, reclaimList: ['a', 'b'] }), ['reclaimList']);
  // Doors are NOT a contract gap — routing is optional (Taxonomy Spec §1). A real Fade with a clear
  // gap story and NO Door is a complete, valid intake.
  assert.deepEqual(contractGaps({ ...base, doors: [] }), [], 'null routing is complete');
  assert.equal(contractMet({ ...base, doors: [] }), true, 'a real Fade completes with no Door');
  assert.deepEqual(contractGaps({ ...base, gap: undefined }), ['gap']);
});

test('doorsToConfirm flags Doors not grounded in the fade story (Blake: The Body, and a matcher-missed Career Cliff)', () => {
  // Blake committed [career_cliff, body, loss]. His gap is a decade of losses → matchDoors(gap) = loss.
  // The Body (from his fitness Reclaim List) and Career Cliff (phrased as "career turbulence", which
  // the matcher misses) aren't traceable to the fade story → both flagged for "was this confirmed?".
  const gap = "Lost his dad unexpectedly, then his mom after a long Alzheimer's battle, and a painful breakup — a decade of stacking losses.";
  assert.deepEqual(doorsToConfirm(['career_cliff', 'body', 'loss'], gap), ['career_cliff', 'body']);
  // A gap-grounded Door is never flagged.
  assert.deepEqual(doorsToConfirm(['loss'], gap), []);
  // No doors → nothing.
  assert.deepEqual(doorsToConfirm([], gap), []);
});

test('buildSummaryCard renders the confirmable card from collected state', () => {
  const c: Collected = {
    athleticPast: 'x', identityNoun: 'Connector',
    reclaimList: ['Time with Denise', 'Friends over monthly', 'Concerts again'],
    doors: ['aging_parents'],
    gap: 'My mother needed full-time care and the social life quietly fell away.',
  };
  const card = buildSummaryCard(c);
  assert.equal(card.ready, true);
  assert.equal(card.identityLabel, 'the Connector');
  assert.deepEqual(card.doors, [{ slug: 'aging_parents', displayName: 'The Aging Parents' }]);
  assert.equal(card.reclaimList.length, 3);
  assert.match(card.gap, /full-time care/);
});
