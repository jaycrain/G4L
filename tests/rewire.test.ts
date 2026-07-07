import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireEnabled, rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import type { ConvState, ModelTurn } from '../lib/agent/onboarding.ts';

// Rewire (v2.3) SLICE 1 — W1 the Disinformation Audit. Scaffolding replay: the arc walks (audit → cross-examine →
// affirm → complete) and harvests the affirmation as a Playbook keeper. Copy is Greg's V4 placeholder — these
// assertions key on STRUCTURE (stages, harvest, completion), not the member voice (which drops in later).

test('rewire · flag defaults OFF (prod keeps v1 static Rewire until the v2.3 flip)', () => {
  const prev = process.env.REWIRE;
  delete process.env.REWIRE;
  assert.equal(rewireEnabled(), false);
  process.env.REWIRE = 'staged';
  assert.equal(rewireEnabled(), true);
  if (prev === undefined) delete process.env.REWIRE;
  else process.env.REWIRE = prev;
});

// drive the audit to the cross-examine, then confirm → affirm, then write the true line.
function walkToAffirm(): ConvState {
  let t = rewireOpening();
  assert.equal(t.state.stage, 'audit');
  // turn 1 — the lie (still gathering)
  t = applyRewireTurn(t.state, [], "I'm too old to start over", { text: 'I hear that.' });
  assert.equal(t.state.stage, 'audit');
  // turn 2 — deeper; model signals depth → the reflection cross-examines, awaiting confirm
  t = applyRewireTurn(t.state, [], 'at 6am it says you already failed, why bother', { text: 'That is the rawer version.', depthReady: true });
  assert.equal(t.state.awaitingConfirm, true);
  assert.match(t.reply, /on trial|evidence/i, 'the reflection puts the lie on trial (cross-examine)');
  // turn 3 — respond, done → hand into writing the true line
  t = applyRewireTurn(t.state, [], 'the evidence against it is stronger', { text: 'So why treat it as a verdict?', replyIntent: 'done' } as ModelTurn);
  assert.equal(t.state.stage, 'affirm', 'advances to the affirmation beat');
  return t.state;
}

test('W1 · walks audit → cross-examine → affirm, and HARVESTS the true line as a keeper', () => {
  const atAffirm = walkToAffirm();
  const t = applyRewireTurn(atAffirm, [], "I'm out of shape, and I'm starting anyway", { text: 'Good.' });
  assert.equal(t.complete, true, 'W1 completes after the true line (slice-1 terminal)');
  const harvest = t.state.pendingHarvest ?? [];
  assert.equal(harvest.length, 1, 'exactly one keeper queued');
  assert.equal(harvest[0]!.keeperType, 'principle', 'an affirmation is a principle keeper');
  assert.equal(harvest[0]!.destinationIntent, 'keeper');
  assert.match(harvest[0]!.payloadRef, /starting anyway/, 'the keeper carries the member\'s verbatim true line');
});

test('W1 · a too-thin true line is drawn out, not captured; a dispute reopens the audit', () => {
  // thin line → probe, no capture yet
  const atAffirm = walkToAffirm();
  const thin = applyRewireTurn(atAffirm, [], 'idk', { text: '' });
  assert.equal(thin.complete ?? false, false, 'a two-char non-line does not complete');
  assert.equal((thin.state.pendingHarvest ?? []).length, 0, 'nothing harvested from a non-line');
  assert.match(thin.reply, /make it sound like you/i, 'draws the real line out');

  // dispute at the cross-examine reopens the audit (never defend the pattern)
  let t = rewireOpening();
  t = applyRewireTurn(t.state, [], 'I never have time', { text: 'Mm.', depthReady: true });
  t = applyRewireTurn(t.state, [], "no, that's not really it", { text: 'Okay.', replyIntent: 'dispute' } as ModelTurn);
  assert.equal(t.state.stage, 'audit', 'a dispute stays in the audit');
  assert.equal(t.state.awaitingConfirm ?? false, false, 'and reopens for the real lie');
});
