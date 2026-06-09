import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  saveSubscription,
  listSubscriptions,
  deleteSubscription,
  countSubscriptions,
  type PushSub,
} from '../lib/push/store.ts';
import { sendToMember, type PushSender } from '../lib/push/send.ts';
import { buildNudgePayload } from '../lib/push/payload.ts';

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Push Tester','push@example.com') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

const sub = (n: number): PushSub => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

test('subscriptions round-trip and are scoped to the member', async () => {
  const { db, memberId } = await dbWithMember();
  await saveSubscription(db, memberId, sub(1));
  await saveSubscription(db, memberId, sub(2));
  assert.equal(await countSubscriptions(db, memberId), 2);
  const list = await listSubscriptions(db, memberId);
  assert.deepEqual(list.map((s) => s.endpoint).sort(), ['https://push.example/1', 'https://push.example/2']);
  await deleteSubscription(db, sub(1).endpoint);
  assert.equal(await countSubscriptions(db, memberId), 1);
});

test('re-subscribing the same endpoint updates, never duplicates', async () => {
  const { db, memberId } = await dbWithMember();
  await saveSubscription(db, memberId, sub(1));
  await saveSubscription(db, memberId, { endpoint: sub(1).endpoint, keys: { p256dh: 'NEW', auth: 'NEW' } });
  const list = await listSubscriptions(db, memberId);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.keys.p256dh, 'NEW');
});

test('send fans out to all subs and counts results', async () => {
  const { db, memberId } = await dbWithMember();
  await saveSubscription(db, memberId, sub(1));
  await saveSubscription(db, memberId, sub(2));
  const sender: PushSender = async () => ({ ok: true });
  const res = await sendToMember(db, memberId, buildNudgePayload({ kind: 'default', text: 'hi', priority: 1 }, memberId), sender);
  assert.deepEqual(res, { sent: 2, pruned: 0, failed: 0 });
});

test('a gone (410) endpoint is pruned; a soft failure is not', async () => {
  const { db, memberId } = await dbWithMember();
  await saveSubscription(db, memberId, sub(1)); // will be "gone"
  await saveSubscription(db, memberId, sub(2)); // will "fail" softly
  const sender: PushSender = async (s) =>
    s.endpoint.endsWith('/1') ? { ok: false, gone: true } : { ok: false, gone: false };
  const res = await sendToMember(db, memberId, buildNudgePayload({ kind: 'default', text: 'hi', priority: 1 }, memberId), sender);
  assert.equal(res.pruned, 1);
  assert.equal(res.failed, 1);
  assert.equal(await countSubscriptions(db, memberId), 1); // the gone one was deleted
  assert.equal((await listSubscriptions(db, memberId))[0]!.endpoint, 'https://push.example/2');
});

test('a throwing sender is counted as failed, never crashes the fan-out', async () => {
  const { db, memberId } = await dbWithMember();
  await saveSubscription(db, memberId, sub(1));
  const sender: PushSender = async () => {
    throw new Error('network down');
  };
  const res = await sendToMember(db, memberId, buildNudgePayload({ kind: 'default', text: 'hi', priority: 1 }, memberId), sender);
  assert.deepEqual(res, { sent: 0, pruned: 0, failed: 1 });
});

test('nudge payload opens the member companion chat (so they can respond)', () => {
  const p = buildNudgePayload({ kind: 'silence', text: 'How are you landing this week?', priority: 60 }, 'abc-123');
  assert.equal(p.body, 'How are you landing this week?');
  assert.equal(p.url, '/dashboard/abc-123?chat=1');
  assert.equal(p.title, 'Grinta for Life');
});
