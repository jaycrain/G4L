// DONNA'S COMPLAINTS, AS CHECKS THAT RUN WITHOUT DONNA.
//
// Two of these existed already — as PHRASES her persona was scripted to say ("that felt really rushed", "didn't we
// just do that"). That has two holes: the persona model has to REMEMBER to say them, and they only existed on her,
// so the same failure happening to Rita fired nothing at all.
//
// These run for every persona, off the transcript. And they are tested here for the reason this repo keeps
// relearning: a detector whose firing path has never run is not a detector, it is a decoration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIPWIRES } from '../scripts/walk-tripwires.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

const fire = (id: string, agent: string[], member: string[] = [], c: Collected = {} as Collected, complete = false) =>
  TRIPWIRES.find((t) => t.id === id)!.check(agent, member, c, complete);

test('RUSHED — naming the Reclaim List without saying what it is', () => {
  // Her rule, verbatim from her persona: naming it AND saying what it is for in the same message — "even in the
  // same sentence" — counts as explained.
  assert.ok(fire('RUSHED', ['Now, your Reclaim List. Put them down below.']), 'fires on a bare naming');
  assert.equal(
    fire('RUSHED', ['Your Reclaim List is who you are reclaiming, turned into concrete goals. What comes to mind?']),
    null, 'stays silent when the same message explains it',
  );
  assert.equal(fire('RUSHED', ['Tell me about who you were.']), null, 'silent when the list is not mentioned at all');
});

test('REPEATED — the SEMANTIC sibling of the verbatim check', () => {
  // v3.5.55 fixed byte-identical repeats. She was complaining about being asked the same thing in different words,
  // which a string comparison cannot see.
  const a = 'Put them down here in your own words, big or small, three to start you off.';
  const b = 'Put them down here in your own words, big or small, three to start us off.';
  assert.ok(fire('REPEATED', [a, b]), 'fires on near-identical consecutive turns');
  assert.equal(fire('REPEATED', [a, 'What happened after the layoff?']), null, 'silent on genuinely different turns');
  assert.equal(fire('REPEATED', ['Short one.', 'Short two.']), null, 'silent on turns too short to judge');
});

test('PROSE-AS-ITEM — a conversational sentence captured as a list item', () => {
  // Her 2026-08-27 walk: "if you try to type something in conversationally it puts it down verbatim as an item."
  const said = 'I think I want to get back to riding my bike on the weekends like I used to before the injury';
  assert.ok(
    fire('PROSE-AS-ITEM', [], [said], { reclaimList: [said] } as Collected),
    'fires when a whole spoken sentence is the list item',
  );
  assert.equal(
    fire('PROSE-AS-ITEM', [], [said], { reclaimList: ['ride my bike'] } as Collected),
    null, 'silent when the item is a distilled want rather than her sentence',
  );
});

test('LEFT-HANGING — the conversation ends with nothing to answer', () => {
  // Her Rewire walk: "it left me hanging on my first true line."
  assert.ok(fire('LEFT-HANGING', ['That lands.']), 'fires when the last turn asks nothing');
  assert.equal(fire('LEFT-HANGING', ['That lands. What happened next?']), null, 'silent when it asks something');
  // A COMPLETED onboarding ends on a handoff, which has no question by design. Missing this fired the tripwire on
  // all six personas on its first live run — every one a false alarm, which is how a report stops being read.
  assert.equal(
    fire('LEFT-HANGING', ['You are now officially into the first Phase of G4L — Reconnect. Well done!'], [], {} as Collected, true),
    null, 'silent on the completion handoff',
  );
});

test('every tripwire records HER words, so nobody edits one without meeting the complaint', () => {
  for (const t of TRIPWIRES) {
    assert.ok(t.hers && t.hers.length > 8, `${t.id} carries the complaint it came from`);
  }
});
