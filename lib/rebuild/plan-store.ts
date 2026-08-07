// The coaching-plan artifact store (coaching_plan / 0052) — the member-owned plan behind the Companion COACHING mode
// (Decision PP / RB-4). GENERIC over phase + payload so Reclaim + Cycle 2 reuse it; the per-Phase payload SHAPE lives
// here in the types, not the schema. Rebuild B3's payload is the two small changes.

import type { Db } from '../db/schema.ts';

export type CoachingPhase = 'rebuild' | 'reclaim' | 'cycle2';
// activityDays / dietDays are the MEMBER's number ("5 days a week"), captured by the B3 coach — Greg's sample grid
// carries a target per row, and without one a practice week has nothing to close against. OPTIONAL on purpose: a
// plan with no target is still a plan, and a member who won't pick a number must never be blocked from committing.
export type RebuildPilotPayload = { activityChange: string; dietChange: string; activityDays?: number; dietDays?: number };
export type CoachingPlan<P = Record<string, unknown>> = {
  id: string;
  phase: CoachingPhase;
  payload: P;
  status: string;
  weekStart: string;
};

// Persist a new active coaching plan (most-recent-active-wins — a re-run supersedes rather than mutating). Generic;
// the caller supplies the phase + the payload shape. Best-effort at the caller (a write hiccup never breaks the close).
export async function persistCoachingPlan<P>(db: Db, memberId: string, phase: CoachingPhase, payload: P): Promise<void> {
  await db.query(
    `insert into coaching_plan (member_id, phase, payload, status) values ($1, $2, $3::jsonb, 'active')`,
    [memberId, phase, JSON.stringify(payload)],
  );
}

// The member's active plan for a phase (most recent). Null on none / error (drift-hardened, same posture as the other
// agent-context reads). The generic P lets the caller type the payload (Rebuild → RebuildPilotPayload).
export async function activeCoachingPlan<P = Record<string, unknown>>(
  db: Db,
  memberId: string,
  phase: CoachingPhase,
): Promise<CoachingPlan<P> | null> {
  try {
    const { rows } = await db.query<{ id: string; phase: CoachingPhase; payload: P; status: string; week_start: string }>(
      `select id, phase, payload, status, week_start from coaching_plan
        where member_id=$1 and phase=$2 and status='active' order by created_at desc limit 1`,
      [memberId, phase],
    );
    const r = rows[0];
    return r ? { id: r.id, phase: r.phase, payload: r.payload, status: r.status, weekStart: String(r.week_start) } : null;
  } catch {
    return null;
  }
}
