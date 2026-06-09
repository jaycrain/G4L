// Reconnect required outputs — data contract (docs/CONTRACTS.md §6).
// Every Reconnect variant must produce: the Reclaim List, the member's Door(s) (one or more
// of the 8), and the baseline ID Score. This module validates the first two.
//
// Reclaim List sizing (Decision Log, voice rewrite v1): a MINIMUM of 3 to proceed, no maximum.
// The agent gently keeps drawing more out toward a soft target of ~7, but never forces a count.
// (Superseded the earlier "exactly 7" rule.)

import { isDoorSlug, type DoorSlug } from '../doors.ts';

export const RECLAIM_LIST_MIN = 3; // hard floor to proceed
export const RECLAIM_LIST_TARGET = 7; // soft aim — guides the agent, not enforced

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** A Reclaim List is valid with at least RECLAIM_LIST_MIN non-empty, member-stated items (no max). */
export function validateReclaimList(items: unknown): ValidationResult {
  if (!Array.isArray(items)) return { ok: false, errors: ['reclaim list must be an array'] };
  const errors: string[] = [];
  if (items.length < RECLAIM_LIST_MIN) {
    errors.push(`reclaim list must have at least ${RECLAIM_LIST_MIN} items (got ${items.length})`);
  }
  items.forEach((it, i) => {
    if (typeof it !== 'string' || it.trim().length === 0) {
      errors.push(`reclaim item ${i}: must be a non-empty string`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Validate the member's chosen Door(s) — one or more of the canonical eight. */
export function validateDoors(slugs: unknown): ValidationResult {
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return { ok: false, errors: ['at least one Door is required'] };
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
  doors: DoorSlug[]; // one or more
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
