import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { seedFreshMember } from '../scripts/db/seed-fresh-member.ts';
import { getDashboard } from '../lib/gateway/flow.ts';

// DOES THE FIXTURE ACTUALLY PRODUCE A NEWBORN?
//
// The point of this member is what is ABSENT, and absence is the hardest thing to keep true — a seeder that
// quietly starts writing a score, or a schema change that backfills one, would leave the fixture looking fine
// while no longer testing anything. Every assertion below is "still nothing", on purpose.
//
// This is also the test that would have caught today's real bug shape: a surface that only exists for someone
// who has just arrived, verified against an account that arrived months ago.

const EMAIL = 'fresh-fixture@grintaforlife.test';

async function fresh(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const memberId = await seedFreshMember(db, EMAIL, 'fixture-password-1234');
  return { db, memberId };
}

test('the fresh member can reach the dashboard at all', async () => {
  const { db, memberId } = await fresh();
  const dash = await getDashboard(db, memberId);
  assert.ok(dash, 'a member with no dashboard is not a fixture, it is a broken account');
  // Stored bare; the "the" belongs to the render, not the record.
  assert.equal(dash!.identityNoun, 'Runner', 'they finished onboarding — the identity is named');
  assert.equal(dash!.reclaimList.length, 3, 'and they have a Reclaim List to look at');
});

test('...and has NOTHING after it — every empty state is reachable', async () => {
  const { db, memberId } = await fresh();
  const dash = (await getDashboard(db, memberId))!;

  // The two empty states shipped blind on 2026-08-13.
  assert.equal(dash.score, null, 'no ID Score — /score must show its "you don’t have one yet" line');
  const grinta = await db.query('select 1 from grinta_reading where member_id = $1', [memberId]);
  assert.equal(grinta.rows.length, 0, 'no Grinta reading — /grinta must show its own empty line');

  // The panels whose zero state is a forecast rather than an absence.
  for (const t of ['playbook_entry', 'practice_week', 'momentum_call', 'badge_earned']) {
    const { rows } = await db.query(`select 1 from ${t} where member_id = $1`, [memberId]);
    assert.equal(rows.length, 0, `${t} must be empty on a newborn`);
  }

  // THE TOUR IS THE PRIZE: it fires once, only on a first post-Threshold landing, so an account that has already
  // seen it can never show it again. Both markers must be unset or the fixture cannot do its main job.
  const { rows } = await db.query<{ threshold_crossed_at: unknown; tour_completed_at: unknown }>(
    'select threshold_crossed_at, tour_completed_at from member_profile where member_id = $1',
    [memberId],
  );
  assert.equal(rows[0]!.threshold_crossed_at, null, 'the Threshold ceremony must still be ahead of them');
  assert.equal(rows[0]!.tour_completed_at, null, 'and the Opening Tour with it');
});

test('re-running RESETS rather than duplicating — the tour is one-shot, so it has to be re-armable', async () => {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);

  const first = await seedFreshMember(db, EMAIL, 'fixture-password-1234');
  await db.query('update member_profile set tour_completed_at = now() where member_id = $1', [first]);

  const second = await seedFreshMember(db, EMAIL, 'fixture-password-1234');
  assert.notEqual(second, first, 'a reset makes a new member rather than reviving the used one');

  const { rows } = await db.query('select member_id from member_profile where lower(email) = lower($1)', [EMAIL]);
  assert.equal(rows.length, 1, 'and exactly one member holds the address — no duplicates piling up');
});

test('IT REFUSES A REAL ADDRESS', async () => {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  // jay@adjacentlabmedia.com is a real member whose account is his actual life. This seeder DELETES rows.
  await assert.rejects(
    () => seedFreshMember(db, 'jay@adjacentlabmedia.com', 'x'),
    /not a demo/,
    'the .test guard is the only thing between this script and a real member’s data',
  );
});
