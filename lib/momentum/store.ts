// Momentum logging (Rewire W3 · Step 3, Decision EE/FF/MM). A member logs a "call" — a discrete event, NOT a daily
// form: good_call / false_start / quiet_day, once or several times a day or not at all. Calls feed the Resilience
// Pulse (rolling 14 days, M-1). Self-monitoring, NEVER scored — never feeds Grinta or the ID Score (never-merge).
// Two surfaces, one record (no wrong door, FF): the companion rail (log_call) + the /momentum quick-log. Gated by
// REWIRE at the callers; prod stays v2.

import type { Db } from '../db/schema.ts';
import type { PulseBeat, PulseKind } from '../dashboard/resilience-pulse.ts';

export type CallType = 'good_call' | 'false_start' | 'quiet_day';
export type CallSource = 'rail' | 'momentum_page';
// The behavior domain a call is about (Decision OO — goes live in Rebuild B3's Lifestyle Pilot: one activity change +
// one diet change). Optional: a call may be untagged (a general call, or logging outside the pilot). Matches the
// SkillDomain vocabulary + the coaching_plan payload keys (activityChange/dietChange).
export type CallDomain = 'activity' | 'diet';
export const MOMENTUM_WINDOW_DAYS = 14; // M-1: rolling 14 days — a pattern without demanding daily density
export const isCallType = (t: unknown): t is CallType => t === 'good_call' || t === 'false_start' || t === 'quiet_day';
export const isCallDomain = (d: unknown): d is CallDomain => d === 'activity' || d === 'diet';

// Log a call — a discrete event. Multiple rows per (member, day) are valid; nothing is one-per-day. logged_on
// defaults to today. The ability to log is ALWAYS on (the practice window governs the NUDGE, not the primitive).
export async function logCall(
  db: Db,
  memberId: string,
  c: { type: CallType; note?: string; domain?: CallDomain; source: CallSource; loggedOn?: string },
): Promise<{ ok: boolean; type: CallType }> {
  await db.query(
    `insert into momentum_call (member_id, type, logged_on, note, domain, source)
     values ($1, $2, coalesce($3::date, current_date), $4, $5, $6)`,
    [memberId, c.type, c.loggedOn ?? null, c.note?.trim() || null, c.domain ?? null, c.source],
  );
  return { ok: true, type: c.type };
}

// The member's own log — recent calls, newest first, for the Momentum history ("where does this get saved?", Jay).
// Each row is exactly what they logged: the call, its note, any domain tag, and the day. Self-monitoring, never scored.
export type CallLogEntry = { type: CallType; note: string | null; domain: CallDomain | null; loggedOn: string; at: string };
export async function recentCalls(db: Db, memberId: string, limit = 30): Promise<CallLogEntry[]> {
  const { rows } = await db.query<{ type: string; note: string | null; domain: string | null; logged_on: string; created_at: string }>(
    `select type, note, domain, logged_on::text as logged_on, created_at::text as created_at
       from momentum_call
      where member_id = $1
      order by logged_on desc, created_at desc
      limit $2`,
    [memberId, limit],
  );
  return rows.map((r) => ({ type: r.type as CallType, note: r.note, domain: (r.domain as CallDomain | null), loggedOn: r.logged_on, at: r.created_at }));
}

// One momentum call → one pulse beat kind. good = up-beat, false start = dip, quiet = flat.
const callKind = (t: CallType): PulseKind => (t === 'false_start' ? 'false_start' : t === 'quiet_day' ? 'quiet' : 'good');

// CALL-BY-CALL (Jay + Greg, Jul 2026): the pulse plots EVERY call in the window, not a daily net — "the hundreds of
// decisions that shape you", each its own beat, oldest→newest. This supersedes the old per-day netting (M-5): a good
// call, then a false start, then a good call now reads up · dip · up (the bounce is visible), not one net dip.
// Rolling window (last N days); still never accumulates into a score. Drift-hardened by the caller.
export async function pulseBeats(db: Db, memberId: string, days = MOMENTUM_WINDOW_DAYS): Promise<PulseBeat[]> {
  const rows = (
    await db.query<{ type: CallType }>(
      `select type
         from momentum_call
        where member_id = $1 and logged_on >= current_date - ($2::int - 1)
        order by logged_on asc, created_at asc`,
      [memberId, days],
    )
  ).rows;
  return rows.map((r) => ({ kind: callKind(r.type) }));
}

// Per-domain call tallies over the window (Decision OO) — how the two pilot changes are actually going, for the
// COMPANION to reflect (evidence-based, non-judgmental). Only tagged calls count toward a domain; quiet days and
// untagged calls are ignored here. Returns good/false counts per domain. Drift-hardened by the caller.
export type DomainTally = { activity: { good: number; false: number }; diet: { good: number; false: number } };
export async function domainTally(db: Db, memberId: string, days = MOMENTUM_WINDOW_DAYS): Promise<DomainTally> {
  const rows = (
    await db.query<{ domain: string; type: string; n: number }>(
      `select domain, type, count(*)::int as n
         from momentum_call
        where member_id = $1 and logged_on >= current_date - ($2::int - 1)
          and domain in ('activity', 'diet') and type in ('good_call', 'false_start')
        group by domain, type`,
      [memberId, days],
    )
  ).rows;
  const t: DomainTally = { activity: { good: 0, false: 0 }, diet: { good: 0, false: 0 } };
  for (const r of rows) {
    const d = r.domain as CallDomain;
    if (r.type === 'good_call') t[d].good = r.n;
    else if (r.type === 'false_start') t[d].false = r.n;
  }
  return t;
}

// Detect an EXPLICIT call in a member message (the backstop for the rail — "couldn't do X is a bug", FF). Conservative:
// only the labels the product teaches fire, so a passing mention never auto-logs. false_start wins a mixed message
// (honesty first). The model's log_call tool handles the fuzzier cases; this catches the ones it misses.
const FALSE_START_RE = /\b(false start|fell off( the wagon)?|blew it( today| again)?|slipped( up)?( again)?|off the wagon)\b/i;
const GOOD_CALL_RE = /\b(good call|won today|showed up today|nailed (it|today)|logged a good one)\b/i;
// Accepts BOTH vocabularies on purpose. The label is "On Track" now, but members who learned "quiet day" — and
// anyone who just says "rest day" — must still be understood. A rename should never make the parser deafer.
const QUIET_DAY_RE = /\b(on track|quiet day|quiet one|rest day|steady day|nothing to log)\b/i;
export function logCallIntent(message: string): CallType | null {
  const m = (message ?? '').trim();
  if (FALSE_START_RE.test(m)) return 'false_start';
  if (GOOD_CALL_RE.test(m)) return 'good_call';
  if (QUIET_DAY_RE.test(m)) return 'quiet_day';
  return null;
}

/** One day's calls, dated — the raw material for the long view. Oldest first. */
export type DayCount = { day: string; good: number; missed: number; quiet: number };

/**
 * Dated per-day counts over a window. `pulseBeats` deliberately drops the dates because the 14-day pulse is a
 * texture, not a chart — but the long view needs to know WHEN, so it can bucket by week or month without
 * pretending a year of beats fits on one strip.
 *
 * Days with no calls are absent rather than zero-filled: a day the member did not log is not a day they failed,
 * and the bucketing decides how to treat a gap. Drift-hardened by the caller.
 */
export async function callsByDay(db: Db, memberId: string, days: number): Promise<DayCount[]> {
  const { rows } = await db.query<{ day: string; type: CallType; n: number }>(
    `select logged_on::text as day, type, count(*)::int as n
       from momentum_call
      where member_id = $1 and logged_on >= current_date - ($2::int - 1)
      group by logged_on, type
      order by logged_on asc`,
    [memberId, Math.max(1, Math.floor(days))],
  );
  const byDay = new Map<string, DayCount>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { day: r.day, good: 0, missed: 0, quiet: 0 };
    if (r.type === 'good_call') d.good += r.n;
    else if (r.type === 'false_start') d.missed += r.n;
    else d.quiet += r.n;
    byDay.set(r.day, d);
  }
  return [...byDay.values()];
}
