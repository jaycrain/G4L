// THE WEEK GRID — Greg's tracker, read from wherever each week's truth already lives.
//
// Greg (2026-08-07): "I would like to work on having the grid type of tracker for W3, B3 and C3 … it would help to
// show progress during the week to maintain motivation." His sample sheet is rows (the member's committed goals, each
// with a target like "5 days in the week") × seven day columns, ticked when done.
//
// THE ONE DESIGN DECISION WORTH DEFENDING. The obvious build is a single practice_mark table every week writes to,
// and it is wrong, because two of the three ALREADY hold their per-day record:
//   · C3 — quality_day_log.present[] is exactly "which elements were true on which day"
//   · W3 — momentum_call is a typed entry per day
// Copying those into a second table would create two records of one fact, and two records of one fact drift. That is
// this morning's checkpoint bug (a gate said done, a progress row said nothing) restated one day later. So the grid
// is a READ MODEL with a per-kind adapter, and new storage exists only for B3, which genuinely had none.
//
// The cost is that this file has to know three shapes. That is the honest price of not duplicating member data, and
// it is paid once, here, behind one function.

import type { Db } from '../db/schema.ts';
import { PRACTICE_WINDOW_DAYS, type PracticeKind } from './store.ts';

/** One grid row: a thing being tracked across the window. `marks[i]` = day i+1 (index 0 is the week's first day). */
export type GridRow = {
  slot: string;
  label: string;
  target: number | null; // the MEMBER's number ("5 days"); null = nothing to hit, just noticing
  marks: boolean[]; // length PRACTICE_WINDOW_DAYS
  done: number; // marks.filter(Boolean).length — precomputed so the UI never recounts
};

export type WeekGrid = {
  kind: PracticeKind;
  startedAt: string;
  day: number; // 1..PRACTICE_WINDOW_DAYS — which day of the window today is
  rows: GridRow[];
  closed: boolean;
};

/** Day index (0-based) for a logged date within a window, or -1 when it falls outside.
 *
 *  Takes string OR Date because the drivers disagree: practice_week.started_at arrives as a Date, while the ::text
 *  casts elsewhere give strings. Assuming one shape is what made the first version of this return null for every
 *  member — `Date.slice is not a function`, swallowed by the catch below.
 *
 *  Both sides truncate to a UTC calendar day before differencing, so an 11pm tick can't roll into tomorrow. */
export function dayIndex(startedAt: string | Date, loggedOn: string | Date): number {
  const day = (v: string | Date): number => {
    const iso = v instanceof Date ? v.toISOString() : String(v);
    return Math.floor(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() / 86_400_000);
  };
  const i = day(loggedOn) - day(startedAt);
  return i >= 0 && i < PRACTICE_WINDOW_DAYS ? i : -1;
}

const emptyMarks = (): boolean[] => Array.from({ length: PRACTICE_WINDOW_DAYS }, () => false);

/** Build a row from a label + the dates it was true. Shared by every adapter so `done` can't drift from `marks`. */
export function buildRow(slot: string, label: string, target: number | null, startedAt: string | Date, dates: (string | Date)[]): GridRow {
  const marks = emptyMarks();
  for (const d of dates) {
    const i = dayIndex(startedAt, d);
    if (i >= 0) marks[i] = true;
  }
  return { slot, label, target, marks, done: marks.filter(Boolean).length };
}

// ── per-kind adapters ─────────────────────────────────────────────────────────────────────────────────────────

/** B3 · the Lifestyle Pilot — the only kind with its own storage, because it's the only one that had none. */
async function b3Rows(db: Db, memberId: string, startedAt: string | Date): Promise<GridRow[]> {
  const { rows } = await db.query<{ id: string; slot: string; label: string; target_days: number | null }>(
    `select id, slot, label, target_days from practice_commitment
      where member_id = $1 and kind = 'b3_pilot' order by sort_order, created_at`,
    [memberId],
  );
  if (!rows.length) return [];
  const marks = (
    await db.query<{ commitment_id: string; marked_on: string }>(
      `select commitment_id, marked_on::text as marked_on from practice_mark
        where member_id = $1 and kind = 'b3_pilot' and commitment_id is not null`,
      [memberId],
    )
  ).rows;
  return rows.map((c) =>
    buildRow(c.slot, c.label, c.target_days, startedAt, marks.filter((m) => m.commitment_id === c.id).map((m) => m.marked_on)),
  );
}

/** C3 · Quality Days — rows are the member's OWN Quality-Day elements; the per-day record is already in the log. */
async function c3Rows(db: Db, memberId: string, startedAt: string | Date): Promise<GridRow[]> {
  const { activeQualityDayProfile, recentQualityDays, profileElements } = await import('../reclaim/quality-day-store.ts');
  const profile = await activeQualityDayProfile(db, memberId);
  if (!profile) return [];
  const entries = await recentQualityDays(db, memberId, PRACTICE_WINDOW_DAYS);
  // No target: a Quality-Day element isn't a quota to hit, it's a condition to notice. Showing "3/7" against
  // something the member never committed to a number for would invent a standard they never set.
  return profileElements(profile).map((label, i) =>
    buildRow(`qd-${i}`, label, null, startedAt, entries.filter((e) => e.present.includes(label)).map((e) => e.loggedOn)),
  );
}

/** W3 · the False Start Protocol — one row, because what's tracked is "did you log the day at all", not a checklist. */
async function w3Rows(db: Db, memberId: string, startedAt: string | Date): Promise<GridRow[]> {
  const { recentCalls } = await import('../momentum/store.ts');
  const calls = await recentCalls(db, memberId, 60);
  return [buildRow('logged', 'Noticed the day', null, startedAt, calls.map((c) => c.loggedOn))];
}

/** B2 · the noticing week — day-level notes, no commitments (its answer had nowhere to land before 0072). */
async function noteRows(db: Db, memberId: string, kind: PracticeKind, startedAt: string | Date, label: string): Promise<GridRow[]> {
  const { rows } = await db.query<{ marked_on: string }>(
    `select marked_on::text as marked_on from practice_mark
      where member_id = $1 and kind = $2 and commitment_id is null`,
    [memberId, kind],
  );
  return [buildRow('noticed', label, null, startedAt, rows.map((r) => r.marked_on))];
}

// ── the one entry point ───────────────────────────────────────────────────────────────────────────────────────

/** The member's active practice week as a grid, or null. Drift-hardened like the rest of lib/practice: a missing
 *  table or a read hiccup degrades to null (no grid) rather than taking a panel down. */
export async function weekGrid(db: Db, memberId: string): Promise<WeekGrid | null> {
  try {
    const { activePracticeWeek } = await import('./store.ts');
    const pw = await activePracticeWeek(db, memberId);
    if (!pw) return null;
    const closed = (
      await db.query<{ closed_at: string | null }>(
        `select closed_at from practice_week where member_id = $1 and kind = $2`,
        [memberId, pw.kind],
      )
    ).rows[0]?.closed_at != null;

    const rows =
      pw.kind === 'b3_pilot' ? await b3Rows(db, memberId, pw.startedAt)
      : pw.kind === 'c3_quality' ? await c3Rows(db, memberId, pw.startedAt)
      : pw.kind === 'w3_logging' ? await w3Rows(db, memberId, pw.startedAt)
      : pw.kind === 'b2_noticing' ? await noteRows(db, memberId, 'b2_noticing', pw.startedAt, 'Noticed a skill')
      : []; // w2_image is five minutes in a picture — nothing countable, and forcing a grid onto it would be noise

    return { kind: pw.kind, startedAt: String(pw.startedAt), day: pw.day, rows, closed };
  } catch (e) {
    // LOG, don't just swallow. The first version of this file returned null for every member because started_at is a
    // Date and dayIndex assumed a string — and a bare `catch { return null }` reported that as "no practice week",
    // which is indistinguishable from the truth. A silent degrade is right for the member (the panel just doesn't
    // render); staying silent for US is how a broken read gets shipped as a feature.
    console.error(`weekGrid failed for member=${memberId}:`, e);
    return null;
  }
}

/** Did they hit what they aimed for? Only meaningful for rows that HAVE a target — the rest are excluded rather than
 *  counted as met, so a week of pure noticing never reports a score it was never keeping. */
export function targetSummary(rows: GridRow[]): { met: number; of: number } | null {
  const targeted = rows.filter((r) => r.target != null && r.target > 0);
  if (!targeted.length) return null;
  return { met: targeted.filter((r) => r.done >= (r.target ?? 0)).length, of: targeted.length };
}
