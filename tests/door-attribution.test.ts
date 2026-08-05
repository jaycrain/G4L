// A Door is an event in the MEMBER'S OWN life.
//
// Jennifer's story (2026-08-05) was about her father: he got sick, she held everything together, he died a month
// ago. In passing she mentioned that HIS second marriage had fallen apart, and — unprompted — that her own marriage
// was fine. She was tagged with the Marriage Door. Doors are shown to the member at intake, so the platform told
// her to her face that her marriage was what opened her Fade.
//
// Adding the rule to the model's prompt did not hold — a re-run of her live walk tagged marriage again. Hence a
// deterministic read of the member's own words, which outranks the model's judgement. The guard is NARROW on
// purpose: silence is not a contradiction.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorContradictedByMember, filterDoorsByAttribution } from '../lib/agent/door-attribution.ts';

// Her gap, close to verbatim from the live walk.
const JENNIFER_GAP =
  "Then about two years ago my dad got sick and it became my life: appointments, phone calls, managing everything. " +
  "He'd had a hard few years before that — his second marriage had fallen apart and he was pretty lost, so I was " +
  "already the person holding things steady for him. He died a month ago, and now I feel kind of blank. " +
  "My marriage is fine. Work was manageable. It was really just him.";

test("her father's divorce is not her Marriage Door", () => {
  assert.equal(doorContradictedByMember('marriage', JENNIFER_GAP), true);
});

test('the Doors that ARE hers survive the filter', () => {
  const kept = filterDoorsByAttribution(['aging_parents', 'body', 'marriage', 'loss', 'load_bearer'], JENNIFER_GAP);
  assert.deepEqual(kept, ['aging_parents', 'body', 'loss', 'load_bearer']);
  assert.ok(kept.includes('loss'), 'a death in the family IS her Loss — never filtered as "someone else\'s"');
  assert.ok(kept.includes('aging_parents'), 'a parent\'s decline IS her Door, by definition');
});

test('a member whose OWN marriage faded keeps the Door', () => {
  for (const own of [
    'My marriage turned into two people coexisting in the same house.',
    'We divorced three years ago and I have not been the same since.',
    'My husband and I stopped really talking somewhere in there.',
    'I got divorced at 44 and the whole shape of my life changed.',
  ]) {
    assert.equal(doorContradictedByMember('marriage', own), false, `must not drop: "${own}"`);
  }
});

test('SILENCE IS NOT A CONTRADICTION', () => {
  // The model can infer a Door from context the member never named outright. Only an actual contradiction drops it —
  // otherwise this guard would quietly become a second, worse tagger.
  const noMention = 'The last two years went to my father. Everything else stopped.';
  assert.equal(doorContradictedByMember('marriage', noMention), false);
  assert.equal(doorContradictedByMember('career_cliff', noMention), false);
});

test('an explicit denial kills the tag on its own', () => {
  assert.equal(doorContradictedByMember('marriage', 'My marriage is fine. It was never that.'), true);
  assert.equal(doorContradictedByMember('career_cliff', 'My job is fine, honestly. It was everything else.'), true);
});

test('someone else losing their job is not the member\'s Career Cliff', () => {
  const s = 'My husband was laid off last spring and I picked up the slack for a year.';
  assert.equal(doorContradictedByMember('career_cliff', s), true);
  const mine = 'I was laid off last spring and never really found my footing again.';
  assert.equal(doorContradictedByMember('career_cliff', mine), false);
});

test("a parent's diagnosis is not the member's Diagnosis", () => {
  assert.equal(doorContradictedByMember('diagnosis', 'My mother was diagnosed with dementia in 2023.'), true);
  assert.equal(doorContradictedByMember('diagnosis', 'I was diagnosed with MS in 2023.'), false);
});

test('Doors that are inherently about another person are NEVER filtered', () => {
  // loss is someone else dying; aging_parents is someone else declining. Filtering them on "whose life" would
  // delete the two most common real Doors in this program.
  const s = "His marriage fell apart, then he got sick, and he died a month ago.";
  assert.equal(doorContradictedByMember('loss', s), false);
  assert.equal(doorContradictedByMember('aging_parents', s), false);
  assert.equal(doorContradictedByMember('empty_nest', s), false);
  assert.equal(doorContradictedByMember('grind', s), false);
});

test('empty material and unknown slugs are inert', () => {
  assert.equal(doorContradictedByMember('marriage', ''), false);
  assert.equal(doorContradictedByMember('not_a_door', JENNIFER_GAP), false);
  assert.deepEqual(filterDoorsByAttribution([], JENNIFER_GAP), []);
});
