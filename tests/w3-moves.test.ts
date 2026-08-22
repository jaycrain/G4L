import './helpers/with-phase-flags.ts'; // MUST be first — the registry reads the flags at module scope
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveW3Moves, saveW3CheckInCue, moveLabel } from '../lib/rewire/w3-moves.ts';
import { saveW3Triggers } from '../lib/rewire/w3-triggers.ts';
import { weekGrid } from '../lib/practice/grid.ts';
import { startPracticeWeek, activePracticeWeek } from '../lib/practice/store.ts';
import { toggleMark } from '../lib/practice/mark.ts';

import { readW3Day } from '../lib/rewire/w3-entry.ts';
import { dateForDay } from '../lib/practice/mark.ts';

// dateForDay is ZERO-based — day index 1 is the window's SECOND day. Reading window.start after ticking day 1
// made two of these fail against correct code, and made a third pass for the wrong reason (a trigger field is
// trivially null on a day that does not exist). Derive the date the same way the write path does.

// W3's THREE MOVES as the rows of the monitoring week — Greg's Step 2, in the member's own words.
//
// WHY THIS FILE EXISTS AT ALL, and it is not the feature: the write path shipped BROKEN in v3.4.21 and 2074 tests
// said nothing. The rows render from practice_mark, but markPracticeDay's w3 branch had two cases — 'logged' and
// "anything else is a trigger" — so a tap on "I redirected" fell through and wrote `move-redirect` into her
// `trigger_fired` field. Unmarkable row, corrupted field, silent. It was found by hand while removing a different
// row, which is not a strategy.
//
// So the tests that matter most here are the SEAM ones: tick a move, then ask the database what actually changed.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('M','w3moves@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

const HERS = {
  redirect: 'five minutes, then I decide',
  reframe: 'a false start is the cost, not the failure',
  restart: 'the trail at sunrise, before anyone is up',
};

test('the label is her verb plus her words, never a rewrite of them', () => {
  assert.equal(moveLabel('move-redirect', HERS), 'I redirected — five minutes, then I decide');
  assert.equal(moveLabel('move-reframe', HERS), 'I reframed — a false start is the cost, not the failure');
  assert.equal(moveLabel('move-restart', HERS), 'I restarted — the trail at sunrise, before anyone is up');
});

test('a move she left blank still gets its row — the three are a set', () => {
  // Dropping the blank one would quietly tell her that part of the protocol does not count.
  assert.equal(moveLabel('move-reframe', { redirect: 'x' }), 'I reframed');
  assert.equal(moveLabel('move-restart', { restart: '   ' }), 'I restarted');
});

test('the week renders her three moves and NO generic consistency row', async () => {
  // Jay, 2026-08-22: "everything is in her words except Check in. So we're putting it in too soon… remove it until
  // it's filled with her answer." Every row a member sees here is hers, or there is no row.
  const { db, memberId } = await freshDb();
  await saveW3Moves(db, memberId, HERS);
  await startPracticeWeek(db, memberId, 'w3_logging');

  const grid = await weekGrid(db, memberId);
  assert.ok(grid, 'the week should render');
  assert.deepEqual(
    grid!.rows.map((r) => r.label),
    [
      'I redirected — five minutes, then I decide',
      'I reframed — a false start is the cost, not the failure',
      'I restarted — the trail at sunrise, before anyone is up',
    ],
  );
  assert.ok(!grid!.rows.some((r) => r.slot === 'logged'), 'the generic row is gone, by decision');
  assert.ok(grid!.rows.every((r) => r.target === null), 'W3 has no adherence target anywhere in the asset');
});

test('SEAM: ticking a move writes a MARK — it does not write her trigger_fired', async () => {
  // THE REGRESSION. This is the exact bug v3.4.21 shipped: the tap fell through to the trigger branch and stored
  // "move-redirect" as the trigger that fired. Asserted against the database, not the return value, because the
  // broken version returned { ok: true } while corrupting a different field.
  const { db, memberId } = await freshDb();
  await saveW3Moves(db, memberId, HERS);
  await startPracticeWeek(db, memberId, 'w3_logging');

  const r = await toggleMark(db, memberId, (await activePracticeWeek(db, memberId))!, 'move-redirect', 1, 'grid');
  assert.equal(r.ok, true);
  assert.equal(r.on, true);

  const marks = await db.query<{ n: string }>(
    `select count(*)::text as n from practice_mark where member_id = $1 and kind = 'w3_logging' and commitment_id is not null`,
    [memberId],
  );
  assert.equal(marks.rows[0]!.n, '1', 'the tick should land in practice_mark');

  const grid = await weekGrid(db, memberId);
  const day = await readW3Day(db, memberId, dateForDay(grid!.window, 1));
  assert.equal(day.triggerSlot, null, 'her trigger_fired must be untouched by a move');
});

test('SEAM: ticking a move also opens the day, so consistency is still counted', async () => {
  // The consistency ROW is gone; the consistency RECORD is not. days_logged and the close review count day
  // entries, so using a move has to open one — otherwise removing the row would have quietly stopped counting.
  const { db, memberId } = await freshDb();
  await saveW3Moves(db, memberId, HERS);
  await startPracticeWeek(db, memberId, 'w3_logging');
  const grid = await weekGrid(db, memberId);

  assert.equal((await readW3Day(db, memberId, dateForDay(grid!.window, 1))).exists, false);
  await toggleMark(db, memberId, (await activePracticeWeek(db, memberId))!, 'move-reframe', 1, 'grid');
  assert.equal((await readW3Day(db, memberId, dateForDay(grid!.window, 1))).exists, true);
});

test('SEAM: un-ticking a move removes the mark and NEVER the day', async () => {
  // The day may carry her writing — smart choices, what the old voice said, a reflection. An un-tick that deleted
  // it would destroy member text to undo a checkbox.
  const { db, memberId } = await freshDb();
  await saveW3Moves(db, memberId, HERS);
  await startPracticeWeek(db, memberId, 'w3_logging');

  await toggleMark(db, memberId, (await activePracticeWeek(db, memberId))!, 'move-restart', 1, 'grid');
  const off = await toggleMark(db, memberId, (await activePracticeWeek(db, memberId))!, 'move-restart', 1, 'grid');
  assert.equal(off.on, false);

  const grid = await weekGrid(db, memberId);
  assert.equal((await readW3Day(db, memberId, dateForDay(grid!.window, 1))).exists, true, 'the day survives the un-tick');
  assert.equal(grid!.rows.find((r) => r.slot === 'move-restart')!.done, 0);
});

test('a member who finished W3 before the moves existed keeps her triggers', async () => {
  // She has trigger rows and no move rows. Handing her an empty week to honour a decision made after she finished
  // would be the worst of both — her triggers are also her own words.
  const { db, memberId } = await freshDb();
  await saveW3Triggers(db, memberId, ['late nights', 'when I travel']);
  await startPracticeWeek(db, memberId, 'w3_logging');

  const grid = await weekGrid(db, memberId);
  assert.deepEqual(grid!.rows.map((r) => r.label), ['Checked in', 'late nights', 'when I travel']);
});

test("the week's first row exists ONLY when she answered the cue, and wears her words", async () => {
  // Greg's Stage 4, built 2026-08-22. The row was removed entirely on 8/22 because a generic "Checked in" sitting
  // above three rows of her own words was the system talking over her (Jay: "we're putting it in too soon…
  // remove it until it's filled with her answer"). This is the answer arriving.
  const { db, memberId } = await freshDb();
  await saveW3Moves(db, memberId, HERS);
  await startPracticeWeek(db, memberId, 'w3_logging');

  // No cue yet — three rows, no fourth. A member who skipped the question is not handed a label we invented.
  let grid = await weekGrid(db, memberId);
  assert.equal(grid!.rows.length, 3);
  assert.ok(!grid!.rows.some((r) => r.slot === 'logged'));

  await saveW3CheckInCue(db, memberId, 'after I put the kids down');
  grid = await weekGrid(db, memberId);
  assert.equal(grid!.rows.length, 4);
  assert.equal(grid!.rows[0]!.slot, 'logged', 'it leads the week');
  assert.equal(grid!.rows[0]!.label, 'Checked in — after I put the kids down', 'her words, untidied');
});

test('a cue too short to be an answer is refused rather than stored', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await saveW3CheckInCue(db, memberId, ' '), false);
  assert.equal(await saveW3CheckInCue(db, memberId, 'x'), false);
});
