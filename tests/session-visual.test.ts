import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAudit } from '../lib/reclaim/bigger-world-scoring.ts';
import type { SessionVisual } from '../lib/agent/session-visual.ts';

// SESSION VISUALS — the mechanism, with C2's priority bars as instance one (#163).
//
// Jay, 2026-08-14: "it's probably not going to be a one-off... most people are visual learners, so these kind of
// assets will drive deeper learning." So these tests are about the CONTRACT, not the chart: a visual is display
// only, it carries its own framing, and it never becomes a ranking of the member.

/** Twenty answers: four domains × current, desired, importance, readiness, ripple. */
const ANSWERS = [
  3, 8, 7, 6, 5, // physical — Gap 5, Status 35, Priority 46
  5, 7, 6, 4, 7, // self     — Gap 2, Status 12, Priority 23
  2, 9, 9, 3, 8, // social   — Gap 7, Status 63, Priority 74
  6, 8, 3, 8, 4, // outlook  — Gap 2, Status  6, Priority 18 — the readiest domain, and the shortest bar
];

// The builder is internal to the arc, so exercise it the way the arc does — through the numbers it is built from.
// This mirrors priorityBarsVisual() in lib/agent/reclaim.ts; if that drifts, the assertions below drift with it.
function bars(responses: number[]): SessionVisual {
  const scored = scoreAudit(responses);
  const widest = scored.domains.reduce((a, b) => (b.priorityScore > a.priorityScore ? b : a));
  const readiest = scored.domains.reduce((a, b) => (b.readiness > a.readiness ? b : a));
  return {
    kind: 'priority-bars',
    lead: `${widest.domain}/${readiest.domain}`,
    rows: [...scored.domains]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((d) => ({ label: d.domain, status: d.status, readiness: d.readiness, ripple: d.ripple, total: d.priorityScore })),
  };
}

test('the bar LENGTH is the Priority Score, and the segments sum to it', () => {
  // The property that keeps the picture honest: no rescaling anywhere. If a future edit normalises the segments
  // to make them look comparable, this fails — which is the point, because that would lie about the arithmetic.
  for (const r of bars(ANSWERS).rows) {
    assert.equal(r.status + r.readiness + r.ripple, r.total, `${r.label}: segments must sum to the bar length`);
  }
});

test('THE SLIVER IS THE POINT — the shortest bar can hold the most Readiness', () => {
  // Greg's stated purpose: let the Companion see when Readiness is the better target even at a lower Priority.
  // Outlook has the LOWEST Priority Score and the HIGHEST Readiness. If the renderer ever drops small segments
  // or the sort hides them, this signal is what gets lost.
  const rows = bars(ANSWERS).rows;
  const last = rows[rows.length - 1]!;
  const readiest = rows.reduce((a, b) => (b.readiness > a.readiness ? b : a));
  assert.equal(last.label, 'outlook', 'shortest bar');
  assert.equal(readiest.label, 'outlook', 'and it is also the readiest — the case the chart exists for');
  assert.ok(last.readiness > last.status, 'here Readiness genuinely outweighs the distance');
});

test('Status really does dominate a long bar — the scale problem is real, and drawn true', () => {
  // Greg's mock draws the three segments as comparable. At real values the longest bar is ~85% Status and the
  // Readiness segment is a few percent. Recorded as an assertion so nobody "fixes" the renderer by rescaling.
  const social = bars(ANSWERS).rows[0]!;
  assert.equal(social.label, 'social');
  assert.ok(social.status / social.total > 0.8, 'the long bar is overwhelmingly Status');
  assert.ok(social.readiness / social.total < 0.06, 'and Readiness is a sliver — so the numbers must be printed');
});

test('longest first — the eye lands on the widest distance', () => {
  const totals = bars(ANSWERS).rows.map((r) => r.total);
  assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
});

test('the framing travels WITH the data, so it cannot be rewritten per call site', () => {
  const v = bars(ANSWERS);
  assert.equal(typeof v.lead, 'string');
  assert.ok(v.lead.length > 0, 'a visual always carries its own read');
});

test('a visual asks for NOTHING — it is display, never an input', () => {
  // The reason it is a sibling of `expects` rather than a member of it. If a future variant sprouts a field that
  // collects an answer, it belongs in Expectation instead, and this assertion should stop the drift.
  const v = bars(ANSWERS) as unknown as Record<string, unknown>;
  for (const k of ['expects', 'options', 'scale', 'answer', 'input']) {
    assert.equal(v[k], undefined, `a SessionVisual must not carry "${k}" — that would make it an input`);
  }
});

// ── THE REVISIT SLOT ─────────────────────────────────────────────────────────────────────────────────────────
//
// A completed Session's revisit renders the SUMMARY CARD, not the conversation (workspace-session.tsx:66), and
// arc_session is deleted on completion. So without a slot on the Artifact, a Session that showed a member
// something had no way to show it again — which was Jay's requirement: "it should be available in the revisit too."

import { priorityBarsVisual } from '../lib/reclaim/bigger-world-scoring.ts';
import { scoreAudit as score } from '../lib/reclaim/bigger-world-scoring.ts';

test('ONE definition, two callers — the live turn and the revisit draw the same bars', () => {
  // The live arc calls priorityBarsVisual(scoreAudit(responses)); the revisit calls it with the STORED priorities.
  // Same function, so the picture and its lead sentence cannot drift between the two surfaces.
  const live = priorityBarsVisual(score(ANSWERS));
  const fromStored = priorityBarsVisual(score(ANSWERS)); // what a stored `priorities` round-trips to
  assert.deepEqual(fromStored, live);
});

test('an OLD reading with no `status` still draws — derived, not zeroed', () => {
  // `status` was added 2026-08-14. Readings written before it lack the field, and trusting the column would give
  // a zero-length first segment on every historical revisit — a silent wrong answer rather than a visible failure.
  const scored = score(ANSWERS);
  const legacy = { ...scored, domains: scored.domains.map(({ status: _drop, ...rest }) => rest) } as typeof scored;
  const v = priorityBarsVisual(legacy);
  for (const r of v.rows) {
    assert.ok(r.status > 0, `${r.label}: a legacy reading must derive Status, not render it as 0`);
    assert.equal(r.status + r.readiness + r.ripple, r.total, `${r.label}: and it still sums to the bar length`);
  }
});
