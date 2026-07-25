import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runnablePlay, rerunAsk, playSituation } from '../lib/playbook/runnable.ts';

// The False Start Protocol play is forged in Session w3 — the flagship "Run it again" case.
test('runnablePlay: resolves the False Start Protocol → w3 with a member-voiced ask', () => {
  const r = runnablePlay({ source: { kind: 'own', ref: 'protocol', label: 'Your False Start Protocol' } });
  assert.ok(r, 'should resolve');
  assert.equal(r!.sessionId, 'w3');
  assert.equal(r!.sessionLabel, 'False Start Protocol');
  assert.match(r!.ask, /go back through my False Start Protocol/);
});

test('runnablePlay: the W1 "true line" principle → w1 (Disinformation Audit)', () => {
  const r = runnablePlay({ source: { kind: 'own', ref: 'affirmation', label: 'Your true line' } });
  assert.ok(r);
  assert.equal(r!.sessionId, 'w1');
  assert.equal(r!.sessionLabel, 'Disinformation Audit');
});

test('runnablePlay: prefers a real captured Session ref over the label map', () => {
  const r = runnablePlay({ source: { kind: 'session', ref: 'w2', label: 'Your False Start Protocol' } });
  assert.ok(r);
  assert.equal(r!.sessionId, 'w2'); // the durable ref wins, so capture quietly retires the map
});

test('runnablePlay: null for a keeper with no known Session (graceful — no button)', () => {
  assert.equal(runnablePlay({ source: { kind: 'own', label: 'Some other keeper' } }), null);
  assert.equal(runnablePlay({ source: {} }), null);
  assert.equal(runnablePlay(null), null);
});

test('runnablePlay: the Lifestyle Pilot carries a real source.ref (b3) → resolves natively, no map needed', () => {
  const r = runnablePlay({ source: { kind: 'own', ref: 'b3', label: 'Your Lifestyle Pilot' } });
  assert.ok(r);
  assert.equal(r!.sessionId, 'b3');
  assert.equal(r!.sessionLabel, 'The Lifestyle Pilot');
});

test('rerunAsk: known id → ask; unknown id → null', () => {
  assert.match(rerunAsk('w3')!, /False Start Protocol/);
  assert.equal(rerunAsk('nope'), null);
});

test('playSituation: a play gets its "when"; a non-play gets null', () => {
  assert.equal(playSituation({ source: { label: 'Your False Start Protocol' } }), 'When a slip starts to spiral');
  assert.equal(playSituation({ source: { label: 'Your true line' } }), 'When the old story starts talking');
  assert.equal(playSituation({ source: { label: 'Describing the Cyclist' } }), null);
  assert.equal(playSituation(null), null);
});
