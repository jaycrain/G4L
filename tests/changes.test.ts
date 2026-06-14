import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSnapshot, asSnapshot, type DashboardSnapshot } from '../lib/agent/changes.ts';

const base: DashboardSnapshot = { idScore: 60, grinta: 24, beatsDone: 5, reclaimedItems: [], measures: { Weight: 213.4 } };

test('no prior snapshot → no changes (first interaction)', () => {
  assert.deepEqual(diffSnapshot(null, base), []);
});

test('detects score, grinta, beats, tracker movement, and a new reclaim', () => {
  const curr: DashboardSnapshot = {
    idScore: 63,
    grinta: 28,
    beatsDone: 7,
    reclaimedItems: ['Weight down to 190'],
    measures: { Weight: 211.0, 'Funds raised': 2525 },
  };
  const d = diffSnapshot(base, curr);
  assert.ok(d.some((x) => x.includes('ID Score: 60 → 63')));
  assert.ok(d.some((x) => x.includes('GRINTA! Index: 24 → 28')));
  assert.ok(d.some((x) => x.includes('2 new Beats completed')));
  assert.ok(d.some((x) => x.includes('Weight: 213.4 → 211')));
  assert.ok(d.some((x) => x.includes('New tracker started: Funds raised')));
  assert.ok(d.some((x) => x.includes('Newly reclaimed: "Weight down to 190"')));
});

test('nothing moved → empty', () => {
  assert.deepEqual(diffSnapshot(base, { ...base }), []);
});

test('notices a finished Session and a newly-named self (curriculum awareness)', () => {
  const prev: DashboardSnapshot = { ...base, closedSessions: [], namedSelves: ['the Elite Cyclist'] };
  const curr: DashboardSnapshot = {
    ...base,
    closedSessions: ['Identity Excavation'],
    namedSelves: ['the Elite Cyclist', 'the Entrepreneur'],
  };
  const d = diffSnapshot(prev, curr);
  assert.ok(d.some((x) => x.includes('Finished Identity Excavation')));
  assert.ok(d.some((x) => x.includes('the Entrepreneur')));
  assert.ok(!d.some((x) => x.includes('the Elite Cyclist')), 'an already-named self is not re-reported');
});

test('notices crossing a Checkpoint into a new R (the gateway moment)', () => {
  const prev: DashboardSnapshot = { ...base, activePhase: 'Reconnect' };
  const curr: DashboardSnapshot = { ...base, activePhase: 'Rewire' };
  const d = diffSnapshot(prev, curr);
  assert.ok(d.some((x) => x.includes('Crossed into Rewire')));
  assert.ok(d.some((x) => x.includes('Reconnect complete')));
});

test('an older snapshot with no curriculum fields catches up once', () => {
  const prev = asSnapshot(JSON.stringify(base)); // base has no closedSessions/namedSelves
  const curr: DashboardSnapshot = { ...base, closedSessions: ['Identity Excavation'], namedSelves: ['the Builder'] };
  const d = diffSnapshot(prev, curr);
  assert.ok(d.some((x) => x.includes('Finished Identity Excavation')));
  assert.ok(d.some((x) => x.includes('the Builder')));
});

test('does not report a goal that was already reclaimed', () => {
  const prev: DashboardSnapshot = { ...base, reclaimedItems: ['Race done'] };
  const curr: DashboardSnapshot = { ...base, reclaimedItems: ['Race done'] };
  assert.deepEqual(diffSnapshot(prev, curr), []);
});

test('asSnapshot tolerates a JSON string (jsonb returned as text)', () => {
  const s = asSnapshot(JSON.stringify(base));
  assert.ok(s);
  assert.equal(s!.idScore, 60);
  assert.equal(s!.measures.Weight, 213.4);
});
