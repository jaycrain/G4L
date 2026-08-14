// C2 · The Bigger World Audit — priority scoring (RC-1, Greg 7/9). Per domain: the formula uses the COMPUTED gap
// (Desired − Current), NOT the self-rated "how big does it feel" gap (that stays reflective). Then
//   PriorityScore = (computedGap × Importance) + Readiness + RippleEffect
// Domains are ranked by PriorityScore → Primary / Secondary; the Momentum Lever is the highest-Readiness domain (the
// easiest high-value place to start). Pure + deterministic; the arc/action just persist + reflect.

import { AUDIT_ITEMS, AUDIT_DOMAINS, type AuditDomain, type AuditFacet } from './bigger-world-instrument.ts';

export type DomainScore = {
  domain: AuditDomain;
  current: number;
  desired: number;
  importance: number;
  readiness: number;
  ripple: number;
  computedGap: number; // Gap = Desired − Current (the formula gap, RC-1)
  // STATUS = Gap × Importance. Greg named this intermediary on 2026-08-13: "you have the formula correct but
  // let's use these variable names." It was inlined inside priorityScore, which meant the product had no name —
  // so neither the Companion nor a member-facing explanation could refer to it, and the stacked bar below has no
  // first segment to label. Naming it changes no arithmetic; it makes the middle step speakable.
  status: number;
  priorityScore: number; // Status + Readiness + Ripple
};
export type AuditScore = {
  domains: DomainScore[]; // in domain order (Physical/Self/Social/Outlook)
  primary: AuditDomain; // highest PriorityScore (ties → domain order)
  secondary: AuditDomain; // second highest
  momentumLever: AuditDomain; // highest Readiness — the easiest high-value place to start
};

export function scoreAudit(responses: number[]): AuditScore {
  if (responses.length !== AUDIT_ITEMS.length) {
    throw new Error(`scoreAudit expects ${AUDIT_ITEMS.length} responses, got ${responses.length}`);
  }
  const val = (domain: AuditDomain, facet: AuditFacet): number =>
    responses[AUDIT_ITEMS.findIndex((it) => it.domain === domain && it.facet === facet)]!;

  const domains: DomainScore[] = AUDIT_DOMAINS.map((domain) => {
    const current = val(domain, 'current');
    const desired = val(domain, 'desired');
    const importance = val(domain, 'importance');
    const readiness = val(domain, 'readiness');
    const ripple = val(domain, 'ripple');
    const computedGap = desired - current; // Gap — RC-1: computed, not the felt gap
    const status = computedGap * importance; // Status = Gap × Importance
    const priorityScore = status + readiness + ripple; // Priority Score = Status + Readiness + Ripple
    return { domain, current, desired, importance, readiness, ripple, computedGap, status, priorityScore };
  });

  // Rank by PriorityScore (desc); ties resolve to domain order (Array.sort is stable, `domains` is in domain order).
  const byPriority = [...domains].sort((a, b) => b.priorityScore - a.priorityScore);
  const byReadiness = [...domains].sort((a, b) => b.readiness - a.readiness);
  return {
    domains,
    primary: byPriority[0]!.domain,
    secondary: byPriority[1]!.domain,
    momentumLever: byReadiness[0]!.domain,
  };
}

// The per-item response map (code → value) stored alongside the computed priorities, so a re-score from raw is always
// possible (same posture as the other reading registers).
export function auditResponsesMap(responses: number[]): Record<string, number> {
  const map: Record<string, number> = {};
  AUDIT_ITEMS.forEach((it, i) => {
    if (responses[i] != null) map[it.code] = responses[i]!;
  });
  return map;
}
