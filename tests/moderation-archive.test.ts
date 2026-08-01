import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getModerationQueue, getModerationArchive, resolveReport } from '../lib/connect/moderation.ts';

// The queue only ever showed OPEN reports, so the moment you dismissed something it vanished with no record
// on the surface. On a surface that touches member safety, a decision you can't look back at is a decision you
// can't be accountable for. These tests pin that the archive REALLY RETURNS ROWS — the same "assert rows
// exist, don't just assert it didn't throw" rule that a swallowed catch taught us the hard way.

async function seed(): Promise<{ db: Db; open: string; handled: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const reporter = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Reporter R','r@x.com') returning member_id`)).rows[0]!.member_id;
  const subject = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Subject S','s@x.com') returning member_id`)).rows[0]!.member_id;

  const mk = async (reason: string, safety = false) =>
    (await db.query<{ id: string }>(
      `insert into connect_report (reporter_id, subject_kind, subject_id, reason, concern_for_safety)
       values ($1,'member',$2,$3,$4) returning id`, [reporter, subject, reason, safety])).rows[0]!.id;

  const open = await mk('still open');
  const handled = await mk('already dealt with');
  await resolveReport(db, handled);
  return { db, open, handled };
}

test('the archive returns what was already handled — and the queue no longer does', async () => {
  const { db, open, handled } = await seed();

  const queue = await getModerationQueue(db);
  assert.equal(queue.length, 1, 'only the open report belongs in the queue');
  assert.equal(queue[0]!.reportId, open);

  const archive = await getModerationArchive(db);
  assert.equal(archive.length, 1, 'the handled report came back empty — the archive read is broken, not the history');
  assert.equal(archive[0]!.reportId, handled);
  assert.equal(archive[0]!.status, 'reviewed');
  assert.ok(archive[0]!.reviewedAt, 'and it records WHEN it was handled');
});

test('a report cannot appear in both the queue and the archive', async () => {
  // They share one query with a status predicate, so a future edit that widens either must not overlap —
  // an operator seeing the same report in "needs you" and "already handled" would trust neither.
  const { db } = await seed();
  const inQueue = new Set((await getModerationQueue(db)).map((r) => r.reportId));
  for (const r of await getModerationArchive(db)) {
    assert.ok(!inQueue.has(r.reportId), `${r.reportId} is in both lists`);
  }
});

test('safety concerns still sort first in the open queue', async () => {
  const { db } = await seed();
  const reporter = (await db.query<{ member_id: string }>(`select member_id from member_profile limit 1`)).rows[0]!.member_id;
  await db.query(
    `insert into connect_report (reporter_id, subject_kind, subject_id, reason, concern_for_safety)
     values ($1,'member',$1,'worried about them', true)`, [reporter]);
  const queue = await getModerationQueue(db);
  assert.equal(queue[0]!.concernForSafety, true, 'a safety concern must not fall below an ordinary report');
});
