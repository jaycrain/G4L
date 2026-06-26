// Reconnect required outputs — data contract (docs/CONTRACTS.md §6).
// Every Reconnect variant must produce: the Reclaim List and the baseline ID Score, plus the member's
// fade story in their own words. The Door(s) are an OPTIONAL routing tag (Doors Taxonomy Spec v1.0 §1 —
// recognition is decoupled from routing; a null Door is valid for a real Fade). This module validates
// the Reclaim List and any Doors present.
//
// Reclaim List sizing (Decision Log, voice rewrite v1): a soft AIM of 3 (toward ~7), no maximum.
// The agent gently keeps drawing more out toward the target, but never forces a count.
// (Superseded the earlier "exactly 7" rule.)
//
// Gate-1 decision (Jay, Jun 26 2026): the ≥3 is no longer a HARD finalize floor — a member who names fewer
// and signals done completes anyway, and the confirmation card carries the shortfall (post-onboarding / MA
// editing reaches the aim). The hard floor for finalize is RECLAIM_LIST_FLOOR (≥1 real item); RECLAIM_LIST_MIN
// stays the AIM that drives the agent's single never-trap nudge. See docs/onboarding-staged-capture-shape.md
// §"Gate 1" + the Decision Log.

import { isDoorSlug, type DoorSlug } from '../doors.ts';

export const RECLAIM_LIST_MIN = 3; // soft aim — drives the agent's nudge; NOT a hard finalize floor (see above)
export const RECLAIM_LIST_FLOOR = 1; // hard floor to finalize — at least one real, member-stated want
export const RECLAIM_LIST_TARGET = 7; // soft aim — guides the agent, not enforced

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** A Reclaim List is valid with at least RECLAIM_LIST_FLOOR non-empty, member-stated items (no max). */
export function validateReclaimList(items: unknown): ValidationResult {
  if (!Array.isArray(items)) return { ok: false, errors: ['reclaim list must be an array'] };
  const errors: string[] = [];
  if (items.length < RECLAIM_LIST_FLOOR) {
    errors.push(`reclaim list must have at least ${RECLAIM_LIST_FLOOR} item (got ${items.length})`);
  }
  items.forEach((it, i) => {
    if (typeof it !== 'string' || it.trim().length === 0) {
      errors.push(`reclaim item ${i}: must be a non-empty string`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Validate the member's Door(s). Routing is OPTIONAL (Doors Taxonomy Spec v1.0 §1): a real-Fade member
 * whose story maps to no canonical Door is still served — recognition lives in their own words (the gap
 * narrative), not in the routing tag. So an EMPTY set is valid (null routing). Any slugs present must be
 * canonical.
 */
export function validateDoors(slugs: unknown): ValidationResult {
  if (!Array.isArray(slugs)) {
    return { ok: false, errors: ['doors must be an array'] };
  }
  const errors: string[] = [];
  slugs.forEach((s) => {
    if (!isDoorSlug(s)) errors.push(`unknown door: ${JSON.stringify(s)}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** The complete Reconnect output, ready to persist to member_profile + member_door + idq_retake. */
export type ReconnectOutput = {
  reclaimList: string[]; // >= 3
  doors: DoorSlug[]; // zero or more — empty = null routing (valid for a real Fade), see §1
  baselineIdScore: number; // 0..100
};

export function validateReconnectOutput(o: {
  reclaimList: unknown;
  doors: unknown;
  baselineIdScore: unknown;
}): ValidationResult {
  const errors: string[] = [];
  const rl = validateReclaimList(o.reclaimList);
  if (!rl.ok) errors.push(...rl.errors);
  const d = validateDoors(o.doors);
  if (!d.ok) errors.push(...d.errors);
  if (typeof o.baselineIdScore !== 'number' || o.baselineIdScore < 0 || o.baselineIdScore > 100) {
    errors.push('baselineIdScore must be a number 0–100');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
