// EVERY PHASE CHECKPOINT AWARDS ITS BADGE.
//
// Greg crossed the Rewire checkpoint on 2026-08-02 and never got the Rewire badge. Cause: each phase's
// conversational arc sets its own gate and bypasses the old checkpoint action, which is where the registry's
// `earns:` was honoured. Reconnect had a hand-written fix; Rewire, Rebuild and Reclaim never got one — so
// three phase badges had never awarded for anybody.
//
// This test exists because the failure was SILENT: nothing errored, the gate was set, the dashboard rendered,
// and the only symptom was a badge that said "not yet" and "you completed this" at the same time. The map is
// the contract — a phase that ships a gate without a badge fails here rather than in someone's passport.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_GATE_BADGE } from '../lib/curriculum/view.ts';
import { BADGES } from '../lib/curriculum/registry.ts';

const KNOWN_GATES = [
  'reconnect_checkpoint_passed',
  'rewire_checkpoint_passed',
  'rebuild_checkpoint_passed',
  'reclaim_checkpoint_passed',
];

test('every phase checkpoint gate maps to a badge', () => {
  for (const gate of KNOWN_GATES) {
    assert.ok(PHASE_GATE_BADGE[gate], `${gate} has no milestone badge — a member can cross it and get nothing`);
  }
});

test('every mapped badge actually exists in the registry', () => {
  // A typo here would be the same silent failure in a new costume: the gate fires, earnBadge is called with
  // an id nothing knows, and the member's passport stays empty.
  const ids = new Set(BADGES.map((b) => b.id));
  for (const [gate, badgeId] of Object.entries(PHASE_GATE_BADGE)) {
    assert.ok(ids.has(badgeId), `${gate} → "${badgeId}" is not a real badge id`);
  }
});

test('the four phases map to four DISTINCT badges', () => {
  const ids = Object.values(PHASE_GATE_BADGE);
  assert.equal(new Set(ids).size, ids.length, 'two phases share a badge — one of them will never be earnable');
});
