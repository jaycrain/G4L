// A MEMBER'S WEEK, AS A REPORT — one read model, rendered twice.
//
// WHY THIS EXISTS (Jay, 2026-08-15, relaying a charter member): "they wanted a report on how everything they
// entered in the Playbook was going. And a week to week comparison over time." And his framing of the audience,
// which is the load-bearing part:
//
//   "what members want is on a continuum. Some will just want to silently check boxes, answer assessments, and
//    chat with their Companion, and not want any data back. But we're naive to think that the other end of the
//    spectrum is a member who wants ALL the data back."
//
// So this is built ONCE and rendered twice: the Founder Console reads it now, and a member-facing "see my
// reports" reads the SAME function later. That is the whole architectural point — the member surface must be a
// RENDER, not a rebuild, or the two drift and the member gets a second-class version of their own life.
//
// EVERY MEMBER, ALWAYS (Jay's call): "I need to know from the start, and if they eventually change their mind
// and want to see it, we have it. I expect that to happen." Nothing here is gated on a member opting in,
// because the data has to exist BEFORE they ask or the answer is "we didn't keep it."
//
// ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────────────────────────────────────
// It does not judge. No adherence percentage presented as a grade, no streaks, no "you missed 3 days." The
// numbers are counts and the caller decides the framing — the same posture as the week grid, where a blank day
// is a day and not a reproach. A report that scores someone is a report they stop opening.
//
// It does not summarise in prose. Everything here is COMPUTED. A model that can phrase a week can invent one,
// and this is the surface where Jay decides whether to reach out to a real person.
//
// ── WHERE THE DATA COMES FROM ─────────────────────────────────────────────────────────────────────────────
// Almost all of it already existed and was simply never assembled:
//   practice_mark            one row per cell per day        → adherence, per commitment
//   quality_day_log          one row per day                  → the 1–10 series
//   member_event             append-only                      → sessions closed, Moves re-run
//   member_profile_audit     since 0079 for playbook_entry    → Moves kept / dropped / reworded THIS week
//   *_reading tables         dated snapshots                  → assessments taken in the window
//
// The audit trail is the newest and the one that was bleeding: before 0079, a Move kept then dropped left only
// "dismissed" and a timestamp. Weeks before that migration ran will show no Move transitions — not because
// nothing happened, but because it was overwritten. Callers must not present that absence as "a quiet week";
// see `historyFrom`.

import type { Db } from '../db/schema.ts';
import { addDays, weekStart, weekEnd, type MemberWeek as Window } from '../time/member-clock.ts';

/** The first date for which playbook-entry transitions are knowable — when 0079's trigger went live on prod. */
export const PLAYBOOK_HISTORY_FROM = '2026-08-15';

export type CommitmentReport = {
  kind: string;
  slot: string;
  label: string;
  /** The member's own number ("5 days"), or null when the practice is noticing rather than hitting a count. */
  target: number | null;
  /** One entry per day of the window, in order. */
  days: boolean[];
  hit: number;
};

export type QualityDayPoint = { on: string; score: number; elements: number };

export type MoveChange = {
  /** 'kept' | 'dropped' | 'reworded' | 'added' | 'pinned' — what the member did, not what the row now says. */
  change: string;
  /** Their words at the time. For a rewording, the text they moved AWAY from. */
  text: string | null;
  at: string;
};

export type MemberWeekReport = {
  window: Window;
  /** Practice weeks running in this window, with the days actually marked. */
  commitments: CommitmentReport[];
  qualityDays: { points: QualityDayPoint[]; logged: number; average: number | null };
  moves: { kept: number; changes: MoveChange[]; reruns: number; historyComplete: boolean };
  /**
   * Sessions closed in the window, DEDUPED WITH A COUNT.
   *
   * Re-running a Session is a real thing a member does, so the events legitimately repeat — but rendering
   * "RCL-C3, RCL-C3, RCL-C3, …" eight times reads as noise and buries the one that only happened once. Caught
   * by looking at the thing rendered with real data rather than at the array.
   */
  sessionsClosed: { ref: string; times: number }[];
  /** Assessments taken IN the window — the thing that makes a month-over-month read possible. */
  readings: { kind: string; at: string }[];
};

/**
 * The last `count` Mon–Sun weeks, newest first, ending with the week `today` falls in.
 *
 * Calendar weeks rather than each tracker's own run: the report compares a member against THEMSELVES over time,
 * and two commitments started on different days would otherwise be measured against windows that do not line
 * up. The week grid still draws each run's own window — that is a different question ("how is this practice
 * going") from this one ("how was my week").
 */
export function recentWeeks(today: string, count: number): Window[] {
  const out: Window[] = [];
  for (let i = 0; i < count; i++) {
    const start = weekStart(addDays(today, -7 * i));
    out.push({ start, end: weekEnd(start), days: 7, partial: false } as unknown as Window);
  }
  return out;
}

/** Inclusive day list for a window — the spine every series is aligned to. */
function daysOf(w: Window): string[] {
  return Array.from({ length: w.days }, (_, i) => addDays(w.start, i));
}

/**
 * Is the playbook history trustworthy for this window?
 *
 * A window that ends before 0079 ran has NO Move transitions, and that is an artefact of us, not of the member.
 * Rendering it as "no changes" would be a confident lie of exactly the kind that has cost us twice this week —
 * so the flag rides with the data and the UI has to say "not recorded yet" rather than "nothing happened".
 */
function historyFrom(w: Window): boolean {
  return addDays(w.start, w.days - 1) >= PLAYBOOK_HISTORY_FROM;
}

export async function memberWeekReport(db: Db, memberId: string, window: Window): Promise<MemberWeekReport> {
  const days = daysOf(window);
  const last = days[days.length - 1]!;

  // ── PRACTICE ───────────────────────────────────────────────────────────────────────────────────────────
  // Commitments joined to their marks. A commitment with no marks still appears: "you committed and it did not
  // happen" is a fact worth seeing, and dropping the row would quietly flatter the week.
  const { rows: commitRows } = await db.query<{ id: string; kind: string; slot: string; label: string; target_days: number | null }>(
    // ONLY COMMITMENTS THAT EXISTED IN THIS WINDOW. Without the date bound, a week in July listed commitments
    // made in August at "0 of 5" — which reads as "they committed and did nothing" about a week before they
    // had committed to anything. Found by looking at four real weeks rendered, not by reading the query.
    `select pc.id, pw.kind, pc.slot, pc.label, pc.target_days
       from practice_commitment pc
       join practice_week pw on pw.member_id = pc.member_id and pw.kind = pc.kind
      where pc.member_id = $1 and pc.created_at < ($2::date + 1)
      order by pw.kind, pc.sort_order, pc.slot`,
    [memberId, last],
  );
  // A mark points at its COMMITMENT (commitment_id), not at a slot string — a slot is only unique within a
  // kind, and the id is what survives a re-run mapping onto the same row. Joining on slot silently mixed
  // kinds; the test that caught it is the one asserting marks land on the right days.
  const { rows: markRows } = await db.query<{ commitment_id: string | null; marked_on: string }>(
    `select commitment_id, marked_on::text as marked_on from practice_mark
      where member_id = $1 and marked_on >= $2::date and marked_on <= $3::date`,
    [memberId, window.start, last],
  );
  const marked = new Set(markRows.filter((m) => m.commitment_id).map((m) => `${m.commitment_id}|${m.marked_on}`));
  const commitments: CommitmentReport[] = commitRows.map((c) => {
    const d = days.map((day) => marked.has(`${c.id}|${day}`));
    return {
      kind: c.kind,
      slot: c.slot,
      label: c.label,
      target: c.target_days ?? null,
      days: d,
      hit: d.filter(Boolean).length,
    };
  });

  // ── QUALITY DAYS ───────────────────────────────────────────────────────────────────────────────────────
  const { rows: qdRows } = await db.query<{ logged_on: string; score: number; present: unknown }>(
    `select logged_on::text as logged_on, score, present from quality_day_log
      where member_id = $1 and logged_on >= $2::date and logged_on <= $3::date
      order by logged_on`,
    [memberId, window.start, last],
  );
  const points: QualityDayPoint[] = qdRows.map((r) => {
    // present is jsonb; prod has stored it double-encoded before now, so never trust the shape (lib/db/jsonb.ts).
    const p = Array.isArray(r.present) ? r.present : typeof r.present === 'string' ? safeArray(r.present) : [];
    return { on: String(r.logged_on), score: Number(r.score), elements: p.length };
  });
  const average = points.length
    ? Math.round((points.reduce((s, p) => s + p.score, 0) / points.length) * 10) / 10
    : null;

  // ── MOVES ──────────────────────────────────────────────────────────────────────────────────────────────
  const { rows: keptRows } = await db.query<{ n: number }>(
    "select count(*)::int n from playbook_entry where member_id=$1 and state='kept'",
    [memberId],
  );
  const { rows: auditRows } = await db.query<{ field: string; old_value: unknown; new_value: unknown; occurred_at: string }>(
    `select field, old_value, new_value, occurred_at::text as occurred_at
       from member_profile_audit
      where member_id=$1 and source='playbook_entry'
        and occurred_at >= $2::date and occurred_at < ($3::date + 1)
      order by occurred_at`,
    [memberId, window.start, last],
  );
  const changes: MoveChange[] = [];
  for (const a of auditRows) {
    const oldV = unwrap(a.old_value);
    const newV = unwrap(a.new_value);
    if (a.field === '_created') changes.push({ change: 'added', text: textOf(newV), at: a.occurred_at });
    else if (a.field === 'state' && newV === 'kept') changes.push({ change: 'kept', text: null, at: a.occurred_at });
    else if (a.field === 'state' && newV === 'dismissed') changes.push({ change: 'dropped', text: null, at: a.occurred_at });
    // A rewording carries the words they moved AWAY from — those are theirs, and the new text is on the row.
    else if (a.field === 'body') changes.push({ change: 'reworded', text: String(oldV ?? ''), at: a.occurred_at });
    else if (a.field === 'pinned' && newV === true) changes.push({ change: 'pinned', text: null, at: a.occurred_at });
  }
  const { rows: rerunRows } = await db.query<{ n: number }>(
    `select count(*)::int n from member_event
      where member_id=$1 and kind='play_rerun' and created_at >= $2::date and created_at < ($3::date + 1)`,
    [memberId, window.start, last],
  );

  // ── SESSIONS + ASSESSMENTS ─────────────────────────────────────────────────────────────────────────────
  const { rows: sessRows } = await db.query<{ ref: string | null }>(
    `select ref from member_event
      where member_id=$1 and kind='session_close' and created_at >= $2::date and created_at < ($3::date + 1)
      order by created_at`,
    [memberId, window.start, last],
  );

  const readings: { kind: string; at: string }[] = [];
  for (const [table, kind] of [
    ['measure_reading', 'ID Score'],
    ['grinta_reading', 'Grinta'],
    ['motivation_reading', 'Motivation'],
    ['self_management_reading', 'Self-management'],
    ['bigger_world_reading', 'Bigger World'],
  ] as const) {
    // Each reading table is a dated snapshot; a missing table (drift) must not take the whole report down.
    const r = await db
      .query<{ at: string }>(
        `select created_at::text as at from ${table}
          where member_id=$1 and created_at >= $2::date and created_at < ($3::date + 1) order by created_at`,
        [memberId, window.start, last],
      )
      .catch(() => ({ rows: [] as { at: string }[] }));
    for (const row of r.rows) readings.push({ kind, at: row.at });
  }

  return {
    window,
    commitments,
    qualityDays: { points, logged: points.length, average },
    moves: {
      kept: keptRows[0]?.n ?? 0,
      changes,
      reruns: rerunRows[0]?.n ?? 0,
      historyComplete: historyFrom(window),
    },
    sessionsClosed: countRefs(sessRows.map((s) => s.ref).filter((r): r is string => !!r)),
    readings,
  };
}

/** First-seen order preserved — the sequence a member moved through is part of the story. */
function countRefs(refs: string[]): { ref: string; times: number }[] {
  const seen = new Map<string, number>();
  for (const r of refs) seen.set(r, (seen.get(r) ?? 0) + 1);
  return [...seen.entries()].map(([ref, times]) => ({ ref, times }));
}

function safeArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** jsonb comes back as a value OR as a JSON string when it was stored double-encoded. Never assume. */
function unwrap(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function textOf(v: unknown): string | null {
  if (v && typeof v === 'object' && 'body' in (v as Record<string, unknown>)) {
    const b = (v as Record<string, unknown>).body;
    return typeof b === 'string' ? b : null;
  }
  return null;
}
