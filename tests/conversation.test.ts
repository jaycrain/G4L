import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { appendMessages, loadConversation } from '../lib/agent/conversation.ts';

async function member(db: Db, email: string): Promise<string> {
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('M', $1) returning member_id`,
    [email],
  );
  return r.rows[0]!.member_id;
}

test('messages persist and load back oldest→newest', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, 'a@x.com');
  await appendMessages(db, m, [
    { role: 'agent', text: 'Hey — good to see you.' },
    { role: 'member', text: 'Got out on the bike.' },
    { role: 'agent', text: 'How did it feel?' },
  ]);
  const loaded = await loadConversation(db, m);
  assert.deepEqual(
    loaded.map((x) => `${x.role}:${x.text}`),
    ['agent:Hey — good to see you.', 'member:Got out on the bike.', 'agent:How did it feel?'],
  );
});

test('loadConversation caps to the most recent N, still chronological', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, 'b@x.com');
  for (let i = 0; i < 10; i++) await appendMessages(db, m, [{ role: 'member', text: `m${i}` }]);
  const last3 = await loadConversation(db, m, 3);
  assert.deepEqual(last3.map((x) => x.text), ['m7', 'm8', 'm9']);
});

test('a thread is private to its member', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const a = await member(db, 'a2@x.com');
  const b = await member(db, 'b2@x.com');
  await appendMessages(db, a, [{ role: 'member', text: 'mine' }]);
  assert.equal((await loadConversation(db, b)).length, 0);
  assert.equal((await loadConversation(db, a)).length, 1);
});
