import type { Db } from '../db/schema.ts';

// Member-logged movement (0057) — activities done OUTSIDE any connected device, entered on the Movement page or told
// to the Companion. The write side of the vendor-agnostic Movement layer (see movement.ts); reads merge with synced
// activity via blendTimeline. Governance (YY): interpreted against who they're reclaiming, never a bare number.

export type MovementLogSource = 'self' | 'companion';
// The kinds the member can log (kept small + honest; 'other' catches the rest).
export const MOVEMENT_KINDS = ['walk', 'ride', 'run', 'hike', 'swim', 'workout', 'other'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const isMovementKind = (t: unknown): t is MovementKind =>
  typeof t === 'string' && (MOVEMENT_KINDS as readonly string[]).includes(t);

export type MovementLogEntry = {
  id: string;
  source: MovementLogSource;
  activityType: MovementKind;
  note: string | null;
  occurredOn: string; // YYYY-MM-DD
  daysAgo: number;
};

/** Record one member-logged activity. `occurredOn` (YYYY-MM-DD) defaults to today; a bad date falls back to today. */
export async function logMovement(
  db: Db,
  memberId: string,
  input: { activityType: MovementKind; note?: string | null; occurredOn?: string | null; source?: MovementLogSource },
): Promise<void> {
  const on = input.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ? input.occurredOn : null;
  await db.query(
    `insert into movement_log (member_id, source, activity_type, note, occurred_on)
     values ($1, $2, $3, $4, coalesce($5::date, current_date))`,
    [memberId, input.source ?? 'self', input.activityType, input.note?.trim() || null, on],
  );
}

/** The member's logged activity, newest first, with days-ago for grouping. Defaults to the last 30 days. */
export async function listMovementLog(db: Db, memberId: string, days = 30): Promise<MovementLogEntry[]> {
  const { rows } = await db.query<{ id: string; source: MovementLogSource; activity_type: MovementKind; note: string | null; occurred_on: string; days_ago: number }>(
    `select id, source, activity_type, note,
            to_char(occurred_on, 'YYYY-MM-DD') as occurred_on,
            (current_date - occurred_on)::int as days_ago
       from movement_log
      where member_id = $1 and occurred_on >= current_date - ($2 || ' days')::interval
      order by occurred_on desc, created_at desc`,
    [memberId, days],
  );
  return rows.map((r) => ({ id: r.id, source: r.source, activityType: r.activity_type, note: r.note, occurredOn: r.occurred_on, daysAgo: r.days_ago }));
}

/** A one-line summary of recent logged movement for the Companion's context (so the agent KNOWS it — governance §
 *  reconciliation). Empty string when there's nothing, so the caller can omit the line. */
export async function movementLogSummary(db: Db, memberId: string, days = 14): Promise<string> {
  const rows = await listMovementLog(db, memberId, days);
  if (rows.length === 0) return '';
  const recent = rows.slice(0, 5).map((r) => `${r.activityType}${r.note ? ` (${r.note})` : ''} · ${r.daysAgo === 0 ? 'today' : `${r.daysAgo}d ago`}`);
  return `${rows.length} self-logged in the last ${days}d: ${recent.join('; ')}`;
}
