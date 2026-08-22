// THE WEEK GRID — Greg's tracker, read from wherever each week's truth already lives.
//
// Greg (2026-08-07): "I would like to work on having the grid type of tracker for W3, B3 and C3 … it would help to
// show progress during the week to maintain motivation." His sample sheet is rows (the member's committed goals, each
// with a target like "5 days in the week") × seven day columns, ticked when done.
//
// THE ONE DESIGN DECISION WORTH DEFENDING. The obvious build is a single practice_mark table every week writes to,
// and it is wrong, because two of the three ALREADY hold their per-day record:
//   · C3 — quality_day_log.present[] is exactly "which elements were true on which day"
//   · W3 — momentum_call is a typed entry per day  ← NO LONGER TRUE, see below
// Copying those into a second table would create two records of one fact, and two records of one fact drift. That is
// this morning's checkpoint bug (a gate said done, a progress row said nothing) restated one day later. So the grid
// is a READ MODEL with a per-kind adapter, and new storage exists only for B3, which genuinely had none.
//
// W3 MOVED OFF MOMENTUM on 2026-08-08 (migration 0074, w3_daily_entry). Greg wants the bounded monitoring week kept
// separate from the ongoing tracker for Cycle 1, and his seven-field tracker cannot fit in a typed call plus a note.
// The principle above still stands — this is not a second record of the same fact, it is a different fact — but the
// example is now wrong, and a stale example is how the next person re-derives the thing we just undid.
//
// The cost is that this file has to know three shapes. That is the honest price of not duplicating member data, and
// it is paid once, here, behind one function.

import type { Db } from '../db/schema.ts';
import { PRACTICE_WINDOW_DAYS, type PracticeKind, type ActivePractice } from './store.ts';
import { columnFor, addDays, type MemberWeek } from '../time/member-clock.ts';

// A run can span a six-day stub plus a full week, so "the last seven days" no longer covers it. Fetch generously
// and let columnFor decide what belongs in which window — the alternative is a stub whose ticks quietly fall out
// of the query before anything gets to render them.
const RUN_LOOKBACK_DAYS = 21;

/** One grid row: a thing being tracked across the window. `marks[i]` = day i+1 (index 0 is the week's first day). */
export type GridRow = {
  slot: string;
  label: string;
  target: number | null; // the MEMBER's number ("5 days"); null = nothing to hit, just noticing
  marks: boolean[]; // length = the window's days (7, or fewer for a partial first week)
  done: number; // marks.filter(Boolean).length — precomputed so the UI never recounts
};

export type WeekGrid = {
  kind: PracticeKind;
  startedAt: string;
  /** The window this grid draws: Mon–Sun, or the partial first week. */
  window: MemberWeek;
  day: number; // 1..window.days — which day of the window today is
  rows: GridRow[];
  closed: boolean;
  /**
   * The finished partial first week, kept on screen above the current one.
   *
   * Jay, 2026-08-12, shown that a member who ticked four days Thu–Sun would open the grid on Monday to an empty
   * one: keep it visible. Ticks a member made must never appear to vanish. Null unless the run has rolled.
   */
  prior: { window: MemberWeek; rows: GridRow[] } | null;
  /**
   * C3 ONLY — the 1–10 score the member gave each day, indexed like `marks` (null = no log that day).
   *
   * WHY IT IS HERE AT ALL (Jay, 2026-08-15, on his own account). C3's grid showed the ELEMENTS and nothing else,
   * so the day's score — the actual measure the asset exists to take — was invisible on the surface a member
   * looks at every morning. The consequence was not cosmetic: Jay read the element boxes as individually
   * scoreable and logged a week thinking he was rating "bike ride" rather than the day. If the founder mis-reads
   * the model, a member has no chance. Showing the score is what makes "rate the day, then mark what showed up"
   * legible without a word of instruction.
   *
   * Left undefined for every other kind: no other week has a per-day scalar, and an optional field they all
   * carry as null would invite a UI that renders an empty row for them.
   */
  scores?: (number | null)[];
};

/**
 * Column (0-based) for a logged date within a window, or -1 when it falls outside.
 *
 * Takes string OR Date because the drivers disagree: practice_week.started_at arrives as a Date, while the ::text
 * casts elsewhere give strings. Assuming one shape is what made the first version of this return null for every
 * member — `Date.slice is not a function`, swallowed by the catch below.
 *
 * The window's start is a MEMBER-LOCAL calendar date, so this is pure calendar arithmetic with no zone applied a
 * second time.
 */
export function dayIndex(window: MemberWeek, loggedOn: string | Date): number {
  const iso = loggedOn instanceof Date ? loggedOn.toISOString() : String(loggedOn);
  return columnFor(window, iso.slice(0, 10)) ?? -1;
}

const emptyMarks = (days: number): boolean[] => Array.from({ length: days }, () => false);

/** Build a row from a label + the dates it was true. Shared by every adapter so `done` can't drift from `marks`. */
export function buildRow(slot: string, label: string, target: number | null, window: MemberWeek, dates: (string | Date)[]): GridRow {
  const marks = emptyMarks(window.days);
  for (const d of dates) {
    const i = dayIndex(window, d);
    if (i >= 0) marks[i] = true;
  }
  return { slot, label, target, marks, done: marks.filter(Boolean).length };
}

// ── per-kind adapters ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Kinds whose rows ARE practice_commitment rows — B3's Lifestyle Pilot and, since 2026-08-14, a cadence a member
 * starts from their own Reclaim List.
 *
 * PARAMETERISED BY KIND rather than copied. This function had `'b3_pilot'` written into it twice, and adding a
 * second commitment-backed kind by duplicating it would have made two copies of one query that must agree — the
 * shape that has cost real time on this codebase. The kind is now an argument and there is still one query.
 */
async function commitmentRows(db: Db, memberId: string, kind: PracticeKind, window: MemberWeek): Promise<GridRow[]> {
  const { rows } = await db.query<{ id: string; slot: string; label: string; target_days: number | null }>(
    `select id, slot, label, target_days from practice_commitment
      where member_id = $1 and kind = $2 order by sort_order, created_at`,
    [memberId, kind],
  );
  if (!rows.length) return [];
  const marks = (
    await db.query<{ commitment_id: string; marked_on: string }>(
      `select commitment_id, marked_on::text as marked_on from practice_mark
        where member_id = $1 and kind = $2 and commitment_id is not null`,
      [memberId, kind],
    )
  ).rows;
  return rows.map((c) =>
    buildRow(c.slot, c.label, c.target_days, window, marks.filter((m) => m.commitment_id === c.id).map((m) => m.marked_on)),
  );
}

/** C3 · Quality Days — the day's 1–10 score per column (null where the day was not logged). See WeekGrid.scores. */
export async function c3Scores(db: Db, memberId: string, window: MemberWeek): Promise<(number | null)[]> {
  const { recentQualityDays } = await import('../reclaim/quality-day-store.ts');
  const entries = await recentQualityDays(db, memberId, RUN_LOOKBACK_DAYS);
  const byDate = new Map(entries.map((e) => [e.loggedOn, e.score]));
  return Array.from({ length: window.days }, (_, i) => byDate.get(addDays(window.start, i)) ?? null);
}

/** C3 · Quality Days — rows are the member's OWN Quality-Day elements; the per-day record is already in the log. */
async function c3Rows(db: Db, memberId: string, window: MemberWeek): Promise<GridRow[]> {
  const { activeQualityDayProfile, recentQualityDays, profileElements } = await import('../reclaim/quality-day-store.ts');
  const profile = await activeQualityDayProfile(db, memberId);
  if (!profile) return [];
  const entries = await recentQualityDays(db, memberId, RUN_LOOKBACK_DAYS);
  // No target: a Quality-Day element isn't a quota to hit, it's a condition to notice. Showing "3/7" against
  // something the member never committed to a number for would invent a standard they never set.
  return profileElements(profile).map((label, i) =>
    buildRow(`qd-${i}`, label, null, window, entries.filter((e) => e.present.includes(label)).map((e) => e.loggedOn)),
  );
}

/** W3 · Mindful Monitoring. Rows = "Noticed the day" + one per trigger the member NAMED.
 *
 *  CHANGED 2026-08-08, and it is a deliberate reversal of what this file said above. W3 used to read from
 *  momentum_call — a single binary row, "did you log at all". Two reasons it moved:
 *
 *    1. Greg, asked what W3's week should be: a bounded 1-week grid, kept SEPARATE from the ongoing Momentum
 *       tracker until members have learned the vocabulary ("we should focus on getting through Cycle 1").
 *       Deriving W3's week from Momentum calls IS the conflation he asked us to avoid.
 *    2. His tracker needs `trigger_fired` — "which named trigger, or 'new'" — which momentum_call cannot express.
 *
 *  WHY "Noticed the day" SURVIVES as row 1 rather than being replaced by the triggers. If rows were ONLY
 *  triggers, a day the member logged a good call and no trigger fired would show as a completely empty column —
 *  the grid would report nothing happened on a day they actually sat down and wrote. Worse, it would make the
 *  grid a record of things going WRONG, which inverts the whole posture. Row 1 is the tracking-consistency row,
 *  and consistency of tracking is exactly what Greg says the affirmations must target ("not the absence of False
 *  Starts"). The trigger rows add the detail underneath it.
 *
 *  No targets anywhere — W3 has no adherence measure in the asset. */
async function w3Rows(db: Db, memberId: string, window: MemberWeek): Promise<GridRow[]> {
  const [{ w3Entries }, { w3Triggers }] = await Promise.all([
    import('../rewire/w3-entry.ts'),
    import('../rewire/w3-triggers.ts'),
  ]);
  const [entries, triggers] = await Promise.all([
    w3Entries(db, memberId, RUN_LOOKBACK_DAYS),
    w3Triggers(db, memberId),
  ]);

  const noticed = buildRow('logged', 'Checked in', null, window, entries.map((e) => e.entryDate));

  // THE ROWS ARE HER THREE MOVES, NOT HER TRIGGERS (Donna 2026-08-21; Jay ruled 2026-08-22).
  //
  // Trigger rows recorded what went WRONG — the exact inversion the header of this function warns against. Greg's
  // Step 2 has the member author three responses (Redirect / Reframe / Restart), and W3-33 already carries
  // `recovery_used` — "whether the Member used the prepared response" — captured since August and never shown
  // anywhere. So the week now tracks what she DID about a false start, in the words she wrote for it.
  // See lib/rewire/w3-moves.ts.
  //
  // TRIGGERS ARE STILL CAPTURED, just not rendered here. `trigger_fired` is one of Greg's seven fields, the daily
  // check-in still asks what set a false start off (W3-31), and B3 may read it. Their `trigger-N` rows stay in
  // practice_commitment untouched — this changes the DISPLAY, it does not delete anything she named.
  const { rows: moveRows } = await db.query<{ id: string; slot: string; label: string }>(
    `select id, slot, label from practice_commitment
      where member_id = $1 and kind = 'w3_logging' and slot like 'move-%'
      order by sort_order`,
    [memberId],
  );

  // A member who finished W3 BEFORE the moves existed has trigger rows and no move rows. She keeps her triggers
  // rather than being left with one bare "Checked in" line: the old shape is worse than the new one, and an empty
  // week is worse than either.
  if (!moveRows.length) {
    const triggerRows = triggers.map((t) =>
      buildRow(t.slot, t.label, null, window, entries.filter((e) => e.triggerSlot === t.slot).map((e) => e.entryDate)),
    );
    return [noticed, ...triggerRows];
  }

  const marks = (
    await db.query<{ commitment_id: string; marked_on: string }>(
      `select commitment_id, marked_on::text as marked_on from practice_mark
        where member_id = $1 and kind = 'w3_logging' and commitment_id is not null`,
      [memberId],
    )
  ).rows;
  return [
    noticed,
    ...moveRows.map((m) =>
      buildRow(m.slot, m.label, null, window, marks.filter((k) => k.commitment_id === m.id).map((k) => k.marked_on)),
    ),
  ];
}

/** B2 · the noticing week — day-level notes, no commitments (its answer had nowhere to land before 0072). */
async function noteRows(db: Db, memberId: string, kind: PracticeKind, window: MemberWeek, label: string): Promise<GridRow[]> {
  const { rows } = await db.query<{ marked_on: string }>(
    `select marked_on::text as marked_on from practice_mark
      where member_id = $1 and kind = $2 and commitment_id is null`,
    [memberId, kind],
  );
  return [buildRow('noticed', label, null, window, rows.map((r) => r.marked_on))];
}

/**
 * B2 · the noticing week — rows are THE MEMBER'S OWN GROWING EDGES, not one generic line.
 *
 * DONNA, 2026-08-17: "these tracking items should be proposed based on the user's actual conversation with the
 * Companion" — she saw "Noticed a skill" sitting next to a W3 row that read "When there is conflict with my
 * husband" and asked, reasonably, where the generic one came from. Jay's sharper version: Greg will see this
 * immediately, because B2 IS his instrument and the whole point of it is that a member leaves knowing WHICH
 * skills to build.
 *
 * We already knew the answer and were not using it. B2 scores twelve skills; buildSkillsMap marks each one steady
 * or growing against the member's own median (lib/rebuild/skills-map.ts). The growing edges are exactly "the ones
 * you wanted to build" from Greg's own memo, in his order, in our plain-language labels — no new capture, no new
 * question, no guess.
 *
 * THREE, NOT TWELVE. A week with a dozen rows is a chore, and Greg is explicit that the tracker must stay usable
 * in under a minute. The three thinnest are where practice pays.
 *
 * FALLS BACK to the generic row when there is no reading yet — a member can reach this week without a scored B2
 * (a drifted register, a legacy account), and an empty grid would be worse than a plain one.
 */
async function b2Rows(db: Db, memberId: string, window: MemberWeek): Promise<GridRow[]> {
  try {
    const { latestSkillsReading } = await import('../rebuild/store.ts');
    const { buildSkillsMap } = await import('../rebuild/skills-map.ts');
    const reading = await latestSkillsReading(db, memberId);
    if (!reading) return noteRows(db, memberId, 'b2_noticing', window, 'Noticed a skill');
    const edges = buildSkillsMap(reading.scores)
      .families.flatMap((f) => f.rows)
      .filter((r) => !r.steady)
      .slice(0, 3);
    if (!edges.length) return noteRows(db, memberId, 'b2_noticing', window, 'Noticed a skill');
    const { rows } = await db.query<{ marked_on: string; commitment_id: string | null }>(
      `select marked_on::text as marked_on, commitment_id from practice_mark
        where member_id = $1 and kind = 'b2_noticing'`,
      [memberId],
    );
    return edges.map((e) => {
      const slot = `skill-${e.no}`;
      const marks = rows.filter((r) => (r.commitment_id ?? 'noticed') === slot).map((r) => r.marked_on);
      return buildRow(slot, e.label, null, window, marks);
    });
  } catch (err) {
    // Same degrade posture as the rest of this file: one bad read costs the personalisation, never the grid.
    console.error(`b2Rows failed for member=${memberId}:`, err);
    return noteRows(db, memberId, 'b2_noticing', window, 'Noticed a skill');
  }
}

// ── the one entry point ───────────────────────────────────────────────────────────────────────────────────────

/** The member's active practice week as a grid, or null. Drift-hardened like the rest of lib/practice: a missing
 *  table or a read hiccup degrades to null (no grid) rather than taking a panel down. */
/** Build ONE week's grid from an already-resolved week. Shared by weekGrid and weekGrids so the per-kind adapters
 *  live in exactly one place. */
async function rowsFor(db: Db, memberId: string, kind: PracticeKind, window: MemberWeek): Promise<GridRow[]> {
  return kind === 'b3_pilot' || kind === 'reclaim_item' ? commitmentRows(db, memberId, kind, window)
    : kind === 'c3_quality' ? c3Rows(db, memberId, window)
    : kind === 'w3_logging' ? w3Rows(db, memberId, window)
    : kind === 'b2_noticing' ? b2Rows(db, memberId, window)
    : []; // w2_image is five minutes in a picture — nothing countable, and forcing a grid onto it would be noise
}

async function gridFor(db: Db, memberId: string, pw: ActivePractice): Promise<WeekGrid> {
  const closed = (
    await db.query<{ closed_at: string | null }>(
      `select closed_at from practice_week where member_id = $1 and kind = $2`,
      [memberId, pw.kind],
    )
  ).rows[0]?.closed_at != null;
  const rows = await rowsFor(db, memberId, pw.kind, pw.window);
  // The stub is re-read against its OWN window rather than sliced out of the current one: a row's marks array is
  // indexed from its window's start, and the two windows do not start on the same day.
  const priorRows = pw.prior ? await rowsFor(db, memberId, pw.kind, pw.prior) : [];
  return {
    kind: pw.kind,
    startedAt: String(pw.startedAt),
    window: pw.window,
    day: pw.day,
    rows,
    closed,
    // Only carried when the member actually ticked something in it. An empty strip above the grid is clutter
    // that says nothing — the point is not losing marks they made, not commemorating a week they skipped.
    prior: pw.prior && priorRows.some((r) => r.done > 0) ? { window: pw.prior, rows: priorRows } : null,
    // Only C3 has a per-day score. Read it even when rows came back empty — an unlogged profile is a different
    // state from an unscored week, and the grid decides what to say about each.
    ...(pw.kind === 'c3_quality' ? { scores: await c3Scores(db, memberId, pw.window) } : {}),
  };
}

/**
 * EVERY open week, as grids — newest first, and the ones with nothing countable dropped.
 *
 * The Playbook shows all of them. A member several Sessions in is legitimately running more than one (Jay, in
 * Reclaim, had four live and could see one): "hell yes that's ok, that's what Greg wants! If all you have to do is
 * click four boxes a day, or not, that's not too much to ask." Anything that shows a single week hides work the
 * member agreed to do, and hides it silently.
 */
export async function weekGrids(db: Db, memberId: string, today?: string): Promise<WeekGrid[]> {
  try {
    const { activePracticeWeeks } = await import('./store.ts');
    const weeks = await activePracticeWeeks(db, memberId, today);
    const grids = await Promise.all(weeks.map((pw) => gridFor(db, memberId, pw)));
    return grids.filter((g) => g.rows.length > 0);
  } catch (e) {
    console.error(`weekGrids failed for member=${memberId}:`, e);
    return [];
  }
}

export async function weekGrid(db: Db, memberId: string, today?: string): Promise<WeekGrid | null> {
  try {
    const { activePracticeWeek } = await import('./store.ts');
    const pw = await activePracticeWeek(db, memberId, today);
    // Delegates to gridFor rather than repeating the per-kind dispatch, which it used to — and a dispatch written
    // twice is one dispatch and one stale copy waiting to happen.
    return pw ? await gridFor(db, memberId, pw) : null;
  } catch (e) {
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
