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
