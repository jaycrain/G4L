// The coaching-plan artifact store (coaching_plan / 0052) — the member-owned plan behind the Companion COACHING mode
// (Decision PP / RB-4). GENERIC over phase + payload so Reclaim + Cycle 2 reuse it; the per-Phase payload SHAPE lives
// here in the types, not the schema. Rebuild B3's payload is the two small changes.

import type { Db } from '../db/schema.ts';

export type CoachingPhase = 'rebuild' | 'reclaim' | 'cycle2';
// activityDays / dietDays are the MEMBER's number ("5 days a week"), captured by the B3 coach — Greg's sample grid
// carries a target per row, and without one a practice week has nothing to close against. OPTIONAL on purpose: a
// plan with no target is still a plan, and a member who won't pick a number must never be blocked from committing.
// BACKUPS + OBSTACLES are Greg's, and they are the difference between a plan for a good week and a plan that
// survives a real one. B3's Science Check puts them in the scientific scaffolding (#3, action planning /
// implementation intentions), not in passing: "define backup versions, and anticipate likely obstacles. This
// increases the odds that the plan can survive a NORMAL week instead of only an IDEAL one." His Engineering Memo
// names the storage — activity_backup, dietary_backup, anticipated_obstacles.
//
// OPTIONAL, for the same reason the day targets are: a plan without a backup is still a plan, and a member who
// won't name one must never be blocked from committing. The backup is what a member falls back TO after the first
// miss — which is the moment B3 exists to teach recovery from, so it earns the prompt, not a requirement.
//
// No migration: coaching_plan.payload is jsonb and this type IS the shape. Plans written before 2026-08-17 simply
// have the fields absent, which reads the same as a member declining them.
export type RebuildPilotPayload = {
  activityChange: string;
  dietChange: string;
  activityDays?: number;
  dietDays?: number;
  activityBackup?: string;
  dietBackup?: string;
  /** What they expect to get in the way this week — in their words, not a picklist. */
  obstacles?: string;
};
export type CoachingPlan<P = Record<string, unknown>> = {
  id: string;
  phase: CoachingPhase;
  payload: P;
  status: string;
  weekStart: string;
};

// Persist a new active coaching plan — a re-run SUPERSEDES rather than mutating. Generic; the caller supplies the
// phase + the payload shape. Best-effort at the caller (a write hiccup never breaks the close).
//
// "Most-recent-active-wins" used to be enforced ONLY by the reader's `order by created_at desc limit 1`, while every
// superseded row stayed marked 'active' forever. That makes the invariant a property of how we ASK rather than of the
// data: with two rows sharing a created_at, the tie is broken by whatever the heap returns, and the STALE plan can
// win. It did — `tests/c3-recovery.test.ts` caught the Quality-Day version of this intermittently (2026-08-09), which
// is the same bug wearing a different payload. Now exactly one row is ever 'active' and the reader's ORDER BY is a
// safety net instead of the mechanism.
//
// INSERT FIRST, THEN RETIRE THE OTHERS — the order is load-bearing, because both statements are best-effort and can
// fail independently (there is no transaction here):
//   · retire-then-insert, insert fails  → the member has NO active plan. Strictly worse than the bug being fixed.
//   · insert-then-retire, insert fails  → nothing changed, their existing plan still stands.
//   · insert-then-retire, retire fails  → two actives, newest-wins by ORDER BY. Exactly today's behaviour.
// So every failure path degrades to "no worse than before" rather than to data loss.
export async function persistCoachingPlan<P>(db: Db, memberId: string, phase: CoachingPhase, payload: P): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `insert into coaching_plan (member_id, phase, payload, status) values ($1, $2, $3::text::jsonb, 'active') returning id`,
    [memberId, phase, JSON.stringify(payload)],
  );
  const id = rows[0]?.id;
  if (!id) return; // no id back = nothing to retire against; leave the prior plan alone rather than guess
  // Scoped to the SAME predicate the reader uses (member + phase + active), so it can never retire a row the reader
  // wouldn't have considered. `id <> $3` protects the row we just wrote if its created_at ties with an older one.
  await db.query(
    `update coaching_plan set status='superseded', updated_at=now()
      where member_id=$1 and phase=$2 and status='active' and id <> $3`,
    [memberId, phase, id],
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
