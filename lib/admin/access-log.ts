// WHO OPENED WHOSE STORY.
//
// One row each time an operator opens an INDIVIDUAL member's record. Not roster views, not aggregates — logging
// every list render would bury the signal, and the roster isn't where the story lives. The unit is the same one
// lib/founder/companion-tools.ts already counts as `budget.openedMembers`: opening one person.
//
// WHAT THIS IS NOT. It doesn't stop anyone. An operator holds the credentials, and anyone with the Vercel project
// can read DATABASE_URL and query Postgres directly. This is a deterrent and a record — the thing you need to
// answer a member who asks, or to reconstruct an incident. Claiming more for it would be dishonest.
//
// FAILURE POSTURE: logging must NEVER break the surface it observes. If the insert fails, the operator still sees
// the page. The alternative — an audit failure that takes down the console — trades a real capability for a
// theoretical one, and would get the logging ripped out the first time it fired. But it must not fail SILENTLY
// either: a swallowed write here would manufacture the most dangerous possible lie, an empty log reading as
// "nobody looked". So the catch logs loudly. (This is the third time that shape has cost us; see the memory note
// swallowed-read-renders-as-truth.)

import type { Db } from '../db/schema.ts';

export type AccessSurface = 'admin_member_page' | 'diagnostic_api' | 'founder_companion';

export type AccessEntry = {
  at: Date;
  operatorId: string | null;
  operatorLabel: string;
  memberId: string;
  surface: AccessSurface;
  note: string | null;
};

/** Record an open. Best-effort, loud on failure, never throws into the caller. */
export async function recordMemberAccess(
  db: Db,
  entry: { operatorId: string | null; operatorLabel: string; memberId: string; surface: AccessSurface; note?: string },
): Promise<void> {
  try {
    await db.query(
      `insert into member_access_log (operator_id, operator_label, member_id, surface, note)
       values ($1, $2, $3, $4, $5)`,
      [entry.operatorId, entry.operatorLabel, entry.memberId, entry.surface, entry.note ?? null],
    );
  } catch (e) {
    // Loud, and it names what was lost — an unrecorded access is exactly the event this table exists for.
    console.error(
      `ACCESS LOG WRITE FAILED — ${entry.operatorLabel} opened member=${entry.memberId} via ${entry.surface}, NOT RECORDED:`,
      (e as Error).message,
    );
  }
}

/** "Who has looked at this member?" — the question a member is entitled to ask. */
export async function accessesForMember(db: Db, memberId: string, limit = 100): Promise<AccessEntry[]> {
  const { rows } = await db.query<{
    at: Date; operator_id: string | null; operator_label: string; member_id: string; surface: string; note: string | null;
  }>(
    `select at, operator_id, operator_label, member_id, surface, note
       from member_access_log where member_id = $1 order by at desc limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => ({
    at: r.at, operatorId: r.operator_id, operatorLabel: r.operator_label,
    memberId: r.member_id, surface: r.surface as AccessSurface, note: r.note,
  }));
}

/** "What did this operator open?" — the other direction, for a review or an offboarding. */
export async function accessesByOperator(db: Db, operatorId: string, limit = 200): Promise<AccessEntry[]> {
  const { rows } = await db.query<{
    at: Date; operator_id: string | null; operator_label: string; member_id: string; surface: string; note: string | null;
  }>(
    `select at, operator_id, operator_label, member_id, surface, note
       from member_access_log where operator_id = $1 order by at desc limit $2`,
    [operatorId, limit],
  );
  return rows.map((r) => ({
    at: r.at, operatorId: r.operator_id, operatorLabel: r.operator_label,
    memberId: r.member_id, surface: r.surface as AccessSurface, note: r.note,
  }));
}
