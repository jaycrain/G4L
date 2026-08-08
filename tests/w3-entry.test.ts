import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { recordW3Entry, w3Entries } from '../lib/rewire/w3-entry.ts';

// W3's daily entry — the seven fields.
//
// Most of these are POSTURE tests. Greg's requirements for this tracker are unusually specific about tone and
// they are all expressible as data constraints: good calls and false starts must be the same kind of thing, an
// entry must be completable in under a minute, and "didn't say" must stay distinguishable from "no".

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('W','w3e@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('a minimal entry — one good call and nothing else — is valid', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await recordW3Entry(db, memberId, { goodCalls: 'walked instead of driving' }), true);
  const [e] = await w3Entries(db, memberId);
  assert.equal(e!.goodCalls, 'walked instead of driving');
  assert.equal(e!.falseStarts, null, 'nothing is invented to fill the other fields');
});

test('a false start ALONE is equally valid — same weight, no extra ceremony', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await recordW3Entry(db, memberId, { falseStarts: 'skipped it entirely' }), true);
  const [e] = await w3Entries(db, memberId);
  assert.equal(e!.falseStarts, 'skipped it entirely');
  assert.equal(e!.goodCalls, null, 'a day with only a false start is a logged day, not an incomplete one');
});

test('recovery_used stays TRI-STATE — null is "didn\'t say", not "no"', async () => {
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { goodCalls: 'caught it early', entryDate: '2026-08-01' });
  await recordW3Entry(db, memberId, { falseStarts: 'slipped', recoveryUsed: false, entryDate: '2026-08-02' });
  await recordW3Entry(db, memberId, { falseStarts: 'slipped', recoveryUsed: true, entryDate: '2026-08-03' });
  const byDate = Object.fromEntries((await w3Entries(db, memberId, 60)).map((e) => [e.entryDate, e.recoveryUsed]));
  assert.equal(byDate['2026-08-01'], null, 'defaulting this to false would record a failure they never reported');
  assert.equal(byDate['2026-08-02'], false);
  assert.equal(byDate['2026-08-03'], true);
});

test('an entirely empty entry is NOT recorded — an opened form is not a logged day', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await recordW3Entry(db, memberId, {}), false);
  assert.equal(await recordW3Entry(db, memberId, { goodCalls: '   ', reflection: '' }), false);
  assert.deepEqual(await w3Entries(db, memberId), [], 'the grid must not mark a day the member never spoke on');
});

test('amending a day ADDS without erasing — morning good call survives an evening false start', async () => {
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { goodCalls: 'walked at lunch', entryDate: '2026-08-05' });
  await recordW3Entry(db, memberId, { falseStarts: 'ordered in again', entryDate: '2026-08-05' });
  const all = await w3Entries(db, memberId, 60);
  assert.equal(all.length, 1, 'one row per day — never two records of the same date');
  assert.equal(all[0]!.goodCalls, 'walked at lunch', 'the earlier entry must survive the later one');
  assert.equal(all[0]!.falseStarts, 'ordered in again');
});

test('the trigger they name is stored as given, including "new"', async () => {
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { falseStarts: 'late night', triggerSlot: 'trigger-2', entryDate: '2026-08-06' });
  await recordW3Entry(db, memberId, { falseStarts: 'something else', triggerSlot: 'new', entryDate: '2026-08-07' });
  const slots = (await w3Entries(db, memberId, 60)).map((e) => e.triggerSlot);
  assert.deepEqual(slots, ['new', 'trigger-2'], 'newest first; "new" is a first-class answer, not a fallback');
});

test('the window is bounded — older entries fall out of the week', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date, good_calls) values ($1, current_date - 30, 'ancient')`,
    [memberId],
  );
  await recordW3Entry(db, memberId, { goodCalls: 'today' });
  const week = await w3Entries(db, memberId, 7);
  assert.deepEqual(week.map((e) => e.goodCalls), ['today'], 'W3 is a bounded week, not a running log');
});

test('nothing in the stored shape can be read as a score', async () => {
  // Guard against the failure mode: the moment a count exists, something renders it, and W3 acquires the
  // adherence measure Greg says appears nowhere in the asset.
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { goodCalls: 'a', falseStarts: 'b' });
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_name = 'w3_daily_entry'`,
  );
  const names = rows.map((r) => r.column_name);
  for (const banned of ['target', 'target_days', 'score', 'streak', 'count', 'total', 'percent', 'rating']) {
    assert.ok(!names.includes(banned), `w3_daily_entry must not carry a "${banned}" column`);
  }
});
