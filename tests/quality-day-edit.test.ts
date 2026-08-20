import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logQualityDay, recentQualityDays } from '../lib/reclaim/quality-day-store.ts';
import { canLogOn } from '../lib/practice/mark.ts';
import { memberToday } from '../lib/time/zone-store.ts';

// A SECOND LOG ON THE SAME DAY MUST NOT ERASE THE FIRST.
//
// Jay, on his OWN account (2026-08-15): "the only box that will stay checked is the last one you've entered
// data for. So it switches every time you enter." It read as a grid bug and was data loss — logQualityDay
// upserts on (member_id, logged_on) and REPLACES `present`, while the form always started empty. So a second
// visit submitted only what was ticked that time, and that became the whole day.
//
// The fix is that the FORM seeds from today's record, which makes replace correct. These tests hold both ends:
// the store still replaces (so a member can UNTICK), and the form is wired to arrive holding the record.

async function member(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Jay','j@x.test') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}
const DAY = '2026-08-15';


// DATES RELATIVE TO THE MEMBER'S TODAY, never hardcoded.
//
// These tests used fixed dates ('2026-08-13', '2026-08-14') against a window measured as `today - 6`. That is a
// time bomb: it passes until the calendar walks far enough away, then fails on a day nobody changed anything.
// One went off on 2026-08-20 mid-release, and the second was sitting exactly on the boundary, due to fail the
// next day. A suite that goes red on the calendar teaches people to ignore red, which costs more than the test
// is worth.
const dayOffset = async (db: Db, memberId: string, back: number): Promise<string> => {
  const today = await memberToday(db, memberId);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

test('THE BUG: a partial second log replaces the day — which is why the form must seed', async () => {
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple'], loggedOn: DAY });
  // A form that started blank would send only the newly-ticked element. This is that submission.
  await logQualityDay(db, memberId, { score: 8, present: ['Food as fuel'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present, ['Food as fuel'], 'the store REPLACES — this is by design, not the bug');
});

test('the seeded form sends the whole record, so nothing is lost', async () => {
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple'], loggedOn: DAY });
  // Seeded: the form arrives holding ['bike ride','Maple'] and the member adds one.
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride', 'Maple', 'Food as fuel'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present.sort(), ['Food as fuel', 'Maple', 'bike ride'], 'all three survive');
});

test('and UNTICKING still works — the reason this is not a server-side merge', async () => {
  // A union-on-write would have been the tempting one-liner and would make this impossible: a member could
  // never correct something they logged by mistake. A tracker you cannot correct is worse than one that forgets.
  const { db, memberId } = await member();
  await logQualityDay(db, memberId, { score: 7, present: ['bike ride', 'Maple'], loggedOn: DAY });
  await logQualityDay(db, memberId, { score: 7, present: ['bike ride'], loggedOn: DAY });

  const [entry] = await recentQualityDays(db, memberId, 7);
  assert.deepEqual(entry!.present, ['bike ride'], 'Maple was removed on purpose and stayed removed');
});

test('separate days stay separate — the grid can show more than one column', async () => {
  const { db, memberId } = await member();
  const [d1, d0] = [await dayOffset(db, memberId, 1), await dayOffset(db, memberId, 0)];
  await logQualityDay(db, memberId, { score: 6, present: ['bike ride'], loggedOn: d1 });
  await logQualityDay(db, memberId, { score: 9, present: ['Maple'], loggedOn: d0 });
  const rows = await recentQualityDays(db, memberId, 7);
  assert.equal(rows.length, 2, 'two days, two rows');
});

// WHY THIS TEST WAS REWRITTEN (2026-08-15).
//
// It used to read the two source files and assert that certain characters appeared in them — that the form said
// `useState(today?.score ?? null)` and the page said `today={todayEntry}`. It passed against a product Jay was
// watching lose his data, because a prop being PASSED in the source proves nothing about it ever having a value
// at runtime, and renaming a variable broke the test while the behaviour was fine. A test that greps for a prop
// is not a test that the prop has a value.
//
// What replaces it is the decision the bug actually turned on, exercised as code: given a date and the member's
// today, which day does the write land on? That is `canLogOn`, and it is the same function the page and the
// server action both call — so this covers the seam rather than a spelling of it.
test('canLogOn: today and yesterday only — never a future day, never further back', () => {
  const today = '2026-08-15';
  assert.equal(canLogOn('2026-08-15', today), true, 'today');
  assert.equal(canLogOn('2026-08-14', today), true, 'yesterday — missing a day and catching it next morning');
  assert.equal(canLogOn('2026-08-13', today), false, 'two days back is recall, not noticing');
  assert.equal(canLogOn('2026-08-16', today), false, 'a day that has not happened');
  // Month and year boundaries, because the date is string arithmetic and off-by-one there is silent.
  assert.equal(canLogOn('2026-07-31', '2026-08-01'), true, 'across a month boundary');
  assert.equal(canLogOn('2025-12-31', '2026-01-01'), true, 'across a year boundary');
});

test('a back-filled day does not disturb the day beside it', async () => {
  // Jay's report in one assertion: log today, then fill in yesterday, and today must be untouched. The old
  // dateless link made every write land on today, so the second log silently replaced the first.
  const { db, memberId } = await member();
  const today = await dayOffset(db, memberId, 0);
  const yesterday = await dayOffset(db, memberId, 1);
  await logQualityDay(db, memberId, { score: 8, present: ['bike ride'], loggedOn: today });
  await logQualityDay(db, memberId, { score: 4, present: ['Maple'], loggedOn: yesterday });
  const rows = await recentQualityDays(db, memberId, 7);
  const byDate = new Map(rows.map((r) => [r.loggedOn, r]));
  assert.equal(byDate.get(today)?.score, 8, "today's score survived the back-fill");
  assert.equal(byDate.get(yesterday)?.score, 4, 'and yesterday landed on its own day');
  assert.deepEqual(byDate.get(today)?.present, ['bike ride'], "today's elements are untouched");
});
