import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { gatherSources, memberWords, reclaimSources, momentumPattern } from '../lib/outreach/sources.ts';

async function member(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Src QA','src.qa@x.com') returning member_id`,
  );
  return { db, id: rows[0]!.member_id };
}

const keeper = (db: Db, id: string, body: string, section = 'own_words') =>
  db.query(
    `insert into playbook_entry (member_id, section, body, authorship, state) values ($1,$2,$3,'gathered','kept')`,
    [id, section, body],
  );
const reclaim = (db: Db, id: string, text: string, order: number) =>
  db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,$2,$3)`, [id, text, order]);
const call = (db: Db, id: string, type: string) =>
  db.query(`insert into momentum_call (member_id, type, source) values ($1,$2,'rail')`, [id, type]);

test('empty member → no sources (engine will hold, never invents)', async () => {
  const { db, id } = await member();
  assert.deepEqual(await gatherSources(db, id, 'morning_presence'), []);
});

test('words stream returns the member\'s own kept keepers, verbatim, with provenance', async () => {
  const { db, id } = await member();
  await keeper(db, id, 'I used to run before work');
  const w = await memberWords(db, id);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.stream, 'words');
  assert.match(w[0]!.ref, /^keeper:/);
  assert.equal(w[0]!.quote, 'I used to run before work');
});

test('reclaim stream returns active items only (soft-deleted never resurface)', async () => {
  const { db, id } = await member();
  await reclaim(db, id, 'Get back on the bike', 0);
  await db.query(`insert into reclaim_item (member_id, text, sort_order, removed_at) values ($1,'dropped',1, now())`, [id]);
  const r = await reclaimSources(db, id);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.quote, 'Get back on the bike');
  assert.match(r[0]!.ref, /^reclaim:/);
});

test('pattern stream summarizes recent calls factually, with pluralization', async () => {
  const { db, id } = await member();
  await call(db, id, 'good_call');
  await call(db, id, 'good_call');
  await call(db, id, 'false_start');
  const p = await momentumPattern(db, id);
  assert.equal(p.length, 1);
  assert.equal(p[0]!.stream, 'pattern');
  assert.equal(p[0]!.ref, 'momentum:7d');
  assert.equal(p[0]!.quote, '2 good calls and 1 false start in the last 7 days');
});

test('no calls → no pattern source (nothing invented)', async () => {
  const { db, id } = await member();
  assert.deepEqual(await momentumPattern(db, id), []);
});

test('trigger biases the lead stream but never drops real data', async () => {
  const { db, id } = await member();
  await keeper(db, id, 'the athlete in me');
  await reclaim(db, id, 'Run a 5k again', 0);
  await call(db, id, 'good_call');

  const milestone = await gatherSources(db, id, 'reclaim_milestone');
  assert.equal(milestone[0]!.stream, 'reclaim', 'reclaim_milestone leads with the list');

  const log = await gatherSources(db, id, 'post_log');
  assert.equal(log[0]!.stream, 'pattern', 'post_log leads with the just-logged pattern');

  // all three streams are present regardless of order
  const streams = new Set(milestone.map((s) => s.stream));
  assert.deepEqual([...streams].sort(), ['pattern', 'reclaim', 'words']);
});
