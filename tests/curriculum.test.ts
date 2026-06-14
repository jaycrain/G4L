import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  listCurriculum,
  getAsset,
  getSession,
  phaseColumns,
  dailyLayer,
  listBadges,
  getBadge,
  kindProfile,
  CATEGORY_COLOR,
} from '../lib/curriculum/registry.ts';
import {
  saveAnswer,
  getSessionProgress,
  closeSession,
  isSessionClosed,
  closedSessionIds,
  listFacets,
  addFacet,
  earnBadge,
  earnedBadgeIds,
  setGate,
  hasGate,
  listGates,
} from '../lib/curriculum/store.ts';

// ---------- registry (data-driven) ----------
test('Identity Excavation is fully authored: 4 steps, reflect close, earns Named Yourself, last step yields a facet', () => {
  const s = getSession('RCN-EXC');
  assert.ok(s);
  assert.equal(s!.steps?.length, 4);
  assert.equal(s!.close_type, 'reflect');
  assert.equal(s!.earns, 'named-yourself');
  assert.equal(s!.steps![3]!.contributes, 'facet');
  assert.ok(s!.steps![1]!.companion_frame.length > 0 && s!.steps![1]!.probe.length > 0);
});

test('getSession returns null for a non-session asset (a checkpoint)', () => {
  assert.equal(getSession('RCN-CHECK'), null);
  assert.equal(getAsset('RCN-CHECK')!.kind, 'checkpoint');
});

test('the forecast is derived purely from registry rows — every non-daily asset, order-sorted', () => {
  const cols = phaseColumns();
  assert.deepEqual(cols.map((c) => c.phase), ['reconnect', 'rewire', 'rebuild', 'reclaim']);
  // reconnect column: 8 items in order, ending in the Checkpoint
  const recon = cols[0]!.items;
  assert.equal(recon.length, 8);
  assert.deepEqual(recon.map((a) => a.order), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(recon[recon.length - 1]!.kind, 'checkpoint');
  // every non-daily asset appears exactly once across the columns (proves no hardcoding)
  const inColumns = cols.flatMap((c) => c.items).length;
  const nonDaily = listCurriculum().filter((a) => a.layer !== 'Daily').length;
  assert.equal(inColumns, nonDaily);
});

test('the daily layer runs across, separate from the phase columns', () => {
  const daily = dailyLayer();
  assert.ok(daily.length >= 5);
  assert.ok(daily.every((a) => a.layer === 'Daily'));
  // daily ids never leak into the phase columns
  const colIds = new Set(phaseColumns().flatMap((c) => c.items).map((a) => a.id));
  assert.ok(daily.every((a) => !colIds.has(a.id)));
});

test('adding a 25th Session is a data row — the loaders pick it up with no renderer change', () => {
  // Simulate by checking the generic path: a hypothetical row would flow through phaseColumns purely by
  // phase/order/layer. Here we assert the contract the renderer relies on: items are sorted by order
  // and typed by kind, so a new row needs only those fields.
  for (const col of phaseColumns()) {
    for (let i = 1; i < col.items.length; i++) assert.ok(col.items[i]!.order >= col.items[i - 1]!.order);
    for (const a of col.items) assert.ok(['session', 'checkpoint', 'measurement', 'pulse', 'tracker'].includes(a.kind));
  }
});

test('badges carry category color; profiles exist for every kind', () => {
  const named = getBadge('named-yourself');
  assert.equal(named!.color, CATEGORY_COLOR.milestone);
  assert.equal(named!.ceremony, true);
  assert.equal(listBadges().find((b) => b.id === 'onboarding-courage')!.ceremony, false);
  assert.equal(kindProfile('session').scoreWeight, 'high');
  assert.equal(kindProfile('pulse').scoreWeight, 'low');
});

// ---------- store ----------
async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Tom Miller','tom@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

test('session progress: save answers, advance, close', async () => {
  const { db, memberId } = await seed();
  await saveAnswer(db, memberId, 'RCN-EXC', 1, 'Racing at dawn', 2);
  await saveAnswer(db, memberId, 'RCN-EXC', 2, 'The racer they drafted off', 3);
  let p = await getSessionProgress(db, memberId, 'RCN-EXC');
  assert.equal(p!.currentStep, 3);
  assert.equal(p!.answers['1'], 'Racing at dawn');
  assert.equal(p!.answers['2'], 'The racer they drafted off');
  assert.equal(p!.status, 'in_progress');
  assert.equal(await isSessionClosed(db, memberId, 'RCN-EXC'), false);
  assert.equal(await closeSession(db, memberId, 'RCN-EXC'), true);
  assert.equal(await isSessionClosed(db, memberId, 'RCN-EXC'), true);
  assert.deepEqual(await closedSessionIds(db, memberId), ['RCN-EXC']);
  // closing keeps answers, and a later save doesn't reopen a closed session
  await saveAnswer(db, memberId, 'RCN-EXC', 4, 'the Elite Cyclist');
  p = await getSessionProgress(db, memberId, 'RCN-EXC');
  assert.equal(p!.status, 'closed');
  assert.equal(p!.answers['4'], 'the Elite Cyclist');
});

test('facets: append + case-insensitive dedupe, ordered', async () => {
  const { db, memberId } = await seed();
  assert.equal((await addFacet(db, memberId, 'the Elite Cyclist', 'RCN-EXC')).ok, true);
  assert.equal((await addFacet(db, memberId, 'the elite cyclist')).ok, false); // dupe
  assert.equal((await addFacet(db, memberId, '  ')).ok, false); // empty
  await addFacet(db, memberId, 'the Builder');
  const f = await listFacets(db, memberId);
  assert.deepEqual(f.map((x) => x.text), ['the Elite Cyclist', 'the Builder']);
  assert.equal(f[0]!.sourceSession, 'RCN-EXC');
});

test('badges earn idempotently (newly-earned signal fires once)', async () => {
  const { db, memberId } = await seed();
  assert.equal(await earnBadge(db, memberId, 'named-yourself'), true);
  assert.equal(await earnBadge(db, memberId, 'named-yourself'), false); // already earned
  assert.deepEqual(await earnedBadgeIds(db, memberId), ['named-yourself']);
});

test('phase gates: set + check', async () => {
  const { db, memberId } = await seed();
  assert.equal(await hasGate(db, memberId, 'rewire_unlocked'), false);
  await setGate(db, memberId, 'reconnect_core_complete');
  await setGate(db, memberId, 'rewire_unlocked');
  await setGate(db, memberId, 'rewire_unlocked'); // idempotent
  assert.equal(await hasGate(db, memberId, 'rewire_unlocked'), true);
  assert.deepEqual((await listGates(db, memberId)).sort(), ['reconnect_core_complete', 'rewire_unlocked']);
});
