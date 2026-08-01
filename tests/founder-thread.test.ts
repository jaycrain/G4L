import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { appendFounderTurns, loadFounderThread, clearFounderThread, __resetFounderThreadCache } from '../lib/founder/thread.ts';

// The Founder Console thread is durable now (Jay, 2026-08-01) — and it holds members' words second-hand, so
// the retention window and the purge are properties to pin, not features to trust.

const fresh = async (): Promise<Db> => {
  __resetFounderThreadCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  return db;
};

test('the thread round-trips oldest→newest, with the tool receipts', async () => {
  const db = await fresh();
  await appendFounderTurns(db, [
    { role: 'jay', text: "who hasn't been back?" },
    { role: 'companion', text: 'Pat — 9 days.', looked: ['find_members'] },
  ]);
  const thread = await loadFounderThread(db);
  assert.equal(thread.length, 2, 'came back empty — the read is broken, not the history');
  assert.deepEqual(thread.map((t) => t.role), ['jay', 'companion']);
  assert.deepEqual(thread[1]!.looked, ['find_members']);
});

test('CLEAR deletes the rows — not just the screen', async () => {
  // The purge this feature was agreed WITH. A thread where Jay asked about one member holds her words; if
  // "clear" only emptied the view, it would be a comforting lie about data that was still sitting there.
  const db = await fresh();
  await appendFounderTurns(db, [{ role: 'jay', text: 'tell me about Donna' }]);
  await clearFounderThread(db);
  assert.deepEqual(await loadFounderThread(db), []);
  const { rows } = await db.query(`select 1 from founder_message`);
  assert.equal(rows.length, 0, 'the rows must actually be gone');
});

test('retention prunes past 30 days on write', async () => {
  const db = await fresh();
  await db.query(
    `insert into founder_message (operator, role, text, created_at) values ('jay','jay','ancient', now() - interval '40 days')`,
  );
  await appendFounderTurns(db, [{ role: 'jay', text: 'today' }]);
  const texts = (await loadFounderThread(db)).map((t) => t.text);
  assert.ok(!texts.includes('ancient'), 'a 40-day-old conversation about members must not still be here');
  assert.ok(texts.includes('today'));
});

test('BEFORE the migration: writes no-op, reads are empty, nothing throws', async () => {
  // Prod migrations are applied by hand, so code and schema never land together (SEC-12, learned the hard way).
  __resetFounderThreadCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('drop table if exists founder_message');
  await assert.doesNotReject(() => appendFounderTurns(db, [{ role: 'jay', text: 'x' }]));
  assert.deepEqual(await loadFounderThread(db), []);
  await assert.doesNotReject(() => clearFounderThread(db));
});
