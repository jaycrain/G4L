import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { startPracticeWeek, PRACTICE_WINDOW_DAYS } from '../lib/practice/store.ts';
import { weekGrid, dayIndex, buildRow, targetSummary } from '../lib/practice/grid.ts';

// THE WEEK GRID. Greg's tracker: rows × 7 days, ticked when done, with the member's own target beside them.
//
// The thing these tests actually protect is the design decision. Two of the three grid weeks already hold their
// per-day record (C3 in quality_day_log.present, W3 in momentum_call), so the grid READS those rather than copying
// them into a second table. If someone later "simplifies" this by making every week write to practice_mark, the
// C3 and W3 tests below go red — which is the point, because the duplicate would drift silently otherwise.

async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Greg','g@example.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

import { trackerRun } from '../lib/time/member-clock.ts';

// 2026-08-03 is a MONDAY, so this is the same seven-day window these tests always used — the numbers below are
// unchanged. What changed is that a window is now an explicit object rather than "start date plus seven".
const WEEK = trackerRun('2026-08-03').main;

// ── the pure day maths ────────────────────────────────────────────────────────────────────────────────────────

test('dayIndex maps a logged date onto the window, and rejects what falls outside', () => {
  assert.equal(dayIndex(WEEK, '2026-08-03'), 0, 'the start day is day 1');
  assert.equal(dayIndex(WEEK, '2026-08-09'), 6, 'the seventh day is the last');
  assert.equal(dayIndex(WEEK, '2026-08-10'), -1, 'day 8 is outside the window');
  assert.equal(dayIndex(WEEK, '2026-08-02'), -1, 'and so is the day before it opened');
});

test('a late-evening log lands on TODAY, not tomorrow', () => {
  // A timestamp is truncated to its calendar day before being placed, so an 11pm tick cannot roll into the next
  // column. WHICH day that timestamp belongs to is now the member clock's job (localDate), not this function's —
  // this only proves the truncation still happens here.
  assert.equal(dayIndex(WEEK, '2026-08-03T23:58:00Z'), 0);
  assert.equal(dayIndex(WEEK, '2026-08-03T00:01:00Z'), 0);
});

test('A PARTIAL FIRST WEEK IS NARROWER, and the columns start on the day they closed', () => {
  const stub = trackerRun('2026-08-06').stub!; // a Thursday close
  assert.equal(stub.days, 4, 'Thu, Fri, Sat, Sun');
  assert.equal(dayIndex(stub, '2026-08-06'), 0, 'Thursday is column 0 — not Monday');
  assert.equal(dayIndex(stub, '2026-08-09'), 3, 'Sunday is the last column');
  assert.equal(dayIndex(stub, '2026-08-10'), -1, 'the Monday after belongs to the next window');
  const row = buildRow('x', 'walk', null, stub, ['2026-08-06', '2026-08-08']);
  assert.equal(row.marks.length, 4, 'a partial week draws four boxes, not seven');
});

test('buildRow keeps `done` and `marks` in lockstep, and ignores out-of-window dates', () => {
  const r = buildRow('activity', '15 minutes', 5, WEEK, ['2026-08-03', '2026-08-05', '2026-08-05', '2026-07-30']);
  assert.equal(r.marks.length, PRACTICE_WINDOW_DAYS);
  assert.deepEqual(r.marks.map(Number), [1, 0, 1, 0, 0, 0, 0], 'the duplicate collapses, the stray is dropped');
  assert.equal(r.done, 2, 'done is derived, never a second source of truth');
});

// ── B3 · the only kind with its own storage ───────────────────────────────────────────────────────────────────

test('B3 · rows are the committed changes, ticks are per commitment per day', async () => {
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'b3_pilot');
  const mk = async (slot: string, label: string, target: number, sort: number) =>
    (
      await db.query<{ id: string }>(
        `insert into practice_commitment (member_id,kind,slot,label,target_days,sort_order)
         values ($1,'b3_pilot',$2,$3,$4,$5) returning id`,
        [memberId, slot, label, target, sort],
      )
    ).rows[0]!.id;
  const act = await mk('activity', '15 minutes of functional fitness', 5, 0);
  await mk('diet', 'A piece of fruit with breakfast', 5, 1);
  await db.query(`insert into practice_mark (member_id,kind,commitment_id,marked_on,source) values ($1,'b3_pilot',$2,current_date,'grid')`, [memberId, act]);

  const g = (await weekGrid(db, memberId))!;
  assert.equal(g.kind, 'b3_pilot');
  assert.equal(g.rows.length, 2);
  assert.equal(g.rows[0]!.label, '15 minutes of functional fitness');
  assert.equal(g.rows[0]!.target, 5, "the member's number, carried to the grid");
  assert.equal(g.rows[0]!.done, 1);
  assert.equal(g.rows[1]!.done, 0, 'the untouched commitment is simply blank — not "missed"');
  assert.equal(g.closed, false);
});

test('B3 · a tick from the grid and the same tick from the Companion are ONE cell', async () => {
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'b3_pilot');
  const id = (
    await db.query<{ id: string }>(
      `insert into practice_commitment (member_id,kind,slot,label,target_days) values ($1,'b3_pilot','activity','walk',5) returning id`,
      [memberId],
    )
  ).rows[0]!.id;
  for (const source of ['grid', 'companion']) {
    await db.query(
      `insert into practice_mark (member_id,kind,commitment_id,marked_on,source) values ($1,'b3_pilot',$2,current_date,$3)
       on conflict do nothing`,
      [memberId, id, source],
    );
  }
  assert.equal((await weekGrid(db, memberId))!.rows[0]!.done, 1, 'two routes to the same day must not double-count');
});

// ── C3 and W3 · READ their existing record, never a copy of it ────────────────────────────────────────────────

test('C3 · rows come from the QD profile and marks from quality_day_log — no second store', async () => {
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'c3_quality');
  const { persistQualityDayProfile, logQualityDay } = await import('../lib/reclaim/quality-day-store.ts');
  await persistQualityDayProfile(db, memberId, {
    nonNegotiables: ['Moved my body', 'Slept enough', 'Ate like I meant it'],
    contributors: ['Time outside', 'Talked to someone real', 'Made something'],
    disruptors: ['Doomscrolling', 'Skipped lunch'],
  });
  await logQualityDay(db, memberId, { score: 8, present: ['Moved my body', 'Time outside'] });

  const g = (await weekGrid(db, memberId))!;
  assert.equal(g.rows.length, 6, 'three non-negotiables + three contributors');
  assert.equal(g.rows.find((r) => r.label === 'Moved my body')!.done, 1);
  assert.equal(g.rows.find((r) => r.label === 'Made something')!.done, 0);
  assert.equal(g.rows.every((r) => r.target === null), true, 'a Quality-Day element is not a quota — never invent one');
  // The proof that nothing was copied: practice_mark is untouched.
  const copies = await db.query(`select 1 from practice_mark where member_id=$1`, [memberId]);
  assert.equal(copies.rows.length, 0, 'C3 must READ quality_day_log, not duplicate it into practice_mark');
});

// W3 MOVED OFF momentum_call on 2026-08-08 (migration 0074). This test asserted the old behaviour and failed the
// moment w3Rows changed — which is the suite doing its job. Greg wants the bounded monitoring week kept SEPARATE
// from the ongoing tracker for Cycle 1, and his seven-field tracker cannot fit in a typed call plus a note.
// Fuller assertions live in tests/w3-triggers.test.ts; this keeps the per-kind adapter coverage in one place.
test('W3 · reads its OWN daily entries, not momentum_call', async () => {
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'w3_logging');
  const { logCall } = await import('../lib/momentum/store.ts');
  const { recordW3Entry } = await import('../lib/rewire/w3-entry.ts');

  // A Momentum call during W3 week must NOT tick the week — that is the separation, asserted.
  await logCall(db, memberId, { type: 'good_call', note: 'took the stairs', source: 'quick_log' });
  assert.equal((await weekGrid(db, memberId))!.rows[0]!.done, 0, 'a Momentum call is not a W3 entry');

  // A real W3 entry does.
  await recordW3Entry(db, memberId, { goodCalls: 'caught the pull and named it' });
  const g = (await weekGrid(db, memberId))!;
  assert.equal(g.rows[0]!.label, 'Noticed the day');
  assert.equal(g.rows[0]!.done, 1);
  assert.equal((await db.query(`select 1 from practice_mark where member_id=$1`, [memberId])).rows.length, 0, 'no duplicate');
});

// ── the shapes that have no grid, and the summary ─────────────────────────────────────────────────────────────

test('W2 gets no grid — five minutes in a picture is not countable', async () => {
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'w2_image');
  assert.deepEqual((await weekGrid(db, memberId))!.rows, [], 'forcing a grid onto it would be noise, not information');
});

test('no active week reads as null, not as an empty grid', async () => {
  const { db, memberId } = await seed();
  assert.equal(await weekGrid(db, memberId), null);
});

test('targetSummary counts only rows that HAVE a target', () => {
  assert.deepEqual(
    targetSummary([
      buildRow('a', 'walk', 5, WEEK, ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']),
      buildRow('b', 'fruit', 5, WEEK, ['2026-08-03']),
    ]),
    { met: 1, of: 2 },
  );
  // A week of pure noticing never reports a score it was never keeping.
  assert.equal(targetSummary([buildRow('x', 'Moved my body', null, WEEK, ['2026-08-03'])]), null);
});

// ── the pre-existing bug this build uncovered ─────────────────────────────────────────────────────────────────

test("QUALITY-DAY DATES: a day logged today reads back as today, not yesterday", async () => {
  // recentQualityDays did String(row.logged_on) on a `date` column. Postgres hands back a JS Date at UTC midnight,
  // so String() renders it in LOCAL time — the PREVIOUS calendar day for anyone west of Greenwich. The member's
  // Quality-Day page and the Companion's context were both reading a day the member logged on the 7th as the 6th.
  // Fixed with ::text in SQL (what momentum/store.ts always did). This pins it, because the failure is invisible in
  // any timezone at or east of UTC — including most CI.
  const { db, memberId } = await seed();
  const { logQualityDay, recentQualityDays } = await import('../lib/reclaim/quality-day-store.ts');
  await logQualityDay(db, memberId, { score: 7, present: ['Moved my body'] });

  const today = (await db.query<{ d: string }>(`select current_date::text as d`)).rows[0]!.d;
  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.equal(entry!.loggedOn, today, `logged today (${today}) but read back as ${entry!.loggedOn}`);
  assert.match(entry!.loggedOn, /^\d{4}-\d{2}-\d{2}$/, 'and it is a plain ISO date, not a locale string');
});

// ── writing a cell: what the grid is allowed to touch ─────────────────────────────────────────────────────────

test('THE GRID CANNOT DELETE WHAT THE MEMBER WROTE', async () => {
  // THE RULE SURVIVED; THE MECHANISM DID NOT. This test used to enforce the rule by making W3 and C3 read-only,
  // and it justified that with a momentum_call carrying the member's note — which had ALREADY stopped being true
  // when W3 moved to w3_daily_entry on 2026-08-08. So it was asserting a real principle through a stale fact,
  // and it would have gone on passing either way.
  //
  // W3's grid is tappable now (Greg's Engineering Memo asks for "low-friction daily entry"; Jay tapped the dead
  // boxes three times). The protection moved to where it belongs: the write itself refuses to delete a day the
  // member wrote into, so the rule is enforced by the thing that would do the damage rather than by withholding
  // the whole surface. C3 stays a link because its record needs a 1–10 score the grid cannot ask for.
  const { isTappable, toggleMark } = await import('../lib/practice/mark.ts');
  assert.equal(isTappable('b3_pilot'), true);
  assert.equal(isTappable('b2_noticing'), true);
  assert.equal(isTappable('w3_logging'), true, 'a low-friction daily entry, per Greg');
  assert.equal(isTappable('c3_quality'), false, 'a Quality Day needs a score, so its cell links to the form');

  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'w3_logging');
  const { recordW3Entry, w3Entries } = await import('../lib/rewire/w3-entry.ts');
  const { resolvePractice } = await import('../lib/practice/store.ts');
  const today = new Date().toISOString().slice(0, 10);
  const pw = resolvePractice('w3_logging', today, today);
  await recordW3Entry(db, memberId, { entryDate: today, reflection: 'the words I would lose' });

  const res = await toggleMark(db, memberId, pw, 'logged', 0, 'grid');
  assert.equal(res.ok, false, 'the un-tick is refused, not silently performed');
  assert.match(res.error!, /wrote something/i, 'and it says why, in the member’s terms');
  const entries = await w3Entries(db, memberId, 7);
  assert.equal(entries.length, 1, 'the day survives');
  assert.equal(entries[0]!.reflection, 'the words I would lose');
});

test('a tick is addressed by DAY INDEX, resolved against the week’s own clock', async () => {
  // Never a date from the browser: a client clock in another timezone would write the mark onto the wrong day.
  const { dateForDay } = await import('../lib/practice/mark.ts');
  assert.equal(dateForDay(WEEK, 0), '2026-08-03');
  assert.equal(dateForDay(WEEK, 3), '2026-08-06');
  assert.equal(dateForDay(WEEK, 6), '2026-08-09');
  // And in a partial week the same index means a different date, which is the whole reason it takes the window.
  assert.equal(dateForDay(trackerRun('2026-08-06').stub!, 0), '2026-08-06');
});

test('toggle is a round trip — tick, un-tick, and the row is gone', async () => {
  const { toggleMark } = await import('../lib/practice/mark.ts');
  const { db, memberId } = await seed();
  await startPracticeWeek(db, memberId, 'b3_pilot');
  await db.query(
    `insert into practice_commitment (member_id,kind,slot,label,target_days) values ($1,'b3_pilot','activity','walk',5)`,
    [memberId],
  );
  const { activePracticeWeek } = await import('../lib/practice/store.ts');
  const active = (await activePracticeWeek(db, memberId))!;
  assert.ok(active, 'the week must be open for a tick to mean anything');

  assert.deepEqual(await toggleMark(db, memberId, active, 'activity', 0, 'grid'), { ok: true, on: true });
  assert.equal((await weekGrid(db, memberId))!.rows[0]!.done, 1);
  assert.deepEqual(await toggleMark(db, memberId, active, 'activity', 0, 'companion'), { ok: true, on: false });
  assert.equal((await weekGrid(db, memberId))!.rows[0]!.done, 0, 'a mis-tap must be undoable');
});
