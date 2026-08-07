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
