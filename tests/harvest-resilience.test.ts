import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harvestSignal } from '../lib/agent/harvest.ts';

// The prod silent-drop (2026-07-27): every arc ran emitHarvestMoment (member_event) THEN commitKeeper (playbook_entry)
// inside ONE swallowed try. When the moment insert threw on a prod member_event drift, the keeper never committed and
// the error vanished — Millie completed 6 sessions and harvested nothing. harvestSignal makes the two independent.

function fakeDb(onQuery: (sql: string) => unknown) {
  return { query: async (sql: string) => (onQuery(sql) ?? { rows: [{ moment_id: 'm' }] }) } as never;
}
function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const orig = console.error;
  console.error = () => {};
  return fn().finally(() => { console.error = orig; });
}

test('harvestSignal — a MOMENT-emit failure does NOT cost the keeper', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => {
    seen.push(sql);
    if (/member_event/.test(sql)) throw new Error('member_event drift: kind constraint rejects harvest_moment');
    return { rows: [] };
  });
  await quiet(() => harvestSignal(db, 'm1', { kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: 'My true line' }, 'rewire'));
  assert.ok(seen.some((s) => /insert into playbook_entry/.test(s)), 'the keeper still commits even though the moment emit threw');
});

test('harvestSignal — a happy path commits the keeper WITH the emitted moment id', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'mid-123' }] }; });
  await harvestSignal(db, 'm1', { kind: 'image', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: 'The finish line' }, 'rewire');
  assert.ok(seen.some((s) => /member_event/.test(s)), 'emits the moment');
  assert.ok(seen.some((s) => /insert into playbook_entry/.test(s)), 'commits the keeper');
});

test('harvestSignal — a share-only / private signal commits NO keeper', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'm' }] }; });
  await harvestSignal(db, 'm1', { kind: 'letter', destinationIntent: 'share', payloadRef: 'a private letter' }, 'reconnect');
  assert.ok(!seen.some((s) => /insert into playbook_entry/.test(s)), 'share-only never lands a stored keeper');
});
