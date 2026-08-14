import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { trackReclaimItem, trackedReclaimItemIds } from '../lib/practice/mark.ts';
import { weekGrids } from '../lib/practice/grid.ts';

// A MEMBER STARTS A WEEK FROM THEIR OWN LIST (#155).
//
// Every other practice week is opened by a Session closing. This is the first one the member opens themselves,
// and the end-to-end question is not "does the row insert" — it is whether the whole existing mechanic (window,
// grid, target, marks) picks up a kind nobody had used before. That is the seam worth testing: the pieces were
// each fine on their own, and the failure mode would be that they were never wired to each other.

async function member(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db; // in-memory — never touches the dev .pglite
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Jay','j@x.test') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

const YOGA = { id: '11111111-1111-4111-8111-111111111111', text: 'Yoga and kettlebell work 3 times per week' };
const CLIMB = { id: '22222222-2222-4222-8222-222222222222', text: 'One sustained climb per weekend' };

test("tracking Jay's yoga item opens a week and renders a grid row with HIS number", async () => {
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, YOGA);

  const grids = await weekGrids(db, memberId);
  const g = grids.find((x) => x.kind === 'reclaim_item');
  assert.ok(g, 'a reclaim_item week is open and reaches the grid read model');
  assert.equal(g!.rows.length, 1);
  assert.equal(g!.rows[0]!.label, YOGA.text, "the row is the member's own words, not a paraphrase");
  assert.equal(g!.rows[0]!.target, 3, '"3 times per week" became target_days = 3');
  assert.equal(g!.rows[0]!.done, 0, 'nothing ticked yet');
});

test('the number can be a WORD — "One … per weekend" is a target of 1', async () => {
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, CLIMB);
  const g = (await weekGrids(db, memberId)).find((x) => x.kind === 'reclaim_item');
  assert.equal(g!.rows[0]!.target, 1);
});

test('two tracked items share ONE week and become two rows', async () => {
  // practice_week is unique on (member, kind), so several tracked items are several COMMITMENTS under one week —
  // the same shape B3 uses for its two changes. Two weeks would give a member two grids for one idea.
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, YOGA);
  await trackReclaimItem(db, memberId, CLIMB);

  const weeks = (await weekGrids(db, memberId)).filter((x) => x.kind === 'reclaim_item');
  assert.equal(weeks.length, 1, 'one week, not one per item');
  assert.equal(weeks[0]!.rows.length, 2, 'both items are rows in it');
});

test('IDEMPOTENT — tracking the same item twice does not duplicate the row', async () => {
  // The slot is the Reclaim item's id, and practice_commitment is unique on (member, kind, slot). A member who
  // taps twice, or a re-render that fires the action again, must not end up with the same commitment twice.
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, YOGA);
  await trackReclaimItem(db, memberId, YOGA);
  const g = (await weekGrids(db, memberId)).find((x) => x.kind === 'reclaim_item');
  assert.equal(g!.rows.length, 1);
});

test('re-tracking a REWORDED item updates the label and the target in place', async () => {
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, YOGA);
  await trackReclaimItem(db, memberId, { id: YOGA.id, text: 'Yoga and kettlebell work 5 times per week' });

  const g = (await weekGrids(db, memberId)).find((x) => x.kind === 'reclaim_item');
  assert.equal(g!.rows.length, 1, 'still one row — same item, edited');
  assert.match(g!.rows[0]!.label, /5 times per week/);
  assert.equal(g!.rows[0]!.target, 5, 'the target follows the member’s new wording');
});

test('a cadence with no weekly number tracks with NO target rather than an invented one', async () => {
  // "Two long rides a month" is a real rhythm the grid cannot count in a week. It still gets a row to tick;
  // it does not get a quota the member never set. Same posture as C3's Quality-Day rows.
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, { id: CLIMB.id, text: 'Two long rides a month' });
  const g = (await weekGrids(db, memberId)).find((x) => x.kind === 'reclaim_item');
  assert.equal(g!.rows[0]!.target, null);
});

test('trackedReclaimItemIds reports what is already tracked, so the affordance can stop offering', async () => {
  const { db, memberId } = await member();
  assert.equal((await trackedReclaimItemIds(db, memberId)).size, 0);
  await trackReclaimItem(db, memberId, YOGA);
  const tracked = await trackedReclaimItemIds(db, memberId);
  assert.ok(tracked.has(YOGA.id));
  assert.ok(!tracked.has(CLIMB.id));
});

test('a blank label is refused — an empty grid row is worse than no row', async () => {
  const { db, memberId } = await member();
  await trackReclaimItem(db, memberId, { id: YOGA.id, text: '   ' });
  assert.equal((await trackedReclaimItemIds(db, memberId)).size, 0);
});
