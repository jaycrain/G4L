import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { isTappable, toggleMark, logSurfaceFor } from '../lib/practice/mark.ts';
import { recordW3Entry, w3Entries, readW3Day } from '../lib/rewire/w3-entry.ts';
import { resolvePractice, type ActivePractice } from '../lib/practice/store.ts';

// W3'S GRID CAN BE WRITTEN FROM (2026-08-12).
//
// It was a mirror on the reasoning that "the Companion writes it". Greg's Engineering Memo asks for the opposite —
// "Quick check-in interface — low-friction daily entry", and the Companion supporting the habit "through anchoring,
// FRICTION REDUCTION, and streak reinforcement". Jay tapped those boxes three times across two days.
//
// The two tests that carry real weight here are the destructive ones: a tick must never delete what the member
// wrote, and a second trigger must MOVE the record rather than silently add a second (Greg's `trigger_fired` is
// singular). Everything else is plumbing.

// THE WEEK IS RELATIVE TO TODAY, AND THAT IS LOAD-BEARING — it used to be hardcoded to the Monday 2026-08-10.
//
// `w3Entries` reads a 7-day window with a STRICT `entry_date > today - 7 days`, so the hardcoded Monday sat inside
// the window for exactly six days and then fell out of it. These five tests passed on 2026-08-16 and failed on
// 2026-08-17 with nothing changed but the calendar — every one reporting "0 rows", which reads exactly like the
// grid silently writing nothing. A time bomb that impersonates the most alarming bug in the file ("A TICK NEVER
// DELETES WHAT THEY WROTE") is worse than no test, because it trains you to ignore it.
//
// Anchoring on the CURRENT week's Monday keeps day 0 at most six days back, so it is always inside the window, and
// keeps the Mon-Sun shape the product actually uses. Still built through the real constructor so a change to how a
// week resolves cannot pass here while breaking in the product.
function mondayOfThisWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Sunday (0) is the END of a Mon-Sun week, not the start
  return d.toISOString().slice(0, 10);
}
const DAY0 = mondayOfThisWeek(); // dayIndex 0 of the current week
const TODAY = new Date().toISOString().slice(0, 10);
const WEEK: ActivePractice = resolvePractice('w3_logging', DAY0, TODAY);

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('W3 is tappable, and therefore points nowhere else', () => {
  assert.equal(isTappable('w3_logging'), true);
  assert.equal(logSurfaceFor('w3_logging', 'm'), null, 'a cell that writes the record has nothing to point at');
  // C3 stays a link: a Quality Day carries a 1–10 score the grid cannot ask for.
  assert.equal(isTappable('c3_quality'), false);
  assert.ok(logSurfaceFor('c3_quality', 'm'), 'and so it must say where the record IS written');
});

test('ticking "Checked in" records the day, and un-ticking takes it back', async () => {
  const { db, memberId } = await freshDb();
  const on = await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  assert.deepEqual(on, { ok: true, on: true });
  assert.equal((await w3Entries(db, memberId, 7)).length, 1, 'the day is on file');

  const off = await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  assert.deepEqual(off, { ok: true, on: false });
  assert.equal((await w3Entries(db, memberId, 7)).length, 0, 'an empty day un-ticks cleanly');
});

test('A TICK NEVER DELETES WHAT THEY WROTE', async () => {
  // The whole reason this was read-only. A day carrying the member's words cannot be un-ticked by a checkbox —
  // it refuses and says where to change it, rather than quietly destroying prose.
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { entryDate: DAY0, goodCalls: 'Rode before work', reflection: 'Felt like me' });

  const res = await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  assert.equal(res.ok, false, 'the un-tick is refused');
  assert.match(res.error ?? '', /wrote something/i, 'and says why, in plain words');

  const still = (await w3Entries(db, memberId, 7))[0];
  assert.equal(still?.goodCalls, 'Rode before work', 'their words are untouched');
  assert.equal(still?.reflection, 'Felt like me');
});

test('A SECOND TRIGGER MOVES THE RECORD — it does not add one', async () => {
  // Greg's field is `trigger_fired`, singular: "which named trigger, or 'new'". So ticking a different trigger is
  // the member correcting which one it was. The move is visible — the first row's tick disappears — and a silent
  // second row would be the lie, not the move.
  const { db, memberId } = await freshDb();
  await toggleMark(db, memberId, WEEK, 'brutal-week', 0, 'grid');
  assert.equal((await readW3Day(db, memberId, DAY0)).triggerSlot, 'brutal-week');

  const moved = await toggleMark(db, memberId, WEEK, 'late-nights', 0, 'grid');
  assert.deepEqual(moved, { ok: true, on: true });
  const day = await readW3Day(db, memberId, DAY0);
  assert.equal(day.triggerSlot, 'late-nights', 'the newer pick wins');
  assert.equal((await w3Entries(db, memberId, 7)).length, 1, 'still ONE day, never two rows for one date');
});

test('un-ticking the recorded trigger clears it without touching the day', async () => {
  const { db, memberId } = await freshDb();
  await recordW3Entry(db, memberId, { entryDate: DAY0, goodCalls: 'Walked at lunch' });
  await toggleMark(db, memberId, WEEK, 'brutal-week', 0, 'grid');

  const off = await toggleMark(db, memberId, WEEK, 'brutal-week', 0, 'grid');
  assert.deepEqual(off, { ok: true, on: false });
  const day = await readW3Day(db, memberId, DAY0);
  assert.equal(day.triggerSlot, null, 'the trigger is cleared');
  assert.equal(day.exists, true, 'the day itself survives — clearing a pick is not deleting a day');
  assert.equal((await w3Entries(db, memberId, 7))[0]?.goodCalls, 'Walked at lunch', 'and neither are their words');
});

test('a trigger tick on an untouched day CREATES the day, so the grid cannot show a trigger with no day', async () => {
  const { db, memberId } = await freshDb();
  await toggleMark(db, memberId, WEEK, 'brutal-week', 0, 'grid');
  const day = await readW3Day(db, memberId, DAY0);
  assert.equal(day.exists, true);
  assert.equal(day.triggerSlot, 'brutal-week');
});

test('WHICH DOOR THEY CAME THROUGH is recorded — and never anything more', async () => {
  const { db, memberId } = await freshDb();
  await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  const tapped = await db.query<{ source: string | null }>(
    `select source from w3_daily_entry where member_id=$1 and entry_date=$2::date`, [memberId, DAY0],
  );
  assert.equal(tapped.rows[0]?.source, 'grid');

  await recordW3Entry(db, memberId, { entryDate: '2026-08-11', reflection: 'told the companion' });
  const told = await db.query<{ source: string | null }>(
    `select source from w3_daily_entry where member_id=$1 and entry_date='2026-08-11'::date`, [memberId],
  );
  assert.equal(told.rows[0]?.source, 'companion', 'the conversation is its own door');
});

test('a day recorded before we tracked the door reads as NULL, not as a guess', async () => {
  // No backfill: inventing 'companion' for old rows would manufacture a measurement we never took.
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date, good_calls) values ($1,$2::date,'before we tracked it')`,
    [memberId, DAY0],
  );
  const { rows } = await db.query<{ source: string | null }>(
    `select source from w3_daily_entry where member_id=$1`, [memberId],
  );
  assert.equal(rows[0]?.source, null);
});

test('THE OPERATOR READ IS AGGREGATE — no member identifier, no content', async () => {
  // The governance boundary this feature was built to (Jay + CC, 2026-08-12): record THAT an interaction happened
  // and by what route, never more of what was said. A metric that starts returning member_id or a member's words
  // has crossed it, and this is where that shows up rather than in review.
  const { db, memberId } = await freshDb();
  await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  await recordW3Entry(db, memberId, { entryDate: '2026-08-11', reflection: 'something private' });

  const { trackerDoors } = await import('../lib/admin/tracker-doors.ts');
  const rows = await trackerDoors(db, 30);
  const blob = JSON.stringify(rows);
  assert.ok(rows.length > 0, 'it reports something');
  assert.equal(blob.includes(memberId), false, 'no member identifier reaches the operator surface');
  assert.equal(blob.includes('something private'), false, 'and no member content, ever');
  for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['days', 'source', 'tracker'], 'counts only');
});

test('a door we never recorded reads as "not recorded", never folded into a real one', async () => {
  const { db, memberId } = await freshDb();
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date, good_calls) values ($1,'2026-08-10'::date,'old row')`,
    [memberId],
  );
  const { trackerDoors } = await import('../lib/admin/tracker-doors.ts');
  const rows = await trackerDoors(db, 3650);
  const w3 = rows.filter((r) => r.tracker === 'Noticing your days');
  assert.deepEqual(w3.map((r) => r.source), ['not recorded'], 'counting it as companion would invent a finding');
});

test('A MISSING TELEMETRY COLUMN COSTS A MEASUREMENT, NEVER THE MEMBER’S DAY', async () => {
  // The window between a deploy and a hand-applied migration is real: 0076 shipped in code before it was pasted
  // into prod, and with `source` inside the INSERT every Quality Day log would have thrown "column source does not
  // exist" and told the member "Could not log — please try again." A metric taking down a working feature.
  //
  // Simulated by DROPPING the column, which is the honest way to test it — the alternative is trusting that I
  // reasoned about the failure correctly.
  const { db, memberId } = await freshDb();
  await db.query('alter table w3_daily_entry drop column source');
  await db.query('alter table quality_day_log drop column source');

  const tick = await toggleMark(db, memberId, WEEK, 'logged', 0, 'grid');
  assert.deepEqual(tick, { ok: true, on: true }, 'the tick still saves');
  assert.equal((await w3Entries(db, memberId, 7)).length, 1, 'and the day is really there');

  assert.equal(await recordW3Entry(db, memberId, { entryDate: '2026-08-11', reflection: 'still works' }), true);

  const { logQualityDay } = await import('../lib/reclaim/quality-day-store.ts');
  const logged = await logQualityDay(db, memberId, { score: 8, present: ['bike ride'] });
  assert.deepEqual(logged, { ok: true }, 'and a Quality Day still logs');
});

test('B2\'s week tracks THEIR growing edges, not one generic line', async () => {
  // DONNA, 2026-08-17: "Noticed a skill" sat beside a W3 row reading "When there is conflict with my husband",
  // and she could not tell where the generic one came from. Jay: Greg will see it immediately, because B2 is his
  // instrument and its whole point is that a member leaves knowing which skills to build. We already had the
  // answer — B2 scores twelve skills and marks each steady or growing against the member's own median.
  const { db, memberId } = await freshDb();
  const { weekGrids } = await import('../lib/practice/grid.ts');
  const { startPracticeWeek } = await import('../lib/practice/store.ts');
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses)
     values ($1,'b2',1,now(),$2,$3)`,
    [memberId, JSON.stringify({ perSkill: [
      { no: 1, skill: 'a', mean: 4.9 }, { no: 2, skill: 'b', mean: 4.8 }, { no: 3, skill: 'c', mean: 4.7 },
      { no: 4, skill: 'd', mean: 4.6 }, { no: 5, skill: 'e', mean: 4.5 }, { no: 6, skill: 'f', mean: 4.4 },
      { no: 7, skill: 'g', mean: 2.1 }, { no: 8, skill: 'h', mean: 2.0 }, { no: 9, skill: 'i', mean: 1.9 },
      { no: 10, skill: 'j', mean: 4.3 }, { no: 11, skill: 'k', mean: 4.2 }, { no: 12, skill: 'l', mean: 4.1 },
    ] }), JSON.stringify(Array(24).fill(3))],
  );
  await startPracticeWeek(db, memberId, 'b2_noticing');
  const grid = (await weekGrids(db, memberId)).find((g) => g.kind === 'b2_noticing');

  assert.ok(grid, 'the week renders');
  assert.ok(grid.rows.length >= 2 && grid.rows.length <= 3, 'their thinnest few, not all twelve — a dozen rows is a chore');
  assert.ok(!grid.rows.some((r) => /noticed a skill/i.test(r.label)), 'no generic row when a reading exists');
  // The rows must be the LOW scorers (7, 8, 9), in our plain-language labels — never the raw instrument names.
  assert.ok(grid.rows.every((r) => r.label.length > 6), 'named in plain language');
});

test('...and it falls back to a plain row when there is no B2 reading yet', async () => {
  // A member can reach this week without a scored B2 — a drifted register, a legacy account. An empty grid would
  // be worse than a plain one.
  const { db, memberId } = await freshDb();
  const { weekGrids } = await import('../lib/practice/grid.ts');
  const { startPracticeWeek } = await import('../lib/practice/store.ts');
  await startPracticeWeek(db, memberId, 'b2_noticing');
  const grid = (await weekGrids(db, memberId)).find((g) => g.kind === 'b2_noticing');
  assert.equal(grid?.rows.length, 1, 'one plain row rather than nothing');
});
