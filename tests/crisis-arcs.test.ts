import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC2Opening, applyReclaimC2Turn, applyReclaimC3Turn, applyReclaimCheckpointTurn } from '../lib/agent/reclaim.ts';
import { applyRewireCheckpointTurn } from '../lib/agent/rewire.ts';
import { applyRebuildB1Turn } from '../lib/agent/rebuild.ts';
import { CRISIS_RESPONSE_US, detectCrisis } from '../lib/agent/governance.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// GOVERNANCE (hard rule) — crisis routing is ALWAYS ON across every phase arc (Reconnect/Rewire/Rebuild/Reclaim) and
// every mode (administered / draw-out / coach), via the shared runArcTurn guard. A distress signal short-circuits to
// the 988 protocol and NEVER advances the arc. This is the regression net for the fix that closed the gap where the
// phase arcs relied only on the model's system-prompt instruction, not the deterministic backstop.

const CRISIS = 'I want to kill myself'; // matches the crisis patterns
const st = (stage: string): ConvState => ({ stage, collected: {} } as ConvState);

test('detectCrisis fires on the sample phrase (sanity)', () => {
  assert.equal(detectCrisis(CRISIS).flagged, true);
});

test('crisis · administered arc (Reclaim C2) → 988, does not record or advance', () => {
  const t = applyReclaimC2Turn(reclaimC2Opening().state, [], CRISIS);
  assert.equal(t.crisis, true);
  assert.equal(t.reply, CRISIS_RESPONSE_US);
  assert.equal(t.state.stage, 'audit', 'the arc did not advance past the crisis');
  assert.equal((t.state.administeredResponses ?? []).length, 0, 'the crisis message was never recorded as a rating');
});

test('crisis · coach arc (Reclaim C3) → 988', () => {
  const t = applyReclaimC3Turn(st('quality'), [], CRISIS, { text: '' });
  assert.equal(t.crisis, true);
  assert.equal(t.reply, CRISIS_RESPONSE_US);
});

test('crisis · the checkpoints (Rewire + Reclaim) + Rebuild B1 all route to 988 (shared kernel)', () => {
  for (const t of [
    applyRewireCheckpointTurn(st('checkpoint'), [], CRISIS, { text: '' }),
    applyReclaimCheckpointTurn(st('checkpoint'), [], CRISIS, { text: '' }),
    applyRebuildB1Turn(st('why'), [], CRISIS),
  ]) {
    assert.equal(t.crisis, true);
    assert.equal(t.reply, CRISIS_RESPONSE_US);
  }
});

test('crisis · a normal answer still flows (no false positive)', () => {
  const t = applyReclaimC2Turn(reclaimC2Opening().state, [], '7');
  assert.notEqual(t.crisis, true);
  assert.equal((t.state.administeredResponses ?? []).length, 1, 'a normal rating records + advances as usual');
});
