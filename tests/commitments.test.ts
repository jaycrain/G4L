import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { setCommitment, releaseCommitment, activeCommitments, commitmentTexts } from '../lib/commitments/store.ts';

// First-class member commitments (0060) — the durable home for the movement + eating changes. One active per domain,
// setting a new one releases the prior (kept as history), reads never surface released ones.

let seq = 0;
async function member(db: Db): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Tester', $1) returning member_id`,
    [`tester${seq++}@example.com`],
  );
  return rows[0]!.member_id;
}

test('setCommitment persists a durable, member-owned commitment per domain', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);

  assert.deepEqual(await activeCommitments(db, m), [], 'none to start');

  await setCommitment(db, m, 'activity', 'a 30-minute morning walk, 2-3 days', 'b3');
  await setCommitment(db, m, 'diet', 'a vegetable at dinner', 'b3');

  const texts = await commitmentTexts(db, m);
  assert.equal(texts.activity, 'a 30-minute morning walk, 2-3 days');
  assert.equal(texts.diet, 'a vegetable at dinner');
  assert.equal((await activeCommitments(db, m)).length, 2, 'one active per domain');
});

test('setting a new commitment for a domain releases the prior (kept as history, one active enforced)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);

  await setCommitment(db, m, 'activity', 'walk 3 days');
  const r = await setCommitment(db, m, 'activity', 'ride 2 days'); // replace
  assert.equal(r.changed, true);

  const active = await activeCommitments(db, m);
  assert.equal(active.length, 1, 'still exactly one active in the domain');
  assert.equal(active[0]!.text, 'ride 2 days', 'the new one is active');

  // The prior is retained as history (released), not deleted.
  const { rows } = await db.query<{ n: number }>("select count(*)::int n from commitment where member_id=$1 and status='released'", [m]);
  assert.equal(rows[0]!.n, 1, 'the replaced commitment is kept as history');
});

test('setCommitment is idempotent on identical text (no history churn)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await setCommitment(db, m, 'diet', 'more veg');
  const again = await setCommitment(db, m, 'diet', '  more veg  '); // same after trim
  assert.equal(again.changed, false, 'unchanged → no-op');
  const { rows } = await db.query<{ n: number }>('select count(*)::int n from commitment where member_id=$1', [m]);
  assert.equal(rows[0]!.n, 1, 'no duplicate/history row written');
});

test('releaseCommitment sets aside the active one (kept, not deleted); reads drop it', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await setCommitment(db, m, 'activity', 'walk daily');
  await releaseCommitment(db, m, 'activity');
  assert.equal((await activeCommitments(db, m)).length, 0, 'no active after release');
  const { rows } = await db.query<{ n: number }>('select count(*)::int n from commitment where member_id=$1', [m]);
  assert.equal(rows[0]!.n, 1, 'row kept as history');
});

test('setCommitment rejects empty text (never a silent no-op that loses the data)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await assert.rejects(() => setCommitment(db, m, 'activity', '   '), /empty/);
});
