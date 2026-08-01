import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFor, membersCard, idScoreCard, BARS_MIN } from '../lib/founder/cards.ts';

// A card is built from the TOOL RESULT, never from the model's prose. That is the whole point: the answer
// above it can be loose ("a couple of people"); the card underneath is the rows the query returned. These
// pin the properties that make it trustworthy rather than decorative.

const m = (over: Partial<Parameters<typeof membersCard>[1][number]> = {}) => ({
  name: 'Donna Crain', memberId: 'd1', phase: 'Rewire', idScore: 55, idDirection: 'up',
  sessionsClosed: 2, sessionsOpen: 1, daysSinceActive: 1, ...over,
});

test('the members card carries ids, so a name is never a dead end', () => {
  const c = membersCard('stalled', [m()])!;
  assert.equal(c.kind, 'table');
  assert.deepEqual(c.kind === 'table' ? c.memberIds : [], ['d1'], 'the row must link to the person');
});

test('"waiting on" says what to DO, not just a number', () => {
  // "1" tells you to go and look; "1d · 1 Session open" tells you what happened. That difference is the
  // operator surface's entire job.
  const open = membersCard('stalled', [m({ sessionsOpen: 1, daysSinceActive: 1 })])!;
  assert.match(String((open as never as { rows: { waiting: string }[] }).rows[0]!.waiting), /1d · 1 Session open/);
  const done = membersCard('all', [m({ sessionsOpen: 0, sessionsClosed: 4, daysSinceActive: 0 })])!;
  assert.match(String((done as never as { rows: { waiting: string }[] }).rows[0]!.waiting), /today · 4 closed/);
});

test('no rows means NO card — an empty table under an answer is noise', () => {
  assert.equal(membersCard('stalled', []), null);
});

test('the ID Score chart waits until it can say something', () => {
  // Two bars is a comparison, not a picture, and the table already carries the number. Decoration on an
  // operator surface is worse than nothing.
  assert.equal(idScoreCard([m(), m({ memberId: 'x' })]), null, `fewer than ${BARS_MIN} scored → no chart`);
  assert.ok(idScoreCard([m(), m({ memberId: 'x' }), m({ memberId: 'y' })]), 'three is a shape');
});

test('a member with no ID Score is "—", never a zero', () => {
  // An absent IDQ is not a low score. Drawing it as one is the false-zero this console keeps rooting out.
  const c = idScoreCard([m(), m({ memberId: 'x' }), m({ memberId: 'y' }), m({ memberId: 'z', idScore: null, idDirection: null })])!;
  const bar = (c as never as { bars: { value: number | null; tone: string }[] }).bars[3]!;
  assert.equal(bar.value, null);
  assert.equal(bar.tone, 'none');
});

test('cardFor attaches a chart only when the question was about EVERYONE', () => {
  const members = [m(), m({ memberId: 'x' }), m({ memberId: 'y' })];
  const stalled = cardFor('find_members', { filter: 'stalled' }, { members });
  assert.equal(stalled.length, 1, '"who is stalled" wants the list, not a ranking of the cohort');
  const all = cardFor('find_members', { filter: 'all' }, { members });
  assert.equal(all.length, 2, 'asking about everyone earns the chart');
});

test('tools whose answer belongs in PROSE get no card', () => {
  // member_detail is one person's private record — laying it out as data is the wrong register entirely.
  assert.deepEqual(cardFor('member_detail', { name: 'Donna' }, { found: true, reclaimList: [] }), []);
  assert.deepEqual(cardFor('operations_status', {}, { draftsAwaitingYourApproval: 2 }), []);
});
