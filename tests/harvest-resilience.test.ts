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

// THE CONTRACT CHANGED ON 2026-08-19, and the ORIGINAL bug this file guards is unchanged: the two steps stay
// independent, so a moment-emit failure never costs the member their line. What changed is where the line goes —
// a conversational keeper is now OFFERED rather than committed. Donna's Visualization "picture" had been stored
// as her own housekeeping question ("Can you remind me what is on my Reclaim List?") because this path hardcoded
// `state: 'kept'` and walked around the propose-then-confirm gate the codebase already had.
test('harvestSignal — a MOMENT-emit failure does NOT cost the member the offer', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => {
    seen.push(sql);
    if (/member_event/.test(sql)) throw new Error('member_event drift: kind constraint rejects harvest_moment');
    return { rows: [] };
  });
  const offer = await quiet(() => harvestSignal(db, 'm1', { kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: 'My true line' }, 'rewire'));
  // Millie's shape: the QI insert threw inside a shared try and the keeper silently vanished. It still must not.
  assert.equal(offer?.body, 'My true line', 'she is still offered her line even though the moment emit threw');
  assert.ok(offer?.momentId, 'with a locally-generated correlation id — only the QI row is lost');
});

test('harvestSignal — a conversational keeper is OFFERED, and writes NOTHING to the Playbook', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'mid-123' }] }; });
  const offer = await harvestSignal(db, 'm1', { kind: 'image', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: 'The finish line' }, 'rewire');
  assert.ok(seen.some((s) => /member_event/.test(s)), 'still emits the QI moment — a declined offer must be measurable');
  assert.ok(!seen.some((s) => /insert into playbook_entry/.test(s)), 'NOTHING lands until she taps Keep');
  assert.equal(offer?.body, 'The finish line', 'the offer carries her exact words, because she is ruling on them');
  assert.equal(offer?.momentId, 'mid-123', 'and the moment id, so the entry joins its offer if she keeps it');
});

test('harvestSignal — an ALREADY-CONFIRMED artifact still commits, without asking twice', async () => {
  // Her Quality Days profile, refined Reclaim List, Lifestyle Pilot: built deliberately and signed off in-session.
  // Re-asking would teach her to tap past the question, blunting the offer exactly where it matters.
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'm' }] }; });
  const offer = await harvestSignal(db, 'm1', { kind: 'plan', keeperType: 'plan', destinationIntent: 'keeper', payloadRef: 'my quality day', label: 'Your Quality Days', confirmed: true }, 'reclaim');
  assert.ok(seen.some((s) => /insert into playbook_entry/.test(s)), 'a confirmed artifact lands directly');
  assert.equal(offer, null, 'and produces no offer to tap');
});

test('THE DEFAULT IS TO ASK — a harvest site that forgets the flag offers rather than commits', async () => {
  // The failure mode of forgetting `confirmed` must be a redundant question, never a silent claim about her.
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'm' }] }; });
  const offer = await harvestSignal(db, 'm1', { kind: 'whatever', destinationIntent: 'keeper', payloadRef: 'something she said in passing' }, 'rewire');
  assert.ok(!seen.some((s) => /insert into playbook_entry/.test(s)));
  assert.ok(offer, 'unflagged → offered');
});

test('harvestSignal — a share-only / private signal commits NO keeper', async () => {
  const seen: string[] = [];
  const db = fakeDb((sql) => { seen.push(sql); return { rows: [{ moment_id: 'm' }] }; });
  await harvestSignal(db, 'm1', { kind: 'letter', destinationIntent: 'share', payloadRef: 'a private letter' }, 'reconnect');
  assert.ok(!seen.some((s) => /insert into playbook_entry/.test(s)), 'share-only never lands a stored keeper');
});
