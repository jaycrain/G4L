// Writing a week-grid cell.
//
// WHICH CELLS ARE TAPPABLE — the decision this file exists to enforce.
//
// The grid READS from wherever each week's truth already lives (see grid.ts). Writing back is not symmetric, because
// the three stores hold different things:
//
//   · B3 — practice_mark rows exist only to record "did this commitment happen on this day". A cell IS the record,
//     so toggling one is lossless and a mis-tap must be undoable. Tappable.
//   · B2 — same shape (a day-level mark), same reasoning. Tappable.
//   · W3 — a cell means "you logged this day", and the underlying momentum_call carries the member's own NOTE. An
//     un-tick would have to delete that row. Destroying something a member wrote, because they mis-tapped a box on
//     a summary grid, is not a trade we make. READ-ONLY.
//   · C3 — a cell is one element inside a Quality-Day entry that also holds a 1–10 score and two written
//     reflections. Same objection, and the member already has a proper surface for editing it. READ-ONLY.
//
// So the grid is a mirror for W3 and C3, and an input for B3 and B2. The UI must not offer a tap it can't honour —
// `isTappable` is exported so the client asks rather than assumes.

import type { Db } from '../db/schema.ts';
import type { ActivePractice, PracticeKind } from './store.ts';

/** Kinds whose grid cells the member can tap directly, because the cell IS the whole record. */
export function isTappable(kind: PracticeKind): boolean {
  return kind === 'b3_pilot' || kind === 'b2_noticing';
}

/**
 * For a MIRROR week, where does the member actually write the record?
 *
 * `isTappable` above answers "can this cell be written here" and the answer for W3/C3 is no. That was only ever half
 * an answer, and the missing half cost us: the C3 daily log lives at /quality-day/<id>, it has been built and live
 * since v2.5 — and NOTHING IN THE APP LINKED TO IT. The only occurrence of that path outside its own directory was
 * the route redirecting to itself. So C3 told a member "we'll track it for a week", opened the week, and then gave
 * them nowhere to go. Jay found it the obvious way, by tapping the grid on his own account and having nothing happen
 * (2026-08-09). A read-only cell that leads nowhere reads as a broken checkbox, not as a mirror.
 *
 * So the rule in this file is now stated in full: a cell the member cannot write HERE must say where they CAN.
 *
 *   · C3 — a dedicated form (score 1–10, which elements were present, most valuable / most missing). Needs a link.
 *   · W3 — the Companion writes w3_daily_entry from the check-in thread, so the member's route is a conversation,
 *     not a page. Returning null is CORRECT here, not an omission; the foot copy points at the Companion instead.
 *   · B3 / B2 — tappable, so the grid is the surface. No elsewhere to point to.
 */
export function logSurfaceFor(kind: PracticeKind, memberId: string): { href: string; label: string } | null {
  if (kind === 'c3_quality') return { href: `/quality-day/${memberId}`, label: 'Log today' };
  return null;
}

/** Resolve a day index within the window to a calendar date, using the WEEK's clock — never the browser's. */
export function dateForDay(startedAt: string | Date, dayIndex: number): string {
  const iso = startedAt instanceof Date ? startedAt.toISOString() : String(startedAt);
  const start = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + dayIndex);
  return start.toISOString().slice(0, 10);
}

/** Toggle one cell. Returns the resulting state so an optimistic UI can reconcile rather than guess. */
export async function toggleMark(
  db: Db,
  memberId: string,
  pw: ActivePractice,
  slot: string,
  dayIndex: number,
  source: 'grid' | 'companion',
): Promise<{ ok: boolean; on?: boolean; error?: string }> {
  if (!isTappable(pw.kind)) {
    // Not a user error — the UI shouldn't have offered it. Say so plainly rather than failing silently.
    return { ok: false, error: 'This week is a mirror of your log — edit it where you wrote it.' };
  }
  const markedOn = dateForDay(pw.startedAt, dayIndex);

  if (pw.kind === 'b2_noticing') {
    const del = await db.query(
      `delete from practice_mark where member_id=$1 and kind=$2 and commitment_id is null and marked_on=$3 returning id`,
      [memberId, pw.kind, markedOn],
    );
    if (del.rows.length) return { ok: true, on: false };
    await db.query(
      `insert into practice_mark (member_id, kind, marked_on, source) values ($1,$2,$3,$4) on conflict do nothing`,
      [memberId, pw.kind, markedOn, source],
    );
    return { ok: true, on: true };
  }

  const commitment = (
    await db.query<{ id: string }>(
      `select id from practice_commitment where member_id=$1 and kind=$2 and slot=$3`,
      [memberId, pw.kind, slot],
    )
  ).rows[0];
  if (!commitment) return { ok: false, error: 'That commitment is no longer on your week.' };

  const del = await db.query(
    `delete from practice_mark where member_id=$1 and commitment_id=$2 and marked_on=$3 returning id`,
    [memberId, commitment.id, markedOn],
  );
  if (del.rows.length) return { ok: true, on: false };
  await db.query(
    `insert into practice_mark (member_id, kind, commitment_id, marked_on, source) values ($1,$2,$3,$4,$5)
     on conflict do nothing`,
    [memberId, pw.kind, commitment.id, markedOn, source],
  );
  return { ok: true, on: true };
}

/** Write the week's grid ROWS from a committed B3 plan. Upsert on (member, kind, slot) so re-running B3 refreshes
 *  the same two rows rather than accumulating a new pair every cycle. Best-effort at the caller: a member who
 *  committed a plan must never be blocked because the grid couldn't be set up. */
export async function setPilotCommitments(
  db: Db,
  memberId: string,
  plan: { activityChange: string; dietChange: string; activityDays?: number; dietDays?: number },
): Promise<void> {
  const rows: [string, string, number | null, number][] = [
    ['activity', plan.activityChange, plan.activityDays ?? null, 0],
    ['diet', plan.dietChange, plan.dietDays ?? null, 1],
  ];
  for (const [slot, label, target, sort] of rows) {
    if (!label?.trim()) continue;
    await db.query(
      `insert into practice_commitment (member_id, kind, slot, label, target_days, sort_order)
       values ($1,'b3_pilot',$2,$3,$4,$5)
       on conflict (member_id, kind, slot)
       do update set label = excluded.label, target_days = excluded.target_days, updated_at = now()`,
      [memberId, slot, label.trim(), target, sort],
    );
  }
}
