import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { startPracticeWeek, PRACTICE_WINDOW_DAYS } from '../lib/practice/store.ts';
import { buildReview, reviewLine, isClosable, closeWeek } from '../lib/practice/close.ts';
import { buildRow } from '../lib/practice/grid.ts';

// CLOSING THE WEEK. Until now a week aged out silently — nothing reviewed it, nothing recorded it, and the member
// was never told it was over. Greg asked twice for the "ready for the next activity" prompt at the end, and a cycle
// can only have a LENGTH if its weeks can finish.
//
// Most of these tests are about TONE, because tone is the whole design here. A review that reads as a report card
// turns a practice into a performance, and the member stops logging honestly — which costs us the data too.

const row = (label: string, target: number | null, done: number) =>
  buildRow(label, label, target, '2026-08-03', Array.from({ length: done }, (_, i) => `2026-08-0${3 + i}`));

// ── the phrasing, line by line ────────────────────────────────────────────────────────────────────────────────

test('hitting the target is stated, not celebrated', () => {
  // Praise turns a practice into a performance. "Exactly what you aimed for" is the fact, warmly.
  const s = reviewLine(row('15 minutes of functional fitness', 5, 5));
  assert.match(s, /5 of 5\. Exactly what you aimed for\./);
  assert.doesNotMatch(s, /amazing|great job|well done|crushed|nailed/i);
});

test('going past it is noticed, not made heroic', () => {
  assert.match(reviewLine(row('Fruit at breakfast', 5, 6)), /6, past the 5 you set\./);
});

test('FALLING SHORT is stated plainly and then left alone', () => {
  // The line that matters most. No "only", no "just", no consolation bolted on — each of those tells the member you
  // think they failed. State the number; the silence after it is the respect.
  const s = reviewLine(row('15 minutes of functional fitness', 5, 4));
  assert.equal(s, '15 minutes of functional fitness — 4 of the 5 you aimed for.');
  assert.doesNotMatch(s, /\bonly\b|\bjust\b|but |at least|don'?t worry|next week/i);
});

test('a row with NO marks is honest without being a reproach', () => {
  const s = reviewLine(row('Fruit at breakfast', 5, 0));
  assert.match(s, /none this week\. It was there, waiting\./);
  assert.doesNotMatch(s, /failed|missed|slipped|should/i);
});

test('a row with no target never invents one to fall short of', () => {
  assert.equal(reviewLine(row('Moved my body', null, 3)), 'Moved my body — 3 days.');
  assert.equal(reviewLine(row('Moved my body', null, 0)), 'Moved my body — no days marked.');
  assert.equal(reviewLine(row('Moved my body', null, 1)), 'Moved my body — 1 day.', 'and it counts in English');
});

// ── the whole review ──────────────────────────────────────────────────────────────────────────────────────────

test('the review reads as noticing, and keeps their own numbers', () => {
  const r = buildReview({ kind: 'b3_pilot', rows: [row('Walk 15 minutes', 5, 4), row('Fruit at breakfast', 5, 6)] });
  assert.match(r.opener, /how it actually went/i);
  assert.deepEqual(r.lines, ['Walk 15 minutes — 4 of the 5 you aimed for.', 'Fruit at breakfast — 6, past the 5 you set.']);
  assert.match(r.keeperBody, /Walk 15 minutes — 4 of the 5/, 'the keeper carries the week, not a summary of it');
});

test('A WEEK WITH NOTHING MARKED gets the truth, not consolation and not a scold', () => {
  // Where a product is most tempted to either cheer someone up or tell them off. Both land as judgement. We don't
  // know what the week held, and saying so invites them to tell us — which is more use than either.
  const r = buildReview({ kind: 'b3_pilot', rows: [row('Walk', 5, 0), row('Fruit', 5, 0)] });
  assert.match(r.opener, /hard week, or just that logging slipped/i);
  assert.doesNotMatch(r.opener, /failed|disappoint|try harder|next time|shame/i);
  assert.doesNotMatch(r.opener, /amazing|proud|great/i);
});

// ── the mechanics ─────────────────────────────────────────────────────────────────────────────────────────────

test('a week is closable only once its window has elapsed', () => {
  const rows = [row('Walk', 5, 2)];
  assert.equal(isClosable({ day: 3, closed: false, rows }), false, 'mid-week is not over');
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: false, rows }), true);
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: true, rows }), false, 'and never twice');
  assert.equal(isClosable({ day: PRACTICE_WINDOW_DAYS, closed: false, rows: [] }), false, 'nothing to review');
});

test('closeWeek is idempotent — a close beat cannot fire twice', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name,email) values ('Greg','g@example.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  await startPracticeWeek(db, memberId, 'b3_pilot');

  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), true, 'the first close lands');
  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), false, 'the second is a no-op');
  const { rows } = await db.query<{ closed_at: string | null }>(
    `select closed_at from practice_week where member_id=$1 and kind='b3_pilot'`,
    [memberId],
  );
  assert.ok(rows[0]!.closed_at, 'and the week has genuinely ENDED rather than aged out');
});

// ── the seam: a finished week actually STOPS being active ─────────────────────────────────────────────────────

test('a closed week disappears from the grid, so the review cannot fire twice', async () => {
  // The whole point of closed_at. Before it, "active" meant "started less than 7 days ago", so a week ended by
  // silence and by arithmetic. A member who closed their week and came back must not be handed the review again.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name,email) values ('Greg','g@example.test') returning member_id`,
    )
  ).rows[0]!.member_id;

  // A week that opened 6 days ago -> today is day 7, the last day.
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1,'b3_pilot', now() - interval '6 days')`,
    [memberId],
  );
  const c = (
    await db.query<{ id: string }>(
      `insert into practice_commitment (member_id,kind,slot,label,target_days) values ($1,'b3_pilot','activity','Walk 15 minutes',5) returning id`,
      [memberId],
    )
  ).rows[0]!.id;
  for (const back of [6, 5, 3, 1]) {
    await db.query(
      `insert into practice_mark (member_id,kind,commitment_id,marked_on,source) values ($1,'b3_pilot',$2, current_date - $3::int,'grid')`,
      [memberId, c, back],
    );
  }

  const { weekGrid } = await import('../lib/practice/grid.ts');
  const before = (await weekGrid(db, memberId))!;
  assert.equal(before.day, PRACTICE_WINDOW_DAYS, 'day 7');
  assert.equal(before.closed, false);
  assert.equal(isClosable(before), true, 'the week is ready to be reviewed');
  assert.deepEqual(buildReview(before).lines, ['Walk 15 minutes — 4 of the 5 you aimed for.']);

  assert.equal(await closeWeek(db, memberId, 'b3_pilot'), true);

  const after = await weekGrid(db, memberId);
  assert.equal(after!.closed, true, 'the grid now knows it ended');
  assert.equal(isClosable(after!), false, 'and it will never be reviewed a second time');
});
