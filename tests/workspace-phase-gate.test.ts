import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../lib/workspace/session-registry.ts';
import { phaseEngineEnabled } from '../lib/workspace/phase-enabled.ts';

// CAT-40 — a surface gated by two independent flags at two layers will eventually see them disagree. The failure
// shape was the worst kind: the workspace rendered fully, emitted session_open, then refused every turn with
// "Reclaim is not enabled" — a live-looking session that would not move, and an open with no close in QI.

test('every phase in the registry has an engine resolver — a new phase cannot silently default to "enabled"', () => {
  for (const phase of PHASES) {
    assert.equal(typeof phaseEngineEnabled(phase), 'boolean', `no engine resolver wired for phase: ${phase}`);
  }
});

test('the resolver tracks the flag, both ways', () => {
  const prev = process.env.RECLAIM;
  try {
    process.env.RECLAIM = '';
    assert.equal(phaseEngineEnabled('reclaim'), false, 'engine dark → the route must not open');
    process.env.RECLAIM = 'staged';
    assert.equal(phaseEngineEnabled('reclaim'), true, 'engine live → the route opens');
  } finally {
    if (prev === undefined) delete process.env.RECLAIM;
    else process.env.RECLAIM = prev;
  }
});
