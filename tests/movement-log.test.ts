import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logMovement, listMovementLog, movementLogSummary, isMovementKind } from '../lib/movement/store.ts';

// Member-logged movement (0057) — the off-device entry, from the page ('self') or the Companion ('companion').
// Proves the write→read contract, the newest-first ordering, the date default/validation, and the agent summary.

async function member(db: Db): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('P','mv@x.com') returning member_id`)).rows[0]!.member_id;
}

test('isMovementKind guards the type', () => {
  assert.ok(isMovementKind('walk'));
  assert.ok(isMovementKind('workout'));
  assert.ok(!isMovementKind('sprint'));
  assert.ok(!isMovementKind(42));
});

test('logs self + companion entries; reads newest-first with source + days-ago', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);

  await logMovement(db, m, { activityType: 'walk', note: 'easy 3-mile loop', occurredOn: '2020-01-01', source: 'self' }); // old
  await logMovement(db, m, { activityType: 'swim', source: 'companion' }); // today, no note
  await logMovement(db, m, { activityType: 'ride', note: 'river path' }); // today, default source self

  const rows = await listMovementLog(db, m, 99999); // wide window so the 2020 entry is included
  assert.equal(rows.length, 3);
  // newest first: the two "today" entries precede the 2020 walk
  assert.equal(rows[rows.length - 1]!.activityType, 'walk', 'the oldest entry sorts last');
  assert.equal(rows[rows.length - 1]!.occurredOn, '2020-01-01', 'the explicit date is kept');
  const swim = rows.find((r) => r.activityType === 'swim')!;
  assert.equal(swim.source, 'companion');
  assert.equal(swim.note, null);
  assert.equal(swim.daysAgo, 0, 'a defaulted date is today');
  const ride = rows.find((r) => r.activityType === 'ride')!;
  assert.equal(ride.source, 'self', 'source defaults to self');
  assert.equal(ride.note, 'river path');
});

test('a bad date falls back to today, not an error', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await logMovement(db, m, { activityType: 'hike', occurredOn: 'not-a-date' });
  const rows = await listMovementLog(db, m);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.daysAgo, 0, 'garbage date → today');
});

test('movementLogSummary gives the agent a compact line (empty when nothing)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  assert.equal(await movementLogSummary(db, m), '', 'no movement → empty, so the context line is omitted');

  await logMovement(db, m, { activityType: 'walk', note: 'to the pier' });
  const summary = await movementLogSummary(db, m);
  assert.match(summary, /walk/);
  assert.match(summary, /to the pier/);
  assert.match(summary, /today/);
});
