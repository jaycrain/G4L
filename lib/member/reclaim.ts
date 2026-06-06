// Reconnect required outputs — frozen data contract (docs/CONTRACTS.md §6).
// Every Reconnect variant must produce: the Reclaim List (exactly 7 items), the member's
// Door (one of the 8), and the baseline ID Score. This module validates the first two.

import { isDoorSlug, type DoorSlug } from '../doors.ts';

export const RECLAIM_LIST_SIZE = 7;

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** A Reclaim List is valid only when it has exactly 7 non-empty, member-stated items. */
export function validateReclaimList(items: unknown): ValidationResult {
  if (!Array.isArray(items)) return { ok: false, errors: ['reclaim list must be an array'] };
  const errors: string[] = [];
  if (items.length !== RECLAIM_LIST_SIZE) {
    errors.push(`reclaim list must have exactly ${RECLAIM_LIST_SIZE} items (got ${items.length})`);
  }
  items.forEach((it, i) => {
    if (typeof it !== 'string' || it.trim().length === 0) {
      errors.push(`reclaim item ${i}: must be a non-empty string`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Validate the member's chosen Door against the canonical eight. */
export function validateDoor(slug: unknown): ValidationResult {
  return isDoorSlug(slug)
    ? { ok: true }
    : { ok: false, errors: [`unknown door: ${JSON.stringify(slug)}`] };
}

/** The complete frozen Reconnect output, ready to persist to member_profile + idq_retake. */
export type ReconnectOutput = {
  reclaimList: string[]; // 7
  door: DoorSlug;
  baselineIdScore: number; // 0..100
};

export function validateReconnectOutput(o: {
  reclaimList: unknown;
  door: unknown;
  baselineIdScore: unknown;
}): ValidationResult {
  const errors: string[] = [];
  const rl = validateReclaimList(o.reclaimList);
  if (!rl.ok) errors.push(...rl.errors);
  const d = validateDoor(o.door);
  if (!d.ok) errors.push(...d.errors);
  if (typeof o.baselineIdScore !== 'number' || o.baselineIdScore < 0 || o.baselineIdScore > 100) {
    errors.push('baselineIdScore must be a number 0–100');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
