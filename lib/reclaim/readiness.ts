import type { Db } from '../db/schema.ts';

// Reclaim's first session (C1) reflects on the STRETCH the member has actually lived — so entry is gated: a member
// can't roll straight from Rebuild into Reclaim with nothing to look back on. THIS FUNCTION IS THE ONE PLACE THE RULE
// LIVES — the hero, ring, Program page, and workspace route all read it, so the policy is a one-line swap here.
//
// v1 rule (placeholder for the Greg + Jay "how the Loop opens" decision): Reclaim opens N days after the Rebuild
// checkpoint, tied to the 60-day IDQ cadence. Swap to an IDQ-movement signal or a member-declared readiness by
// rewriting the body — nothing downstream changes.
export const RECLAIM_UNLOCK_DAYS = 60;

export type ReclaimReadiness = { ready: boolean; reason: string; opensOn: string | null; daysLeft: number };

const READY: ReclaimReadiness = { ready: true, reason: '', opensOn: null, daysLeft: 0 };
const LOCK_REASON = 'Reclaim reflects on the stretch you’ve lived — it opens once you’ve had real time to look back on.';

export async function reclaimReadiness(db: Db, memberId: string): Promise<ReclaimReadiness> {
  try {
    const { rows } = await db.query<{ days: number; opens_on: string }>(
      `select extract(day from now() - set_at)::int as days,
              to_char(set_at + ($2 || ' days')::interval, 'FMMonth FMDD, YYYY') as opens_on
         from phase_gate where member_id = $1 and gate = 'rebuild_checkpoint_passed'`,
      [memberId, RECLAIM_UNLOCK_DAYS],
    );
    const r = rows[0];
    if (!r) return READY; // no Rebuild checkpoint yet → not at the Reclaim boundary; nothing to gate
    const daysLeft = Math.max(0, RECLAIM_UNLOCK_DAYS - r.days);
    return daysLeft <= 0 ? READY : { ready: false, reason: LOCK_REASON, opensOn: r.opens_on, daysLeft };
  } catch {
    return READY; // drift-hardened: a read hiccup never traps the member out of their program
  }
}
