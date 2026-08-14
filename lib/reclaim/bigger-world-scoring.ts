// C2 · The Bigger World Audit — priority scoring (RC-1, Greg 7/9). Per domain: the formula uses the COMPUTED gap
// (Desired − Current), NOT the self-rated "how big does it feel" gap (that stays reflective). Then
//   PriorityScore = (computedGap × Importance) + Readiness + RippleEffect
// Domains are ranked by PriorityScore → Primary / Secondary; the Momentum Lever is the highest-Readiness domain (the
// easiest high-value place to start). Pure + deterministic; the arc/action just persist + reflect.

import { AUDIT_DOMAIN_LABEL, AUDIT_ITEMS, AUDIT_DOMAINS, type AuditDomain, type AuditFacet } from './bigger-world-instrument.ts';
import type { SessionVisual } from '../agent/session-visual.ts';

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

/**
 * THE STEP-2 PRIORITY BARS — the first Session visual (#163).
 *
 * ONE DEFINITION, TWO CALLERS: the C2 arc draws it live, and the completed-session revisit card rebuilds it from
 * that run's stored reading. Keeping the lead sentence in one place is the point — two copies of a framing line is
 * two chances for the picture and the words to disagree.
 *
 * One horizontal bar per life domain, drawn from the member's own twenty answers, shown after the ratings and
 * before they prioritise. Greg (2026-08-13): help the member see the pattern before prioritizing, and let the
 * Companion see when Readiness or Ripple is the better target even at a lower Priority.
 *
 * LENGTH IS THE PRIORITY SCORE, UNSCALED — and that matters more than it sounds. Status reaches 90 (Gap 9 ×
 * Importance 10) while Readiness and Ripple cap at 10, so a long bar really is mostly Status and Readiness can be
 * a four-percent sliver. Greg's mock draws the three segments as comparable, which only happens at tiny gaps.
 * We draw it true and print all three numbers instead, because the sliver is the POINT: the shortest bar is often
 * the one with the most Readiness, which is exactly the signal this exists to surface. Rescaling to make it look
 * tidy would flatter the picture and lie about the arithmetic.
 *
 * THE LEAD IS A READ, NEVER A RANKING. Four ordered bars of someone's life is one step from a scoreboard, so the
 * sentence names two facts and stops: where the distance is widest, and where they are most ready. It never says
 * "worst", never grades, and never tells the member which to choose — the next question asks them.
 */
export function priorityBarsVisual(scored: AuditScore): SessionVisual {
  // `status` is new as of 2026-08-14. Readings written before it exist and would render a zero-length first
  // segment — so derive it when absent rather than trusting the column. An older row is missing a field, not
  // reporting a zero, and drawing the difference wrong is how a silent read becomes a confident lie.
  const domains = scored.domains.map((d) => ({ ...d, status: d.status ?? d.computedGap * d.importance }));
  const widest = domains.reduce((a, b) => (b.priorityScore > a.priorityScore ? b : a));
  const readiest = domains.reduce((a, b) => (b.readiness > a.readiness ? b : a));
  const name = (d: AuditDomain) => AUDIT_DOMAIN_LABEL[d].toLowerCase();
  const lead =
    widest.domain === readiest.domain
      ? `Your ${name(widest.domain)} life is both where the distance runs widest and where you feel most ready.`
      : `Your ${name(widest.domain)} life is where the distance runs widest. Your ${name(readiest.domain)} life is where you feel most ready to move.`;
  return {
    kind: 'priority-bars',
    lead,
    // Longest first — the eye should land on the widest distance. Ties keep domain order (sort is stable).
    rows: [...domains]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((d) => ({
        label: AUDIT_DOMAIN_LABEL[d.domain],
        status: d.status,
        readiness: d.readiness,
        ripple: d.ripple,
        total: d.priorityScore,
      })),
  };
}
