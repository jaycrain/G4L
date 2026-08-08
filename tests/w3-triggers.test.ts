import './helpers/with-phase-flags.ts'; // MUST be first — the registry reads the flags at module scope
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveW3Triggers, w3Triggers } from '../lib/rewire/w3-triggers.ts';
import { weekGrid } from '../lib/practice/grid.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import { recordW3Entry } from '../lib/rewire/w3-entry.ts';

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
// This assertion was written INVERTED one slice ago, asserting the old single-row behaviour, precisely so the
// slice that changed w3Rows had to come here and confront it rather than quietly diverge. It did. This is the
// flipped version.

test('SEAM: the week renders "Noticed the day" first, then one row per NAMED trigger', async () => {
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights', 'travel']);
  await startPracticeWeek(db, memberId, 'w3_logging');

  const grid = await weekGrid(db, memberId);
  assert.ok(grid, 'the week opens');
  assert.equal(grid.kind, 'w3_logging');
  assert.deepEqual(
    grid.rows.map((r) => r.label),
    ['Noticed the day', 'late nights', 'travel'],
    'row 1 is tracking consistency; the triggers are their own words, in the order they named them',
  );
  assert.ok(grid.rows.every((r) => r.target === null), 'no adherence target anywhere in W3');
});

test('SEAM: a day logged with NO trigger still marks "Noticed the day"', async () => {
  // The reason row 1 survives. If rows were only triggers, a day the member sat down and recorded a good call
  // would render as an empty column — the grid reporting nothing happened on a day they showed up, and quietly
  // becoming a record of things going wrong.
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights']);
  await startPracticeWeek(db, memberId, 'w3_logging');
  await recordW3Entry(db, memberId, { goodCalls: 'walked instead of driving' }); // no trigger fired

  const grid = await weekGrid(db, memberId);
  const noticed = grid!.rows.find((r) => r.label === 'Noticed the day')!;
  const trigger = grid!.rows.find((r) => r.label === 'late nights')!;
  assert.equal(noticed.done, 1, 'they logged today — the grid must show it');
  assert.equal(trigger.done, 0, 'and must NOT claim a trigger fired when none did');
});

test('SEAM: a fired trigger ticks its own row, and only its own', async () => {
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights', 'travel']);
  await startPracticeWeek(db, memberId, 'w3_logging');
  await recordW3Entry(db, memberId, { falseStarts: 'ordered in', triggerSlot: 'trigger-1' });

  const grid = await weekGrid(db, memberId);
  const byLabel = Object.fromEntries(grid!.rows.map((r) => [r.label, r.done]));
  assert.equal(byLabel['Noticed the day'], 1);
  assert.equal(byLabel['late nights'], 1, 'trigger-1 is the first they named');
  assert.equal(byLabel['travel'], 0);
});

test('SEAM: the week no longer reads Momentum — a call logged there does not tick the W3 grid', async () => {
  // Greg's separation, asserted. A member using Momentum during W3 week must not have it appear here; the
  // bounded monitoring week and the ongoing tracker are different instruments for Cycle 1.
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights']);
  await startPracticeWeek(db, memberId, 'w3_logging');
  const { logCall } = await import('../lib/momentum/store.ts');
  await logCall(db, memberId, { type: 'good', note: 'went for a walk', source: 'grid' });

  const grid = await weekGrid(db, memberId);
  const noticed = grid!.rows.find((r) => r.label === 'Noticed the day')!;
  assert.equal(noticed.done, 0, 'a Momentum call is not a W3 monitoring entry');
});

test('a member who named no triggers still gets a usable week', async () => {
  const { db, memberId } = await freshDb();
  await startPracticeWeek(db, memberId, 'w3_logging');
  await recordW3Entry(db, memberId, { goodCalls: 'noticed the pull and said no' });

  const grid = await weekGrid(db, memberId);
  assert.deepEqual(grid!.rows.map((r) => r.label), ['Noticed the day'], 'no invented placeholder rows');
  assert.equal(grid!.rows[0]!.done, 1);
});
