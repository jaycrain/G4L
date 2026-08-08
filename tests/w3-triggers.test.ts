import './helpers/with-phase-flags.ts'; // MUST be first — the registry reads the flags at module scope
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveW3Triggers, w3Triggers } from '../lib/rewire/w3-triggers.ts';
import { weekGrid } from '../lib/practice/grid.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';

// W3's triggers as the ROWS of the monitoring week.
//
// The load-bearing requirement here is Greg's, and it is about authorship, not storage: "The Member must author
// the protocol. The triggers, the responses, the tracking rhythm, and the focus of monitoring are all the
// Member's to choose. The system cannot supply a trigger list or a recovery script." So the tests that matter
// most are the ones asserting we store what they SAID, unchanged, and never a target.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('W','w3@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test("triggers are stored in the member's own words, in the order they named them", async () => {
  const { db, memberId } = await freshDb();
  const said = ['late nights after a rough day at work', 'when I travel', 'Sunday evenings, honestly'];
  assert.equal(await saveW3Triggers(db, memberId, said), 3);

  const got = await w3Triggers(db, memberId);
  assert.deepEqual(got.map((t) => t.label), said, 'stored VERBATIM — no tidying, no re-wording, no title-casing');
});

test('no target is ever set — W3 has no adherence measure anywhere in the asset', async () => {
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['travel weeks']);
  const { rows } = await db.query<{ target_days: number | null }>(
    `select target_days from practice_commitment where member_id = $1 and kind = 'w3_logging'`,
    [memberId],
  );
  assert.equal(rows[0]!.target_days, null, 'a target would invent a "perfect week" the member never agreed to');
});

test('re-running W3 updates the same rows rather than accumulating duplicates', async () => {
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['first pass A', 'first pass B']);
  await saveW3Triggers(db, memberId, ['second pass A', 'second pass B']);
  const got = await w3Triggers(db, memberId);
  assert.equal(got.length, 2, 'the Loop re-runs this Session; it must not leave a graveyard of old triggers');
  assert.deepEqual(got.map((t) => t.label), ['second pass A', 'second pass B']);
});

test('empty and whitespace-only turns are dropped, not stored as blank rows', async () => {
  const { db, memberId } = await freshDb();
  // The draw-out pushes every substantive member message; short/blank ones must not become grid rows.
  assert.equal(await saveW3Triggers(db, memberId, ['  ', '', 'ok', 'when I skip breakfast']), 1);
  assert.deepEqual((await w3Triggers(db, memberId)).map((t) => t.label), ['when I skip breakfast']);
});

test('a member who named nothing gets no rows and no error', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await saveW3Triggers(db, memberId, []), 0);
  assert.deepEqual(await w3Triggers(db, memberId), []);
});

// ── THE SEAM ─────────────────────────────────────────────────────────────────────────────────────────────────
// Storing rows is only useful if the WEEK renders them. Today w3Rows ignores commitments entirely and derives a
// single binary row from Momentum calls — so this test documents the CURRENT behaviour and is the one that flips
// in the next slice. Written now, deliberately, so the slice that changes w3Rows has to confront it.
test('SEAM: the W3 week does not yet render the triggers as rows — this is the next slice', async () => {
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights', 'travel']);
  await startPracticeWeek(db, memberId, 'w3_logging');

  const grid = await weekGrid(db, memberId);
  assert.ok(grid, 'the week itself opens');
  assert.equal(grid.kind, 'w3_logging');
  // CURRENT: one binary "Noticed the day" row sourced from Momentum calls.
  // NEXT SLICE: one row per named trigger, and this assertion inverts to deepEqual on the labels.
  assert.equal(grid.rows.length, 1, 'still the single Momentum-derived row');
  assert.equal(grid.rows[0]!.label, 'Noticed the day');
  assert.equal(grid.rows[0]!.target, null, 'whatever it renders, it must never carry a target');
});
