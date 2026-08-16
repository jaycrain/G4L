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

// ── Greg's closing nuances ──────────────────────────────────────────────────
// Every Science Check ends with an unheaded "A useful nuance for the final version…" paragraph. It reads like an
// editorial note and is the easiest thing in the corpus to skim past — but in six assets it FORBIDS the most
// natural implementation of that asset (see docs/greg-library/PER-ASSET-NOTES.md). The 2026-08-16 claims pass
// found the summaries tier — the tier being promoted to the unskippable Frame — violating two of them while the
// deeper explore.ts tier got both right. These tests hold the corrective, so the nuance can't be edited back out.
//
// Asserting on the PRESENCE of the corrective, not the absence of forbidden words: absence tests pass for copy
// that simply says nothing, which is how both of these regressed in the first place.

test("C1 nuance — refinement can make a goal BIGGER, not only smaller", () => {
  // Greg, C1 Science Check: "not that revisiting goals always leads to smaller or easier goals… Other times it
  // makes a goal more ambitious because it now feels more authentic and more worth the effort."
  // Every affordance in a refinement UI (prune, deprioritize, remove) biases toward reduction. If the copy only
  // ever describes shrinking, we teach that growth means wanting less.
  assert.match(
    ASSET_SUMMARIES.c1.full,
    /\b(bigger|larger|more ambitious|more worth)\b/i,
    'C1 must acknowledge the upward direction of refinement, not only sharpening and pruning',
  );
});

test("C2 nuance — a bigger world is not defined as doing more or being more social", () => {
  // Greg, C2 Science Check: "not that a bigger world always means doing more, being more social, or feeling good
  // all the time. A bigger world can also mean becoming more willing, more open, more engaged… even when life is
  // still imperfect." Pairs with his Companion-memo ban on "your step count is up 20%, so your world is
  // objectively bigger" — expansion is a member-reported disposition, never a computed activity metric.
  const c2 = ASSET_SUMMARIES.c2.full;
  assert.match(c2, /\bwilling\b/i, 'C2 must carry the willingness/openness reading of expansion');
  // Tightened 2026-08-16: the first draft of this assertion (/not only|isn’t only/) also matched the OLD copy,
  // via an unrelated "not only progress" in the closing sentence — it would have passed the very regression it
  // was written to catch. Require the disclaimer to actually be about size-vs-busyness.
  assert.match(
    c2,
    /(bigger|wider|larger)[^.?!]*\b(doesn’t|does not|need not|needn’t)\b[^.?!]*\bmean\b[^.?!]*\b(busier|busy|more|doing)\b/i,
    'C2 must explicitly decline the "bigger = busier" reading, in those terms',
  );
});
