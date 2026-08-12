import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { isValidZone, memberZone, detectZone, setZone, memberToday } from '../lib/time/zone-store.ts';
import { logMovement, listMovementLog } from '../lib/movement/store.ts';

// DOES THE ZONE ACTUALLY REACH THE DATABASE, AND DOES A WRITE ACTUALLY USE IT?
//
// The member-clock tests cover the arithmetic. These cover the seam — the part that unit tests of the halves
// cannot see, and where this change's one real bug lived (a date parameter added to the SQL but never passed).
// Everything here runs against a real Postgres.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('an unrecognised zone is never stored', () => {
  assert.equal(isValidZone('America/Denver'), true);
  assert.equal(isValidZone('Mountain Daylight Time'), false); // a display name, not an IANA name
  assert.equal(isValidZone('MDT'), false); // an abbreviation — ambiguous, and wrong half the year
  assert.equal(isValidZone('-07:00'), false); // an offset: correct in August, wrong in December
  assert.equal(isValidZone(''), false);
});

test('detection records a zone, and then never overwrites it', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await memberZone(db, memberId), null, 'starts unknown, which must read as null not UTC');

  await detectZone(db, memberId, 'America/Denver');
  assert.equal(await memberZone(db, memberId), 'America/Denver');

  // The laptop reports something else next Tuesday — a VPN, head office, a flight. A setting that changes itself
  // is not a setting, so this must be ignored.
  await detectZone(db, memberId, 'Europe/London');
  assert.equal(await memberZone(db, memberId), 'America/Denver', 'detection overwrote a stored zone');

  // The member deciding is a different act, and DOES win.
  assert.deepEqual(await setZone(db, memberId, 'Europe/London'), { ok: true });
  assert.equal(await memberZone(db, memberId), 'Europe/London');
});

test('a zone the member chose is rejected before it can corrupt their dates', async () => {
  const { db, memberId } = await freshDb();
  await detectZone(db, memberId, 'America/Denver');
  const bad = await setZone(db, memberId, 'Middle/Earth');
  assert.equal(bad.ok, false);
  assert.equal(await memberZone(db, memberId), 'America/Denver', 'a rejected zone must leave the old one intact');
});

test('an unknown stored zone falls back to UTC instead of throwing at the member', async () => {
  const { db, memberId } = await freshDb();
  // Bypasses setZone's guard on purpose: a zone name retired by tzdata between when it was stored and now.
  await db.query('update member_profile set timezone = $2 where member_id = $1', [memberId, 'Mars/Olympus']);
  const day = await memberToday(db, memberId, new Date('2026-08-12T15:00:00Z'));
  assert.equal(day, '2026-08-12');
});

test("THE BUG: an evening activity is recorded on the member's day, not tomorrow", async () => {
  const { db, memberId } = await freshDb();
  await detectZone(db, memberId, 'America/Denver');

  // 2026-08-12T00:42Z — the timestamp on Jay's real C3 close. In Boulder that is 6:42pm on the 11th.
  const eveningInBoulder = new Date('2026-08-12T00:42:00Z');
  assert.equal(await memberToday(db, memberId, eveningInBoulder), '2026-08-11');
  assert.equal(await memberToday(db, memberId, new Date('2026-08-12T15:00:00Z')), '2026-08-12', 'and midday is the 12th');
});

test('a logged activity with no date given lands on a real date, not NULL', async () => {
  const { db, memberId } = await freshDb();
  await detectZone(db, memberId, 'America/Denver');

  // Passing the date as a parameter replaced `coalesce($5::date, current_date)`. If the caller passes null for
  // "no date given", the default is gone and the row stores NULL — which no test of either half would catch.
  await logMovement(db, memberId, { activityType: 'walk' });
  const { rows } = await db.query<{ occurred_on: string | null }>(
    'select occurred_on::text from movement_log where member_id = $1',
    [memberId],
  );
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0]!.occurred_on, null, 'the write stored NULL where a date was meant to default');
  assert.match(String(rows[0]!.occurred_on), /^\d{4}-\d{2}-\d{2}$/);

  // And the rolling window reads back — the call whose SQL asked for $3 with two parameters passed.
  const log = await listMovementLog(db, memberId, 30);
  assert.equal(log.length, 1, 'the window read failed or excluded the row it just wrote');
});
