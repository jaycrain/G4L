// THE REACTIVE LAYER — who is away, whether to reach, and when to stop and hand them to Jay.
//
// Jay, 2026-08-02: "If they don't check in after a week, 10-days, a month. Something." Then, on what happens
// when reaching doesn't work: "Handing it to me is perfect… I'm the last resort."
//
// PURE AND CONFIG-DRIVEN, for two different reasons.
//   Config, because the NUMBERS ARE GREG'S (architecture principle 2 — gating and dosing are configuration,
//   not code). The ladder below is a placeholder shaped like Jay's sentence; Greg moves it without touching
//   this file, without re-engineering, and without me.
//   Pure, because every interesting case here is a boundary — the day someone becomes due, the attempt that
//   exhausts the ladder — and boundaries belong in tests rather than in a live cron at 6am.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO: send anything, or decide a message. It answers one question about
// one member and returns a verdict the caller acts on. That separation is what lets the whole decision be
// tested without a database, a clock, or a phone.

import type { AwayRow } from './episodes.ts';
import { isReach } from './episodes.ts';

const DAY = 86_400_000;

/**
 * GREG'S DIAL. Days of silence before each successive reach.
 *
 * The LENGTH of this array is also the answer to "how many times before we stop": three rungs, three
 * attempts, then the Companion goes quiet and Jay decides. Adding a rung adds an attempt — which is the
 * right coupling, because "try more times" and "try for longer" should not be two separate knobs that can
 * disagree with each other.
 */
export const RE_ENGAGE_LADDER_DAYS = [7, 10, 30] as const;

/** How long after the LAST rung we keep waiting before handing to Jay. Someone who came back on day 31
 *  should not be escalated on day 31; the ladder has to finish before a human is asked to spend attention. */
export const ESCALATE_AFTER_LAST_RUNG_DAYS = 14;

export type AbsenceInput = {
  /** Their most recent sign of life. Null = never active; see the guard in assessAbsence. */
  lastActiveAt: string | null;
  /** Every outreach row we have for them; this filters to real reaches in the CURRENT stretch itself. */
  reaches: AwayRow[];
  now?: number;
};

export type AbsenceVerdict =
  /** Active recently enough that nothing is owed. */
  | { state: 'present'; daysAway: number }
  /** Away, and the next rung of the ladder has come due. `step` is 1-based for reading in a log. */
  | { state: 'due'; daysAway: number; step: number; attempts: number }
  /** Away, but between rungs — the previous reach was recent enough that another one would be nagging. */
  | { state: 'waiting'; daysAway: number; attempts: number; nextRungInDays: number }
  /** The ladder is spent. The Companion stops HERE and does not reach again; Jay decides what happens next. */
  | { state: 'escalate'; daysAway: number; attempts: number }
  /** They have never been active at all. Not an absence — a member who never arrived. */
  | { state: 'never_started' };

/**
 * One member, one verdict.
 *
 * ATTEMPTS ARE COUNTED WITHIN THIS STRETCH ONLY — reaches made after their last sign of life. Counting every
 * reach we have ever made would mean a member who went quiet, came back, and drifted again a year later
 * arrives already out of attempts, and would be handed straight to Jay without the Companion ever speaking.
 * Each absence gets the whole ladder.
 */
export function assessAbsence(i: AbsenceInput): AbsenceVerdict {
  const now = i.now ?? Date.now();
  if (!i.lastActiveAt) return { state: 'never_started' };

  const lastActive = new Date(i.lastActiveAt).getTime();
  const daysAway = Math.floor((now - lastActive) / DAY);
  const attempts = i.reaches.filter((r) => isReach(r) && new Date(r.createdAt).getTime() > lastActive).length;

  const ladder = RE_ENGAGE_LADDER_DAYS;
  const lastRung = ladder[ladder.length - 1]!;

  if (daysAway < ladder[0]!) return { state: 'present', daysAway };

  // Ladder spent. STOP — do not reach again, and do not escalate the instant the last rung fires either.
  if (attempts >= ladder.length) {
    return daysAway >= lastRung + ESCALATE_AFTER_LAST_RUNG_DAYS
      ? { state: 'escalate', daysAway, attempts }
      : { state: 'waiting', daysAway, attempts, nextRungInDays: lastRung + ESCALATE_AFTER_LAST_RUNG_DAYS - daysAway };
  }

  const rung = ladder[attempts]!; // attempts=0 → first rung, and so on
  if (daysAway >= rung) return { state: 'due', daysAway, step: attempts + 1, attempts };
  return { state: 'waiting', daysAway, attempts, nextRungInDays: rung - daysAway };
}

/**
 * Whether a verdict means "send something now".
 *
 * Its own tiny function on purpose: callers should never re-derive this by string-matching a state, because
 * the day someone adds a state is the day a re-derived check silently starts sending on it.
 */
export const shouldReach = (v: AbsenceVerdict): boolean => v.state === 'due';

/** Whether this member belongs in Jay's queue. Same reasoning as shouldReach. */
export const shouldHandToJay = (v: AbsenceVerdict): boolean => v.state === 'escalate';
