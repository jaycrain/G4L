import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { BITES, pickDailyBite, getBite } from '../lib/bites/definitions.ts';
import { consumeBite, consumedCodes, getBitePanel } from '../lib/bites/store.ts';
import { getGrinta } from '../lib/grinta/index.ts';

async function member(db: Db, email: string): Promise<string> {
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun) values ('M', $1, 'athlete') returning member_id`,
    [email],
  );
  return r.rows[0]!.member_id;
}

test('pickDailyBite skips consumed and prefers the current focus', () => {
  const none = new Set<string>();
  assert.equal(pickDailyBite(none)?.code, BITES[0]!.code);
  const rebuildBite = BITES.find((b) => b.group === 'Rebuild')!;
  assert.equal(pickDailyBite(none, 'Rebuild')?.code, rebuildBite.code);
  const allButOne = new Set(BITES.slice(1).map((b) => b.code));
  assert.equal(pickDailyBite(allButOne)?.code, BITES[0]!.code);
  assert.equal(pickDailyBite(new Set(BITES.map((b) => b.code))), null); // all consumed
});

test('consuming a bite records it, marks today done, and only counts once', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, 'a@x.com');

  const first = await getBitePanel(db, m);
  assert.equal(first.state, 'available');
  const code = first.state === 'available' ? first.bite.code : '';

  await consumeBite(db, m, code);
  await consumeBite(db, m, code); // idempotent
  assert.equal((await consumedCodes(db, m)).size, 1);

  const after = await getBitePanel(db, m);
  assert.equal(after.state, 'done'); // already had today's bite
});

test('a consumed bite feeds the GRINTA! Index (counts as showing up)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, 'b@x.com');
  const before = await getGrinta(db, m, 'athlete');
  await consumeBite(db, m, BITES[0]!.code);
  const after = await getGrinta(db, m, 'athlete');
  assert.ok(after.daysActive >= 1, 'consuming a bite is an active day');
  assert.ok(after.score > before.score, 'the Index moved');
});

test('only registered bites exist', () => {
  assert.ok(getBite(BITES[0]!.code));
  assert.equal(getBite('not-a-bite'), undefined);
});
