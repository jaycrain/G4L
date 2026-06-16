import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logFeedback, listFeedback, setFeedbackStatus, feedbackCounts } from '../lib/feedback/store.ts';

async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Test Member','t@x.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

test('logFeedback validates: rejects empty body and bad kind, accepts good input', async () => {
  const { db, memberId } = await seed();
  assert.equal(await logFeedback(db, { memberId, author: 'A', kind: 'issue', body: '   ' }), false);
  // @ts-expect-error — bad kind is rejected at runtime
  assert.equal(await logFeedback(db, { memberId, author: 'A', kind: 'rant', body: 'x' }), false);
  assert.equal(await logFeedback(db, { memberId, author: 'A', kind: 'issue', body: 'It broke' }), true);
  const rows = await listFeedback(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.kind, 'issue');
});

test('listFeedback joins display name, orders newest-first, filters by status', async () => {
  const { db, memberId } = await seed();
  await logFeedback(db, { memberId, author: 'Test Member <t@x.test>', kind: 'question', body: 'first' });
  await logFeedback(db, { memberId, author: 'Test Member <t@x.test>', kind: 'suggestion', body: 'second' });
  const all = await listFeedback(db);
  assert.equal(all.length, 2);
  assert.equal(all[0]!.body, 'second', 'newest first');
  assert.equal(all[0]!.displayName, 'Test Member', 'joined from member_profile');

  await setFeedbackStatus(db, all[0]!.id, 'resolved');
  const open = await listFeedback(db, 'new');
  assert.equal(open.length, 1);
  assert.equal(open[0]!.body, 'first');
});

test('setFeedbackStatus stamps resolved_at on resolve and clears it on reopen', async () => {
  const { db, memberId } = await seed();
  await logFeedback(db, { memberId, author: 'A', kind: 'issue', body: 'x' });
  const id = (await listFeedback(db))[0]!.id;
  await setFeedbackStatus(db, id, 'resolved');
  assert.ok((await listFeedback(db))[0]!.resolvedAt, 'resolved_at set');
  await setFeedbackStatus(db, id, 'new');
  assert.equal((await listFeedback(db))[0]!.resolvedAt, null, 'cleared on reopen');
});

test('feedback survives a member wipe (on delete set null) and stays attributable via author', async () => {
  const { db, memberId } = await seed();
  await logFeedback(db, { memberId, author: 'Test Member <t@x.test>', kind: 'issue', body: 'keep me' });
  await db.query('delete from member_profile where member_id=$1', [memberId]);
  const rows = await listFeedback(db);
  assert.equal(rows.length, 1, 'report outlives the member');
  assert.equal(rows[0]!.memberId, null, 'link nulled');
  assert.equal(rows[0]!.displayName, null);
  assert.equal(rows[0]!.author, 'Test Member <t@x.test>', 'still attributable');
});

test('feedbackCounts tallies by status', async () => {
  const { db, memberId } = await seed();
  await logFeedback(db, { memberId, author: 'A', kind: 'issue', body: 'a' });
  await logFeedback(db, { memberId, author: 'A', kind: 'issue', body: 'b' });
  const id = (await listFeedback(db))[0]!.id;
  await setFeedbackStatus(db, id, 'triaged');
  const c = await feedbackCounts(db);
  assert.equal(c.total, 2);
  assert.equal(c.new, 1);
  assert.equal(c.triaged, 1);
});
