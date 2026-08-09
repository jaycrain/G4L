import './helpers/with-phase-flags.ts'; // asset ids + phase gating differ between the flagged and unflagged programs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import { weekGrid } from '../lib/practice/grid.ts';
import { persistQualityDayProfile, activeQualityDayProfile } from '../lib/reclaim/quality-day-store.ts';

// CAN A BROKEN QUALITY DAYS WEEK BE RECOVERED?
//
// Jay hit a running c3_quality week with NO rows: the week opened, the profile didn't store, and for c3 the rows
// ARE the profile. The coupling fix stops the next member landing there — it does nothing for someone already in
// it. I told him "re-running C3 is the recovery" and then had to admit that was an assumption. This tests it.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('THE BROKEN STATE reproduces: a c3 week with no profile has no rows', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'c3_quality'); // week opens, profile never stored — Jay's exact state
  const grid = await weekGrid(db, memberId);
  assert.equal(grid?.kind, 'c3_quality', 'the week is genuinely running');
  assert.deepEqual(grid?.rows, [], 'and it can never fill — the rows ARE the profile');
});

test('RECOVERY WORKS: storing the profile fills the existing week, no new week needed', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'c3_quality');

  // What re-running C3 does at the data layer (the live turn calls exactly this).
  await persistQualityDayProfile(db, memberId, {
    nonNegotiables: ['Out the door before the house wakes up', 'One real conversation'],
    contributors: ['Something that isn’t a screen'],
    disruptors: [],
  });

  const grid = await weekGrid(db, memberId);
  assert.equal(grid?.rows.length, 3, 'non-negotiables + contributors become the rows');
  assert.match(grid!.rows[0]!.label, /before the house wakes up/);
  assert.equal(await activeQualityDayProfile(db, memberId) !== null, true);
});

test('a SECOND profile supersedes the first — re-running C3 does not stack stale rows', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'c3_quality');
  await persistQualityDayProfile(db, memberId, { nonNegotiables: ['old one'], contributors: [], disruptors: [] });
  await persistQualityDayProfile(db, memberId, { nonNegotiables: ['the new one', 'and another'], contributors: [], disruptors: [] });
  const grid = await weekGrid(db, memberId);
  assert.deepEqual(grid!.rows.map((r) => r.label), ['the new one', 'and another'], 'most-recent-active wins');
});

test('RE-RUNNING C3 RESTARTS THE WEEK AT DAY 1 — the cost of recovery, stated', async () => {
  // startPracticeWeek is `on conflict do update set started_at = now()`. So a member who recovers on day 3 loses
  // those days and starts over. That is a real consequence of the recovery path and it should be a decision, not
  // a surprise — recovering the PROFILE alone (without touching the week) keeps their days.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1,'c3_quality', now() - interval '3 days')`,
    [memberId],
  );
  assert.equal((await weekGrid(db, memberId))?.day, 4, 'three days in');

  await startPracticeWeek(db, memberId, 'c3_quality'); // what a full C3 re-run does
  assert.equal((await weekGrid(db, memberId))?.day, 1, 'and they are back to day 1');
});

// ---------------------------------------------------------------------------------------------------------------
// THE TIE. The test above ('a SECOND profile supersedes the first') passed almost always and failed occasionally,
// which is the worst way for a bug to present: it looks like the suite is unreliable rather than like the code is
// wrong. The cause was that "most-recent-active-wins" lived in the READER's `order by created_at desc limit 1` while
// every old row stayed marked 'active'. Two rows with the same created_at → the database may return either → the
// STALE Quality-Day definition can win, and the member's week tracks a definition they replaced.
//
// These tests FORCE the tie instead of waiting to be unlucky. Verifying in the failing condition rather than the
// convenient one is the whole point — the intermittent test could never have proven the fix.

async function tiedProfiles(db: Db, memberId: string): Promise<void> {
  // Both rows at one fixed instant. Written straight to SQL because persistQualityDayProfile uses now(), and the
  // point is to reproduce the collision the fix has to survive.
  const at = '2026-08-01 12:00:00+00';
  for (const nn of [['old one'], ['the new one', 'and another']]) {
    await db.query(
      `insert into coaching_plan (member_id, phase, payload, status, created_at)
       values ($1,'reclaim',$2::jsonb,'active',$3::timestamptz)`,
      [memberId, JSON.stringify({ kind: 'quality_day_profile', nonNegotiables: nn, contributors: [], disruptors: [] }), at],
    );
  }
}

test('TIE REPRODUCED: two profiles at the SAME instant is genuinely ambiguous without the fix', async () => {
  const { db, memberId } = await freshDb();
  await tiedProfiles(db, memberId);
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from coaching_plan where member_id=$1 and status='active'`,
    [memberId],
  );
  assert.equal(rows[0]!.n, 2, 'both rows claim to be active — this is the state the reader had to guess from');
});

test('THE FIX: a new profile RETIRES the old one, so there is nothing left to tie-break', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'c3_quality');
  await tiedProfiles(db, memberId); // two tied, ambiguous rows already in place

  // Now write through the real path. It must leave exactly ONE active row — its own.
  await persistQualityDayProfile(db, memberId, {
    nonNegotiables: ['the only one that counts'], contributors: [], disruptors: [],
  });

  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from coaching_plan
      where member_id=$1 and status='active' and payload->>'kind'='quality_day_profile'`,
    [memberId],
  );
  assert.equal(rows[0]!.n, 1, 'exactly one active profile — the invariant is in the DATA now, not in the ORDER BY');

  const profile = await activeQualityDayProfile(db, memberId);
  assert.deepEqual(profile?.nonNegotiables, ['the only one that counts']);
  const grid = await weekGrid(db, memberId);
  assert.deepEqual(grid!.rows.map((r) => r.label), ['the only one that counts'], 'and the week tracks it');
});

test('the retire is KIND-SCOPED — it must not touch an unrelated reclaim plan', async () => {
  // coaching_plan is shared across phases and payload shapes. A phase-only retire would mark a neighbour's active
  // reclaim plan superseded as a side effect of defining a Quality Day.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into coaching_plan (member_id, phase, payload, status)
     values ($1,'reclaim',$2::jsonb,'active')`,
    [memberId, JSON.stringify({ kind: 'some_other_reclaim_plan', keep: true })],
  );
  await persistQualityDayProfile(db, memberId, { nonNegotiables: ['mine'], contributors: [], disruptors: [] });

  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from coaching_plan
      where member_id=$1 and status='active' and payload->>'kind'='some_other_reclaim_plan'`,
    [memberId],
  );
  assert.equal(rows[0]!.n, 1, 'the unrelated plan is untouched');
});

test('a FAILED retire degrades to the old behaviour, never to "no active plan"', async () => {
  // Why the insert comes BEFORE the retire. These are two best-effort statements with no transaction around them,
  // so the question that matters is what each failure leaves behind. Retire-then-insert would, on a failed insert,
  // leave the member with NOTHING active — worse than the stale-row bug. Insert-then-retire cannot: the new row is
  // already committed, so the worst case is two actives and newest-wins, which is exactly where we started.
  const { db, memberId } = await freshDb();
  await persistQualityDayProfile(db, memberId, { nonNegotiables: ['first'], contributors: [], disruptors: [] });
  assert.equal((await activeQualityDayProfile(db, memberId))?.nonNegotiables[0], 'first');

  // Simulate the retire never happening by inserting the second row raw (insert succeeded, retire did not).
  await db.query(
    `insert into coaching_plan (member_id, phase, payload, status) values ($1,'reclaim',$2::jsonb,'active')`,
    [memberId, JSON.stringify({ kind: 'quality_day_profile', nonNegotiables: ['second'], contributors: [], disruptors: [] })],
  );
  assert.equal(
    (await activeQualityDayProfile(db, memberId))?.nonNegotiables[0],
    'second',
    'two actives with distinct timestamps still resolve newest-first — no worse than before the fix',
  );
});
