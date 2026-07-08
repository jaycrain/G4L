// Momentum logging (Rewire W3 · Step 3, Decision EE/FF/MM). A member logs a "call" — a discrete event, NOT a daily
// form: good_call / false_start / quiet_day, once or several times a day or not at all. Calls feed the Resilience
// Pulse (rolling 14 days, M-1). Self-monitoring, NEVER scored — never feeds Grinta or the ID Score (never-merge).
// Two surfaces, one record (no wrong door, FF): the companion rail (log_call) + the /momentum quick-log. Gated by
// REWIRE at the callers; prod stays v2.

import type { Db } from '../db/schema.ts';
import type { PulseBeat, PulseKind } from '../dashboard/resilience-pulse.ts';

export type CallType = 'good_call' | 'false_start' | 'quiet_day';
export type CallSource = 'rail' | 'momentum_page';
export const MOMENTUM_WINDOW_DAYS = 14; // M-1: rolling 14 days — a pattern without demanding daily density
export const isCallType = (t: unknown): t is CallType => t === 'good_call' || t === 'false_start' || t === 'quiet_day';

// Log a call — a discrete event. Multiple rows per (member, day) are valid; nothing is one-per-day. logged_on
// defaults to today. The ability to log is ALWAYS on (the practice window governs the NUDGE, not the primitive).
export async function logCall(
  db: Db,
  memberId: string,
  c: { type: CallType; note?: string; domain?: string; source: CallSource; loggedOn?: string },
): Promise<{ ok: boolean; type: CallType }> {
  await db.query(
    `insert into momentum_call (member_id, type, logged_on, note, domain, source)
     values ($1, $2, coalesce($3::date, current_date), $4, $5, $6)`,
    [memberId, c.type, c.loggedOn ?? null, c.note?.trim() || null, c.domain ?? null, c.source],
  );
  return { ok: true, type: c.type };
}

// A day's NET shape (M-5: honest, not rosy) — any false start on a day keeps it from rendering as a clean up-beat.
export function netKind(hasFalse: boolean, hasGood: boolean): PulseKind {
  if (hasFalse) return 'false_start';
  if (hasGood) return 'good';
  return 'quiet';
}

// The last N days of calls → ONE net beat per day-with-activity, oldest→newest for the pulse geometry. A day with no
// call yields no beat (absence renders flat — no "you missed" state, Decision EE). Drift-hardened by the caller.
export async function pulseBeats(db: Db, memberId: string, days = MOMENTUM_WINDOW_DAYS): Promise<PulseBeat[]> {
  const rows = (
    await db.query<{ has_false: boolean; has_good: boolean }>(
      `select bool_or(type = 'false_start') as has_false, bool_or(type = 'good_call') as has_good
         from momentum_call
        where member_id = $1 and logged_on >= current_date - ($2::int - 1)
        group by logged_on
        order by logged_on asc`,
      [memberId, days],
    )
  ).rows;
  return rows.map((r) => ({ kind: netKind(r.has_false, r.has_good) }));
}

// Detect an EXPLICIT call in a member message (the backstop for the rail — "couldn't do X is a bug", FF). Conservative:
// only the labels the product teaches fire, so a passing mention never auto-logs. false_start wins a mixed message
// (honesty first). The model's log_call tool handles the fuzzier cases; this catches the ones it misses.
const FALSE_START_RE = /\b(false start|fell off( the wagon)?|blew it( today| again)?|slipped( up)?( again)?|off the wagon)\b/i;
const GOOD_CALL_RE = /\b(good call|won today|showed up today|nailed (it|today)|logged a good one)\b/i;
const QUIET_DAY_RE = /\b(quiet day|quiet one|rest day|nothing to log)\b/i;
export function logCallIntent(message: string): CallType | null {
  const m = (message ?? '').trim();
  if (FALSE_START_RE.test(m)) return 'false_start';
  if (GOOD_CALL_RE.test(m)) return 'good_call';
  if (QUIET_DAY_RE.test(m)) return 'quiet_day';
  return null;
}
