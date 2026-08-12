import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composeQualityDay, composeRefinedList } from '../lib/agent/reclaim.ts';

// RECLAIM HAS TO PUT SOMETHING IN THE PLAYBOOK.
//
// Jay finished C1, C2, C3 and C4 on his own account in ninety minutes and his play count did not move — "even
// though things are being added, I've been stuck on 14 for awhile". It was honest: Rewire and Rebuild each commit
// a keeper at their close, and Reclaim's arc route committed none. C3's Quality Day is the first, built on B3's
// shape rather than a new one, because a Quality Day is the Reclaim-phase sibling of the Lifestyle Pilot.

test('the play is THEIR words, joined — never summarised', () => {
  const body = composeQualityDay({
    nonNegotiables: ['bike ride', 'Food as fuel not entertainment'],
    contributors: ["Getting a good night's sleep"],
    disruptors: ['Arguing with my wife'],
  });
  assert.match(body, /bike ride/);
  assert.match(body, /Food as fuel not entertainment/);
  assert.match(body, /Getting a good night's sleep/);
  assert.match(body, /Arguing with my wife/, 'what wrecks a day is as much theirs as what makes it');
  // The labels are ours; nothing between them may be.
  assert.equal(body.split('\n').length, 3);
});

test('AN EMPTY SECTION IS OMITTED, never rendered as a blank heading', () => {
  // A member who named non-negotiables and stopped has not failed at anything, and a bare "Gets in the way —"
  // would read as though they had.
  const body = composeQualityDay({ nonNegotiables: ['bike ride'], contributors: [], disruptors: [] });
  assert.equal(body, 'Non-negotiable — bike ride');
  assert.doesNotMatch(body, /Helps|Gets in the way/);
});

test('blank and whitespace-only entries are dropped, not printed as gaps', () => {
  const body = composeQualityDay({ nonNegotiables: ['bike ride', '  ', ''], contributors: [' '], disruptors: [] });
  assert.equal(body, 'Non-negotiable — bike ride');
});

test('C3 COMMITS THE PLAY AT ITS CLOSE — and cannot cost the profile or the week if it fails', () => {
  // The three writes are separately guarded and ordered: profile, then week, then play. That ordering is the
  // point — the play is the least important of the three, and a throw in it must not unwind the two that already
  // landed (the harvest silent-drop lesson, where one throw inside a shared try aborted a successful commit).
  // COMMENTS STRIPPED FIRST. The block explains itself, so it CONTAINS the words this test looks for — the first
  // run matched `harvestSignal` inside a comment about harvestSignal and reported the call missing. That is the
  // fifth time this week an assertion has matched the prose describing the code instead of the code.
  const raw = readFileSync(new URL('../app/reclaim/actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const c3 = src.slice(src.indexOf("if (session === 'c3')"), src.indexOf("const turn = state.stage === 'refine'"));
  assert.match(c3, /await harvestSignal\(/, 'C3 commits a Playbook play');
  assert.match(c3, /composeQualityDay\(qd\)/, 'from the profile the member just confirmed');
  assert.match(c3, /label: 'Your Quality Days'/, 'named the same as its practice week');
  assert.match(c3, /keeperType: 'plan'/, "so it lands on What worked, beside B3's pilot");

  const profileAt = c3.indexOf('persistQualityDayProfile');
  const weekAt = c3.indexOf('startPracticeWeek');
  const playAt = c3.indexOf('await harvestSignal(');
  assert.ok(profileAt < weekAt && weekAt < playAt, 'profile, then week, then play');
  // Each in its OWN try — a shared one is how a later failure eats an earlier success.
  const between = c3.slice(weekAt, playAt);
  assert.match(between, /try \{/, 'the play has its own try, not the week’s');
});

test('C1 COMMITS A PLAY — in the order the member put their list', () => {
  const raw = readFileSync(new URL('../app/reclaim/actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /composeRefinedList\(/, 'C1 writes its refined list as a play');
  assert.match(src, /label: 'Your Reclaim List, refined'/);
});

test('the play keeps THEIR order — top3 is the member’s own, and nothing re-sorts it', () => {
  // Looking Forward exists to put the starred item on top. Re-deciding that order in a second place is how two
  // surfaces start disagreeing about which item matters most.
  const body = composeRefinedList(['Finish top 20% at Big Sugar', 'Hard training rides', 'Core work']);
  assert.equal(body, 'Taking back — Finish top 20% at Big Sugar · Hard training rides · Core work');
});

test('nothing confirmed means NO play — never an empty heading', () => {
  assert.equal(composeRefinedList([]), null);
  assert.equal(composeRefinedList(['', '   ']), null);
});

test('C2 AND C4 WRITE NO PLAY — recorded as decisions, not left as gaps', () => {
  // Both are deliberate and both have a stated trigger for revisiting. Asserted so a later reader does not "fix"
  // the absence: C2's output is already a computed read (a play would duplicate an always-current surface), and
  // C4 produces a SCORE, so a play would mean composing member words they never said.
  const raw = readFileSync(new URL('../app/reclaim/actions.ts', import.meta.url), 'utf8');
  assert.match(raw, /C2 WRITES NO PLAY, AND THAT IS A DECISION/, 'C2’s reason is written down');
  assert.match(raw, /C4 WRITES NO PLAY EITHER/, 'and so is C4’s');

  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const c2 = src.slice(src.indexOf("if (session === 'c2')"), src.indexOf("if (session === 'c3')"));
  assert.doesNotMatch(c2, /await harvestSignal\(/, 'C2 really does not commit one');
});
