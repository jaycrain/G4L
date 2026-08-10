import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC2Opening, applyReclaimC2Turn } from '../lib/agent/reclaim.ts';
import { scoreAudit, auditResponsesMap } from '../lib/reclaim/bigger-world-scoring.ts';
import { AUDIT_ITEMS, AUDIT_ITEM_COUNT, AUDIT_DOMAINS, AUDIT_DOMAIN_STARTS, AUDIT_DOMAIN_LABEL, type AuditDomain, type AuditFacet } from '../lib/reclaim/bigger-world-instrument.ts';
import { parseLikert } from '../lib/agent/onboarding-staged.ts';

// C2 · The Bigger World Audit — the administered four-domain priority audit (20 ratings, 1–10), the RC-1 scoring
// (computed gap × importance + readiness + ripple), and the classification (Primary / Momentum Lever).

// Build a 20-response array from a per-domain {facet: value} spec (in AUDIT_ITEMS order).
function build(spec: Record<AuditDomain, Partial<Record<AuditFacet, number>>>): number[] {
  return AUDIT_ITEMS.map((it) => spec[it.domain]?.[it.facet] ?? 5);
}

test('RC-3 · parseLikert now reads "10" on a 1–10 scale (and clamps out-of-range)', () => {
  assert.equal(parseLikert('10', 10), 10, '"10" reads as ten');
  assert.equal(parseLikert('ten', 10), 10, 'the word too');
  assert.equal(parseLikert('8 out of 10', 10), 8, 'leftmost in-range number');
  assert.equal(parseLikert('10'), null, 'default (5) still rejects 10');
  assert.equal(parseLikert('12', 10), null, '12 is out of a 1–10 scale');
  assert.equal(parseLikert('4'), 4, 'the IDQ/Grinta callers (default 5) unchanged');
});

test('C2 arc · warm frame → 20 items in four domains (headers) → RC-1 summary close', () => {
  // v3.3: the 20 ratings are unchanged in content and order, but they now run in four stages with Greg's
  // reflection questions between them (V4 interleaves on purpose). So the walk answers the ratings AND the three
  // reflections per domain, then the five cross-domain sort questions. The header assertions still pin that
  // each domain announces itself at the right item.
  let t = reclaimC2Opening();
  assert.equal(t.state.stage, 'audit-physical');
  assert.match(t.reply, /world to get BIGGER/i, 'the frame');
  assert.match(t.reply, /Physical —/i, 'the first domain header');
  assert.ok(t.reply.includes(AUDIT_ITEMS[0]!.prompt), 'item 0 verbatim');

  let answered = 0;
  for (let d = 0; d < 4; d++) {
    for (let i = 0; i < 5; i++) {
      const absolute = d * 5 + i;
      if (absolute === 5) assert.match(t.reply, new RegExp(`${AUDIT_DOMAIN_LABEL[AUDIT_DOMAIN_STARTS[5]!]} —`, 'i'), 'Self header at 5');
      if (absolute === 15) assert.match(t.reply, new RegExp(`${AUDIT_DOMAIN_LABEL[AUDIT_DOMAIN_STARTS[15]!]} —`, 'i'), 'Outlook header at 15');
      t = applyReclaimC2Turn(t.state, [], '7');
      answered++;
    }
    assert.equal(t.complete, false, `after domain ${d + 1}'s ratings the audit is not over`);
    // Q3/Q7/Q8 are REQUIRED (Jay, 2026-08-09) — "next" re-asks rather than advancing, so the walk answers them.
    for (const a of ['a gap', 'an obstacle', 'a first move']) t = applyReclaimC2Turn(t.state, [], a);
  }
  assert.equal(answered, AUDIT_ITEM_COUNT, 'all 20 items were administered');
  assert.equal(t.complete, false, 'the cross-domain sort still has to happen');
  for (let q = 0; q < 5; q++) t = applyReclaimC2Turn(t.state, [], 'physical');

  assert.equal(t.complete, true, 'after the sort, C2 completes');
  assert.equal((t.state.administeredResponses ?? []).length, 20, 'all 20 ratings captured');
  assert.match(t.reply, /best next focus/i, 'the RC-1 priority summary');
});

test('C2 arc · a number over 10 is re-prompted (scale fidelity), not recorded', () => {
  const t = reclaimC2Opening();
  const bad = applyReclaimC2Turn(t.state, [], '15');
  assert.equal((bad.state.administeredResponses ?? []).length, 0, '15 is off a 1–10 scale');
  assert.match(bad.reply, /1 to 10/i, 're-prompts');
});

test('scoreAudit · RC-1 formula — computed gap × importance + readiness + ripple; primary + momentum lever', () => {
  // Physical: big gap, high importance → high priority. Social: small gap but very high readiness → momentum lever.
  const responses = build({
    physical: { current: 2, desired: 9, importance: 9, readiness: 4, ripple: 6 }, // gap 7 → 7*9+4+6 = 73
    self: { current: 5, desired: 6, importance: 5, readiness: 5, ripple: 5 }, //       gap 1 → 1*5+5+5 = 15
    social: { current: 6, desired: 7, importance: 4, readiness: 10, ripple: 5 }, //    gap 1 → 1*4+10+5 = 19
    outlook: { current: 5, desired: 6, importance: 3, readiness: 6, ripple: 4 }, //    gap 1 → 1*3+6+4 = 13
  });
  const s = scoreAudit(responses);
  const physical = s.domains.find((d) => d.domain === 'physical')!;
  assert.equal(physical.computedGap, 7, 'gap = desired − current');
  assert.equal(physical.priorityScore, 73, '(7×9)+4+6');
  assert.equal(s.primary, 'physical', 'highest priority score');
  assert.equal(s.secondary, 'social', 'second highest priority score');
  assert.equal(s.momentumLever, 'social', 'highest readiness = the momentum lever');
});

test('scoreAudit · ties resolve to domain order; guards a wrong response count', () => {
  const flat = scoreAudit(AUDIT_ITEMS.map(() => 5)); // all equal → all priority scores equal
  assert.equal(flat.primary, AUDIT_DOMAINS[0], 'a tie breaks to the first domain (Physical)');
  assert.throws(() => scoreAudit([1, 2, 3]), /expects 20/);
  assert.equal(Object.keys(auditResponsesMap(AUDIT_ITEMS.map(() => 5))).length, 20, 'response map keys by code');
});
