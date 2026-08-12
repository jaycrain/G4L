import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinSystem, type CheckinContext } from '../lib/agent/checkin.ts';

// THE COMPANION KNOWS THE WEEK.
//
// CLAUDE.md: "no data the member can see should be invisible to the agent." The week grid shipped on the morning of
// 2026-08-07 and a sweep that afternoon found the Companion couldn't see it — a member could be looking at "3 / 5"
// on their own dashboard while the agent knew nothing about the week at all. Found by auditing member-visible tables
// against CheckinContext, not by anyone noticing in conversation, which is exactly how it should be caught.

const base = {
  displayName: 'Greg',
  identityNoun: 'Athlete',
  doorDisplayNames: ['The Body'],
  idScore: 61,
  reclaimList: ['ride again'],
} as unknown as CheckinContext;

const withWeek = (over: Partial<NonNullable<CheckinContext['practiceWeek']>> = {}): CheckinContext =>
  ({
    ...base,
    practiceWeek: {
      kind: 'b3_pilot',
      day: 4,
      days: 7,
      tappable: true,
      rows: [
        { label: '15 minutes of functional fitness', target: 5, done: 2, todayDone: false },
        { label: 'A piece of fruit with breakfast', target: 5, done: 3, todayDone: true },
      ],
      ...over,
    },
  }) as CheckinContext;

test('the week reaches the agent in the member’s own words and numbers', () => {
  const p = checkinSystem(withWeek());
  assert.match(p, /day 4 of 7/i);
  assert.match(p, /15 minutes of functional fitness — 2 of the 5 they aimed for/);
  assert.match(p, /A piece of fruit with breakfast — 3 of the 5 they aimed for, already marked today/);
});

test('and it is framed as noticing, never as compliance', () => {
  // The whole posture of the practice week: a productive default, never a gate. If this line ever reads as a
  // scoreboard the agent will start grading them with it.
  const p = checkinSystem(withWeek());
  assert.match(p, /NEVER present this as compliance or a score/i);
  assert.match(p, /A blank day is a day, not a miss/i);
});

test('no target → no invented denominator in the agent’s context either', () => {
  // The grid never renders a "/ 7" the member didn't choose. The prompt must not smuggle one in behind it.
  const p = checkinSystem(withWeek({ rows: [{ label: 'Moved my body', target: null, done: 2, todayDone: false }] }));
  assert.match(p, /Moved my body — 2 so far/);
  assert.doesNotMatch(p, /Moved my body — 2 of the/);
});

test('when today is already fully marked, the agent is told NOT to ask again', () => {
  // Being asked for something you already did is the most deflating thing a practice week can do.
  const p = checkinSystem(withWeek({
    rows: [{ label: '15 minutes of functional fitness', target: 5, done: 3, todayDone: true }],
  }));
  assert.match(p, /already marked/i);
  assert.match(p, /Don't ask again/i);
});

test('a MIRROR week (W3/C3) tells the agent to reflect it, never edit it', () => {
  const p = checkinSystem(withWeek({ kind: 'c3_quality', tappable: false }));
  assert.match(p, /mirrors a log they keep themselves; reflect it, never edit it/i);
  assert.doesNotMatch(p, /mark_practice_day/, 'and it is not told about a tool it will not be given');
});

test('no active week → the line is absent entirely, not an empty stub', () => {
  const p = checkinSystem(base);
  assert.doesNotMatch(p, /practice week is on day/i);
});

test('an empty-row week is treated as no week (W2 has nothing countable)', () => {
  const p = checkinSystem({ ...base, practiceWeek: { kind: 'w2_image', day: 2, tappable: false, rows: [] } } as CheckinContext);
  assert.doesNotMatch(p, /practice week is on day/i);
});
