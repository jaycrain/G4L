import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { allBeats, beatById, goalCategory } from '../lib/beats/registry.ts';
import { predicateMet, isReady } from '../lib/beats/readiness.ts';
import { bindGoalItem, effectiveCloseType, renderClose } from '../lib/beats/serves.ts';
import { resolveClose } from '../lib/beats/close.ts';
import { selectNextBeat, rankBeats } from '../lib/beats/select.ts';
import { inferCategory, isVagueReclaim } from '../lib/beats/category.ts';
import { addReclaimItems, assembleState, serveBeat, completeBeat, getReclaimItems, getJourney, getBeatHistory, dailyHardiness } from '../lib/beats/store.ts';
import { getDashboard, submitIdq } from '../lib/gateway/flow.ts';
import { getGrinta } from '../lib/grinta/index.ts';
import type { MemberBeatState, ReclaimItem } from '../lib/beats/types.ts';

// ---- pure engine ----------------------------------------------------------------------

const baseState = (over: Partial<MemberBeatState> = {}): MemberBeatState => ({
  completedBeatIds: new Set(),
  reclaimItems: [],
  identitySet: true,
  doorCaptured: true,
  idqDone: true,
  rewireCheckpointDone: false,
  rebuildFoundationCount: 0,
  daysSinceLastIdq: 0,
  lowestDimension: null,
  ...over,
});

const item = (over: Partial<ReclaimItem>): ReclaimItem => ({
  id: 'i', text: 'ride before work', category: 'physical', rhythm: 'weekly',
  state: 'not_yet', closerCount: 0, sortOrder: 0, lastServedAt: null, ...over,
});

test('the registry loads all 70 Beats with valid close types', () => {
  const beats = allBeats();
  assert.equal(beats.length, 70);
  assert.ok(beats.every((b) => ['goal', 'rep', 'reflect'].includes(b.close_type)));
});

test('readiness predicates resolve the Slice Spec vocabulary', () => {
  const threeItems = [item({}), item({ id: 'b' }), item({ id: 'c' })];
  assert.equal(predicateMet('reconnect_core_complete', baseState({ reclaimItems: threeItems })), true);
  assert.equal(predicateMet('reconnect_core_complete', baseState({ reclaimItems: [item({})], idqDone: true })), false); // <3
  assert.equal(predicateMet('reconnect_core_complete', baseState({ reclaimItems: threeItems, idqDone: false })), false);
  assert.equal(predicateMet('rewire_threshold_met', baseState({ rewireCheckpointDone: true })), true);
  assert.equal(predicateMet('rebuild_underway', baseState({ rebuildFoundationCount: 1 })), true);
  assert.equal(predicateMet('day>=60_since_last_idq', baseState({ daysSinceLastIdq: 61 })), true);
  assert.equal(predicateMet('RWR-FOO-01', baseState({ completedBeatIds: new Set(['RWR-FOO-01']) })), true);
});

test('Rebuild Foundation opens in parallel with Rewire; Structure waits for the Rewire threshold', () => {
  const ready = baseState({ reclaimItems: [item({}), item({ id: 'b' }), item({ id: 'c' })] }); // reconnect_core_complete
  assert.equal(isReady(beatById('RBD-FST-01')!, ready), true); // Foundation — opens now
  assert.equal(isReady(beatById('RBD-FUEL-01')!, ready), false); // Structure — needs rewire_threshold_met
  assert.equal(isReady(beatById('RBD-FUEL-01')!, { ...ready, rewireCheckpointDone: true, completedBeatIds: new Set(['RBD-7MIN-02']) }), true);
});

test('serves binds least-recently-served open item in category; no match degrades to rep', () => {
  const goal = beatById('RWR-FOO-02')!; // goal, serves physical
  assert.equal(goalCategory(goal), 'physical');
  const items = [
    item({ id: 'p1', category: 'physical', lastServedAt: '2026-06-09T00:00:00Z' }),
    item({ id: 'p2', category: 'physical', lastServedAt: null }), // never served → first
    item({ id: 's1', category: 'self' }),
  ];
  assert.equal(bindGoalItem(goal, items)!.id, 'p2');
  assert.equal(effectiveCloseType(goal, items), 'goal');
  // no open physical item → degrade to rep
  const noneOpen = [item({ id: 'p1', category: 'physical', state: 'reclaimed' }), item({ id: 's1', category: 'self' })];
  assert.equal(bindGoalItem(goal, noneOpen), null);
  assert.equal(effectiveCloseType(goal, noneOpen), 'rep');
  assert.match(renderClose(goal, [item({ text: 'ride before work', category: 'physical' })]), /ride before work/);
});

test('resolveClose: components per Decision 4, and the reclaimed threshold', () => {
  const it = item({ closerCount: 0 });
  const closer = resolveClose({ effectiveType: 'goal', response: 'closer', boundItem: it, isReturn: false });
  assert.deepEqual(
    { c: closer.feedsConsistency, rec: closer.feedsRecovery, reach: closer.feedsReach },
    { c: true, rec: false, reach: true },
  );
  assert.equal(closer.itemUpdate!.newState, 'closer');
  // third closer flips to reclaimed (threshold 3)
  const third = resolveClose({ effectiveType: 'goal', response: 'closer', boundItem: item({ closerCount: 2 }), isReturn: true });
  assert.equal(third.itemUpdate!.reclaimedNow, true);
  assert.equal(third.feedsRecovery, true); // return after a miss
  // rep + reflect feed Consistency only; no item movement
  const rep = resolveClose({ effectiveType: 'rep', response: 'yes', boundItem: null, isReturn: false });
  assert.deepEqual({ c: rep.feedsConsistency, reach: rep.feedsReach, item: rep.itemUpdate }, { c: true, reach: false, item: null });
});

test('vague Reclaim items are caught, so a goal Beat never points a close at fog', () => {
  assert.equal(isVagueReclaim('feeling better about myself'), true);
  assert.equal(isVagueReclaim('be happier'), true);
  assert.equal(isVagueReclaim('ride before work without dreading it'), false);
  assert.equal(isVagueReclaim('get body weight down to 190'), false);
  const goal = beatById('RWR-FOO-02')!; // goal, serves physical
  // only a vague item in the category → no bind → close degrades to rep (no "did this move you toward fog")
  const vagueOnly = [item({ category: 'physical', text: 'feel better about myself' })];
  assert.equal(bindGoalItem(goal, vagueOnly), null);
  assert.equal(effectiveCloseType(goal, vagueOnly), 'rep');
  // a specific item in the category still binds normally
  const withSpecific = [vagueOnly[0]!, item({ id: 'p2', category: 'physical', text: 'ride before work' })];
  assert.equal(bindGoalItem(goal, withSpecific)!.text, 'ride before work');
  assert.equal(effectiveCloseType(goal, withSpecific), 'goal');
});

test('inferCategory maps to an IDQ dimension, defaulting to self', () => {
  assert.equal(inferCategory('ride before work without dreading it'), 'physical');
  assert.equal(inferCategory('call my brother every week'), 'social');
  assert.equal(inferCategory('feel hopeful about the next chapter'), 'outlook');
  assert.equal(inferCategory('recognize myself in the mirror'), 'self');
});

// ---- DB-backed slice proof (Tom) ------------------------------------------------------

async function seedTom(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Tom Miller','tom@x.com','Cyclist','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  // baseline IDQ → ID Score 60 (all 3s)
  const idq = await submitIdq(db, memberId, Array.from({ length: 24 }, () => 3));
  assert.ok(idq.ok);
  // categorized Reclaim List (one physical item for the goal Beat to bind)
  await addReclaimItems(db, memberId, [
    { text: 'ride before work without dreading it', category: 'physical' },
    { text: 'recognize myself in the mirror', category: 'self' },
    { text: 'call my brother weekly', category: 'social' },
  ]);
  return { db, memberId };
}

test('Tom reaches reconnect_core_complete and the engine selects a Beat', async () => {
  const { db, memberId } = await seedTom();
  const state = await assembleState(db, memberId);
  assert.equal(predicateMet('reconnect_core_complete', state), true);
  assert.ok(selectNextBeat(state)); // something to serve
});

test('the onboarding→Beat handoff seeds covered Reconnect Beats and never re-serves them', async () => {
  const { db, memberId } = await seedTom(); // submitIdq seeds the covered Beats
  const state = await assembleState(db, memberId);
  // identity-naming + reclaim-list-building Beats are marked done by the gateway
  assert.ok(state.completedBeatIds.has('RCN-EXC-04'));
  assert.ok(state.completedBeatIds.has('RCN-WIN-03'));
  // and the surface won't re-serve a covered Beat
  const next = selectNextBeat(state);
  assert.ok(next && !['RCN-EXC-04', 'RCN-WIN-03', 'RCN-FDR-01'].includes(next.beat_id));
});

test('selection doses toward the weakest IDQ dimension', () => {
  const outlookBeat = beatById('RWR-DIS-01')!; // serves outlook
  const physicalBeat = beatById('RWR-NUM-01')!; // serves physical
  const ranked = rankBeats([outlookBeat, physicalBeat], baseState({ lowestDimension: 'physical' }));
  assert.equal(ranked[0]!.beat_id, 'RWR-NUM-01'); // weakest dimension served first
});

test('completing a reflect Beat moves Grinta — Consistency credits every completion', async () => {
  const { db, memberId } = await seedTom();
  const before = (await getGrinta(db, memberId, 'Cyclist')).score;
  await completeBeat(db, memberId, 'RWR-FOO-01', 'a memory surfaced'); // a reflect-close Beat
  const after = (await getGrinta(db, memberId, 'Cyclist')).score;
  assert.ok(after > before, `Grinta should rise on a reflect completion (${before} → ${after})`);
});

test('getBeatHistory returns completed work, re-readable, excluding onboarding seeds', async () => {
  const { db, memberId } = await seedTom();
  await completeBeat(db, memberId, 'RWR-FOO-01', 'a memory surfaced'); // reflect
  await completeBeat(db, memberId, 'RWR-DIS-01', 'yes'); // rep
  const hist = await getBeatHistory(db, memberId);
  assert.equal(hist.length, 2); // only the worked Beats, not the 8 onboarding seeds
  assert.equal(hist[0]!.beatId, 'RWR-DIS-01'); // most recent first
  assert.equal(hist[0]!.answered, 'Yes');
  const reflectItem = hist.find((h) => h.beatId === 'RWR-FOO-01')!;
  assert.match(reflectItem.answered, /a memory surfaced/);
  assert.ok(reflectItem.content.length > 0); // the content is re-readable
});

test('dailyHardiness serves one cross-cutting rep, then rests once done today', async () => {
  const { db, memberId } = await seedTom();
  const d1 = await dailyHardiness(db, memberId);
  assert.ok(d1.served, 'a daily Hardiness Beat is offered');
  assert.equal(d1.served!.beat.source, 'hardiness_beat');
  assert.equal(d1.doneToday, false);
  await completeBeat(db, memberId, d1.served!.beat.beat_id, 'yes');
  const d2 = await dailyHardiness(db, memberId);
  assert.equal(d2.doneToday, true);
  assert.equal(d2.served, null);
  // and it shows up in Past Beats (re-readable record)
  const hist = await getBeatHistory(db, memberId);
  assert.ok(hist.some((h) => h.beatId === d1.served!.beat.beat_id));
});

test('getJourney reports a place and Reclaim List movement, not a score', async () => {
  const { db, memberId } = await seedTom();
  const j = await getJourney(db, memberId);
  assert.ok(j.currentRLabel); // a place on the path
  assert.equal(j.reclaim.total, 3);
  assert.equal(j.reclaim.notYet, 3);
  assert.match(j.line, /Reclaim List|reclaimed|win back/i);
});

test('SLICE: reflect + rep + goal closes move Grinta & the Reclaim List, ID Score holds', async () => {
  const { db, memberId } = await seedTom();
  const before = await getDashboard(db, memberId);
  assert.equal(before!.score!.score, 60);

  // one reflect, one rep
  await completeBeat(db, memberId, 'RWR-FOO-01', 'noted'); // reflect
  await completeBeat(db, memberId, 'RWR-DIS-01', 'yes'); // rep

  // one goal — binds to the physical item; close text carries the item
  const served = (await serveBeat(db, memberId, 'RWR-FOO-02'))!;
  assert.equal(served.effectiveType, 'goal');
  assert.match(served.close, /ride before work/);

  // three "closer"s reclaim the physical item (threshold 3)
  let last;
  for (let i = 0; i < 3; i++) last = await completeBeat(db, memberId, 'RWR-FOO-02', 'closer');
  assert.equal(last!.feedsReach, true);
  assert.equal(last!.itemReclaimed, true);

  // Reclaim item advanced to reclaimed
  const items = await getReclaimItems(db, memberId);
  const physical = items.find((i) => i.category === 'physical')!;
  assert.equal(physical.state, 'reclaimed');
  assert.equal(physical.closerCount, 3);

  // component plumbing (excluding the onboarding-seeded Reconnect Beats): our 5 completions all
  // feed Consistency; the 3 goal-closers feed Reach.
  const flags = (
    await db.query<{ c: number; reach: number }>(
      `select count(*) filter (where feeds_consistency)::int c, count(*) filter (where feeds_reach)::int reach
       from beat_completion where member_id=$1 and close_response <> 'onboarding'`,
      [memberId],
    )
  ).rows[0]!;
  assert.equal(Number(flags.c), 5);
  assert.equal(Number(flags.reach), 3);

  // Grinta moved off zero from the work; ID Score is untouched by Beats (frozen contract)
  const grinta = await getGrinta(db, memberId, before!.identityNoun);
  assert.ok(grinta.score > 0);
  const after = await getDashboard(db, memberId);
  assert.equal(after!.score!.score, 60); // unchanged — only an IDQ retake moves it

  // and once the only physical item is reclaimed, the physical goal Beat degrades to rep
  const reServed = (await serveBeat(db, memberId, 'RWR-FOO-02'))!;
  assert.equal(reServed.effectiveType, 'rep');
});
