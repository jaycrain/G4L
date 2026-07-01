import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { emitHarvestMoment, commitKeeper, harvestIdentityKeeper } from '../lib/agent/harvest.ts';
import { playbookForAgent } from '../lib/playbook/store.ts';

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const raw = new PGlite(); // in-memory
  await raw.waitReady;
  const db: Db = { query: (t, p) => (raw as any).query(t, p), exec: (t) => (raw as any).exec(t) };
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T','t@t.com') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('HARVEST emit — writes an immutable harvest_moment event with the meta contract (momentId, keeperType, schemaVersion)', async () => {
  const { db, memberId } = await freshDb();
  const momentId = await emitHarvestMoment(db, memberId, {
    destinationIntent: 'keeper',
    keeperType: 'definition',
    sourceRef: { kind: 'onboarding', ref: 'identity', label: 'Identity · the Runner' },
    payloadRef: 'a marathoner who ran before dawn',
  });
  assert.ok(momentId, 'returns a momentId (the correlation id)');
  const ev = (await db.query<any>(`select * from member_event where kind='harvest_moment' and member_id=$1`, [memberId])).rows;
  assert.equal(ev.length, 1, 'one immutable harvest_moment event');
  assert.equal(ev[0].meta.momentId, momentId);
  assert.equal(ev[0].meta.destinationIntent, 'keeper');
  assert.equal(ev[0].meta.keeperType, 'definition');
  assert.equal(ev[0].meta.schemaVersion, 1);
  assert.equal(ev[0].meta.payloadRef, 'a marathoner who ran before dawn');
});

test('HARVEST private source — the event carries a reference, never the body', async () => {
  const { db, memberId } = await freshDb();
  await emitHarvestMoment(db, memberId, {
    destinationIntent: 'keeper', keeperType: 'tell',
    sourceRef: { kind: 'legacy_letter' }, payloadRef: 'the intimate private letter text', private: true,
  });
  const ev = (await db.query<any>(`select meta from member_event where kind='harvest_moment' and member_id=$1`, [memberId])).rows[0];
  assert.equal(ev.meta.payloadRef, '[private:legacy_letter]', 'a reference, not the body');
  assert.equal(/intimate private letter/.test(JSON.stringify(ev.meta)), false, 'the body never reaches the QI log');
});

test('HARVEST keeper commit — playbook_entry carries keeper_type (authoritative) + moment_id (joins the event), keeper_type is free text', async () => {
  const { db, memberId } = await freshDb();
  await commitKeeper(db, memberId, { momentId: '11111111-1111-1111-1111-111111111111', keeperType: 'principle', section: 'why_works', body: 'rest is training too', state: 'kept' });
  const pe = (await db.query<any>(`select * from playbook_entry where member_id=$1`, [memberId])).rows[0];
  assert.equal(pe.keeper_type, 'principle');
  assert.equal(pe.moment_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(pe.authorship, 'gathered', 'authorship retained');
  assert.equal(pe.state, 'kept');
});

test('HARVEST identity detector — a confirmed identity → a kept `definition` keeper, event+keeper joined by momentId, recall-ready', async () => {
  const { db, memberId } = await freshDb();
  const momentId = await harvestIdentityKeeper(db, memberId, {
    identityNoun: 'Runner', identitySkipped: false, athleticPast: 'a marathoner who ran before dawn',
  });
  assert.ok(momentId, 'harvested');
  // event + keeper share the momentId (the two-layer join)
  const ev = (await db.query<any>(`select meta from member_event where kind='harvest_moment' and member_id=$1`, [memberId])).rows[0];
  const pe = (await db.query<any>(`select * from playbook_entry where member_id=$1`, [memberId])).rows[0];
  assert.equal(ev.meta.momentId, momentId);
  assert.equal(pe.moment_id, momentId, 'keeper joins its event by momentId');
  assert.equal(pe.keeper_type, 'definition');
  assert.equal(pe.section, 'own_words');
  assert.equal(pe.state, 'kept', 'confirmed at the card → kept');
  assert.match(pe.body, /marathoner who ran before dawn/, 'the member’s own verbatim words');
  // recall-ready: playbookForAgent (own_words / kept) surfaces it for v2.2 to use
  const ctx = await playbookForAgent(db, memberId);
  assert.ok(ctx.keepers.some((k) => /marathoner who ran before dawn/.test(k.body)), 'recall-ready via playbookForAgent');
});

test('HARVEST identity detector — RESTRAINT: a skipped/unnamed identity harvests nothing', async () => {
  const { db, memberId } = await freshDb();
  assert.equal(await harvestIdentityKeeper(db, memberId, { identitySkipped: true }), null, 'skipped → no harvest');
  assert.equal(await harvestIdentityKeeper(db, memberId, { identityNoun: '' }), null, 'unnamed → no harvest');
  assert.equal((await db.query<any>(`select count(*) n from member_event where kind='harvest_moment'`)).rows[0].n, 0, 'no event emitted');
  assert.equal((await db.query<any>(`select count(*) n from playbook_entry where member_id=$1`, [memberId])).rows[0].n, 0, 'no keeper committed');
});
