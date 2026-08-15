import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { memberWeekReport, PLAYBOOK_HISTORY_FROM } from '../lib/report/member-week.ts';

// THE REPORT A CHARTER MEMBER ASKED FOR — does it tell the truth about a week?
//
// Built against a week we construct by hand, so every number has a known right answer. The failure mode this
// guards is not "it crashes" but "it quietly flatters" — a dropped commitment that vanishes from the report, a
// missing history that reads as a quiet week. Both would send Jay into a conversation with a false picture.

const WINDOW = { start: '2026-08-17', days: 7 } as unknown as Parameters<typeof memberWeekReport>[2];

async function member(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    "insert into member_profile (display_name, email) values ('Report','report@grintaforlife.test') returning member_id",
  );
  return { db, memberId: rows[0]!.member_id };
}

test('a commitment that was made and NOT done still appears, at zero', async () => {
  // The one that matters most. Dropping empty rows would make every week look like a good week.
  const { db, memberId } = await member();
  await db.query("insert into practice_week (member_id, kind, started_at) values ($1,'b3_pilot',now())", [memberId]);
  await db.query(
    "insert into practice_commitment (member_id, kind, slot, label, target_days) values ($1,'b3_pilot','s1','Half a piece of bread',5)",
    [memberId],
  );
  const r = await memberWeekReport(db, memberId, WINDOW);
  assert.equal(r.commitments.length, 1, 'the commitment is reported');
  assert.equal(r.commitments[0]!.hit, 0, 'and honestly, at zero');
  assert.equal(r.commitments[0]!.target, 5, 'against the number THEY chose');
  assert.equal(r.commitments[0]!.days.length, 7, 'one slot per day of the window');
});

test('marks land on the right days, and only inside the window', async () => {
  const { db, memberId } = await member();
  await db.query("insert into practice_week (member_id, kind, started_at) values ($1,'b3_pilot',now())", [memberId]);
  const { rows: c } = await db.query<{ id: string }>(
    "insert into practice_commitment (member_id, kind, slot, label, target_days) values ($1,'b3_pilot','s1','Walk',3) returning id",
    [memberId],
  );
  const cid = c[0]!.id;
  for (const d of ['2026-08-17', '2026-08-19', '2026-08-23']) {
    await db.query("insert into practice_mark (member_id, kind, commitment_id, marked_on) values ($1,'b3_pilot',$2,$3::date)", [memberId, cid, d]);
  }
  // A tick the week BEFORE must not leak in — the whole point of a week-to-week comparison is that weeks differ.
  await db.query("insert into practice_mark (member_id, kind, commitment_id, marked_on) values ($1,'b3_pilot',$2,'2026-08-16'::date)", [memberId, cid]);

  const r = await memberWeekReport(db, memberId, WINDOW);
  assert.equal(r.commitments[0]!.hit, 3, 'three inside the window, not four');
  assert.deepEqual(r.commitments[0]!.days, [true, false, true, false, false, false, true], 'on the correct days');
});

test('the Quality Day series carries the shape of the week, not just an average', async () => {
  const { db, memberId } = await member();
  await db.query(
    `insert into quality_day_log (member_id, logged_on, score, present)
     values ($1,'2026-08-17'::date,4,'["a"]'::jsonb), ($1,'2026-08-18'::date,9,'["a","b"]'::jsonb)`,
    [memberId],
  );
  const r = await memberWeekReport(db, memberId, WINDOW);
  assert.equal(r.qualityDays.logged, 2);
  assert.equal(r.qualityDays.average, 6.5);
  assert.deepEqual(r.qualityDays.points.map((p) => p.score), [4, 9], 'in order — a 4 then a 9 is a different week from two 6.5s');
  assert.equal(r.qualityDays.points[1]!.elements, 2);
});

test('a Move kept and then dropped reads as two events, not one state', async () => {
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'what_works','Ride before work','gathered','proposed') returning id`,
    [memberId],
  );
  await db.query("update playbook_entry set state='kept', updated_at=now() where id=$1", [rows[0]!.id]);
  await db.query("update playbook_entry set state='dismissed', updated_at=now() where id=$1", [rows[0]!.id]);

  // The audit rows land at now(); point the window at today so they fall inside it.
  const today = new Date().toISOString().slice(0, 10);
  const r = await memberWeekReport(db, memberId, { start: today, days: 1 } as never);
  const kinds = r.moves.changes.map((c) => c.change);
  assert.deepEqual(kinds, ['added', 'kept', 'dropped'], 'the arc, in order — the row alone only says "dismissed"');
});

test('a rewording keeps the words they moved away from', async () => {
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'what_works','Ride 3x','gathered','kept') returning id`,
    [memberId],
  );
  await db.query('update playbook_entry set body=$2, updated_at=now() where id=$1', [rows[0]!.id, 'Ride 4x']);
  const today = new Date().toISOString().slice(0, 10);
  const r = await memberWeekReport(db, memberId, { start: today, days: 1 } as never);
  const reword = r.moves.changes.find((c) => c.change === 'reworded');
  assert.equal(reword?.text, 'Ride 3x', 'their earlier words are theirs and are kept');
});

test('a week before the audit existed is flagged, NOT reported as quiet', async () => {
  // The lie this prevents: 0079 only started recording on 2026-08-15, so every earlier week shows zero Move
  // changes. Rendering that as "nothing happened" would be a confident falsehood about someone's real month.
  const { db, memberId } = await member();
  const before = await memberWeekReport(db, memberId, { start: '2026-07-01', days: 7 } as never);
  assert.equal(before.moves.historyComplete, false, 'a pre-0079 week cannot claim a complete Move history');

  const after = await memberWeekReport(db, memberId, { start: PLAYBOOK_HISTORY_FROM, days: 7 } as never);
  assert.equal(after.moves.historyComplete, true, 'a week from the trigger onward can');
});

test('an empty week is empty, not broken', async () => {
  const { db, memberId } = await member();
  const r = await memberWeekReport(db, memberId, WINDOW);
  assert.deepEqual(r.commitments, []);
  assert.equal(r.qualityDays.average, null, 'no logs means no average — never 0, which would read as a bad week');
  assert.equal(r.moves.kept, 0);
  assert.deepEqual(r.sessionsClosed, []);
});
