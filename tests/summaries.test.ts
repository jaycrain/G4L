import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASSET_SUMMARIES, PHASE_SUMMARIES, sessionSummary, phaseSummary } from '../lib/content/summaries.ts';
import { SESSION_KEYS } from '../lib/workspace/session-key.ts';

// The summaries are the single source of truth for the "why this matters" copy. These lock the contract the canvas +
// Program page read against: all 12 assets + 4 phases present, short lines terse, causality discipline intact, and the
// session→summary resolver maps every real session (and returns null for checkpoints, never throwing).

test('all 12 asset summaries + 4 phase summaries are present and non-empty', () => {
  const assets = Object.keys(ASSET_SUMMARIES);
  assert.equal(assets.length, 12);
  for (const [id, s] of Object.entries(ASSET_SUMMARIES)) {
    assert.ok(s.short.length > 0 && s.full.length > 0, `${id} has copy`);
    assert.ok(s.short.length < 130, `${id} short is a threshold line, not a paragraph`);
    assert.ok(s.full.length > s.short.length, `${id} full is richer than short`);
  }
  assert.deepEqual(Object.keys(PHASE_SUMMARIES).sort(), ['rebuild', 'reclaim', 'reconnect', 'rewire']);
});

test('causality discipline held — every full uses probabilistic "research suggests", never a guarantee', () => {
  const alls = [...Object.values(ASSET_SUMMARIES), ...Object.values(PHASE_SUMMARIES)].map((s) => s.full);
  const asserted = alls.filter((f) => /\b(guarantee|will make you|proven to|cures?)\b/i.test(f));
  assert.deepEqual(asserted, [], 'no deterministic/guarantee language');
});

test('sessionSummary resolves every session key — 1:1 → asset, reconnect → phase, checkpoints → null', () => {
  for (const k of SESSION_KEYS) {
    const r = sessionSummary(k); // must never throw for any real key
    if (k.endsWith('checkpoint') || k === 'b4' || k === 'c4') assert.equal(r, null, `${k} is a gate, no summary`);
    else assert.ok(r && r.short && r.full, `${k} resolves a summary`);
  }
  // reconnect uses the phase-level summary (it spans R1–R3)
  assert.equal(sessionSummary('reconnect')?.short, PHASE_SUMMARIES.reconnect.short);
  // a 1:1 session uses its asset
  assert.equal(sessionSummary('b1')?.short, ASSET_SUMMARIES.b1.short);
});

test('phaseSummary returns the phase copy', () => {
  assert.equal(phaseSummary('rewire').short, PHASE_SUMMARIES.rewire.short);
});
