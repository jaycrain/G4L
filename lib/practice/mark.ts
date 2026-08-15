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

import { addDays } from '../time/member-clock.ts';
import type { Db } from '../db/schema.ts';
import type { ActivePractice, PracticeKind } from './store.ts';

/**
 * Kinds whose grid cells the member can write from directly.
 *
 * W3 JOINED THIS LIST 2026-08-12. It was a mirror on the reasoning that "the Companion writes it" — which, going
 * back to Greg's Engineering Memo, is ours and not his. His ten UX requirements ask for a "Quick check-in
 * interface — low-friction daily entry" and for the Companion to support the habit "through anchoring, friction
 * reduction, and streak reinforcement". Jay tapped the boxes three times across two days; a checkbox that refuses
 * is friction with nothing on the other side. The conversation stays — this is a second way IN to the same record,
 * not a replacement for the coach.
 *
 * C3 IS STILL NOT HERE, and that is not an oversight: a Quality Day carries a 1–10 score the grid has no way to
 * ask for, so its cells link to the form that can. The rule is the same one either way — a cell either writes the
 * record or says where the record is written.
 */
export function isTappable(kind: PracticeKind): boolean {
  return kind === 'b3_pilot' || kind === 'b2_noticing' || kind === 'w3_logging' || kind === 'reclaim_item';
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
 *   · W3 — TAPPABLE since 2026-08-12, so there is nothing to point at: the cell writes the entry. The check-in
 *     conversation still writes the richer day (good calls, the old voice, a reflection); the grid writes the two
 *     fields it can express honestly. Two ways in, one record.
 *   · B3 / B2 — tappable, so the grid is the surface. No elsewhere to point to.
 */
export function logSurfaceFor(kind: PracticeKind, memberId: string, on?: string | null): { href: string; label: string } | null {
  // THE CELL CARRIES ITS DATE (Jay, 2026-08-15). Every cell used to link to the same dateless URL while the form
  // behind it always wrote TODAY — so tapping Thursday logged Saturday and left Thursday blank. A member reads
  // that as "it won't save a second day", which is what Jay reported. The date travels in the link now; the page
  // re-validates it rather than trusting a query string.
  if (kind !== 'c3_quality') return null;
  return { href: on ? `/quality-day/${memberId}?on=${on}` : `/quality-day/${memberId}`, label: 'Log today' };
}

/**
 * May this date still be logged? Today, or yesterday — nothing else.
 *
 * Jay chose yesterday-only over the whole open week (2026-08-15). Quality Days is a NOTICING practice: rating
 * Thursday on Sunday is recall, not noticing, and recalled scores drift toward "fine" — let members fill a week
 * and the measure quietly becomes softer than the asset Greg designed. Missing a day and catching it next
 * morning is real life; reconstructing Tuesday on Sunday is inventing data.
 */
export function canLogOn(date: string, today: string): boolean {
  return date === today || date === addDays(today, -1);
}

/** Resolve a day index within a window to a calendar date. The window's start is already a member-local date,
 *  so this is plain calendar arithmetic — no zone applied a second time. */
export function dateForDay(window: { start: string }, dayIndex: number): string {
  return addDays(window.start, dayIndex);
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
  const markedOn = dateForDay(pw.window, dayIndex);

  // W3 lives in its own register — Greg's seven-field daily entry, not practice_mark. The grid's two row shapes map
  // onto two of those fields exactly: the 'logged' row is "an entry exists for this date", a trigger row is
  // `trigger_fired`. Everything else on the day stays untouched, and an un-tick that would delete the member's
  // writing is refused rather than performed.
  if (pw.kind === 'w3_logging') {
    const { readW3Day, ensureW3Day, setW3Trigger, clearW3Day } = await import('../rewire/w3-entry.ts');
    const day = await readW3Day(db, memberId, markedOn);
    if (slot === 'logged') {
      if (day.exists) {
        const cleared = await clearW3Day(db, memberId, markedOn);
        return cleared.ok ? { ok: true, on: false } : { ok: false, error: cleared.error };
      }
      await ensureW3Day(db, memberId, markedOn, source);
      return { ok: true, on: true };
    }
    // A trigger row. Ticking the one already recorded clears it; ticking a different one moves the record, which
    // is the member correcting which trigger it was — singular is Greg's design, not a limitation to work around.
    const on = day.triggerSlot !== slot;
    await setW3Trigger(db, memberId, markedOn, on ? slot : null, source);
    return { ok: true, on };
  }

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

/**
 * Open a practice week for ONE Reclaim List item — the cadence path (#155).
 *
 * THE FIRST WEEK A MEMBER STARTS THEMSELVES. Every other kind is opened by a Session closing; this one is opened
 * from their own list, because "Yoga and kettlebell work 3 times per week" is a commitment they already made and
 * the week grid is the instrument that helps them keep it.
 *
 * SLOT IS THE RECLAIM ITEM'S ID, which is doing real work: `practice_commitment` is unique on
 * (member_id, kind, slot), so the item id gives each tracked item exactly one row, makes starting the same item
 * twice idempotent, and links the commitment back to the item WITHOUT a new column. No migration for any of it.
 *
 * Re-running refreshes the label and target (the member may have reworded the item) and re-opens the window,
 * which is the same upsert posture as setPilotCommitments above.
 */
export async function trackReclaimItem(
  db: Db,
  memberId: string,
  item: { id: string; text: string },
): Promise<void> {
  const label = (item.text ?? '').trim();
  if (!item.id || !label) return; // nothing to track, and a blank label would render an empty grid row
  const { startPracticeWeek } = await import('./store.ts');
  const { cadenceTarget } = await import('../reclaim/goal-kind.ts');
  await startPracticeWeek(db, memberId, 'reclaim_item');
  await db.query(
    `insert into practice_commitment (member_id, kind, slot, label, target_days, sort_order)
     values ($1,'reclaim_item',$2,$3,$4,0)
     on conflict (member_id, kind, slot)
     do update set label = excluded.label, target_days = excluded.target_days, updated_at = now()`,
    [memberId, item.id, label, cadenceTarget(label)],
  );
}

/** The Reclaim item ids that already have a commitment — so the affordance reads "tracking" instead of re-offering. */
export async function trackedReclaimItemIds(db: Db, memberId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ slot: string }>(
    `select slot from practice_commitment where member_id = $1 and kind = 'reclaim_item'`,
    [memberId],
  );
  return new Set(rows.map((r) => r.slot));
}
