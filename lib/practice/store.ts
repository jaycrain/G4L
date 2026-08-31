// The practice-week scaffold (Decision MM R4) — ONE reusable mechanic: a Companion-prompted daily practice that runs
// for a bounded window after a Rewire session, surfaced on the hero (the rail — no net-new surface). Different
// sessions plug DIFFERENT payloads into the same window: W2 surfaces the saved image; W3's good-call/false-start
// logging (the Momentum slice) plugs in later. The window is DERIVED (started_at + N days) — no per-day state — and
// it is a productive-default NUDGE, never a gate (R1). Flag-gated (REWIRE) at the caller; staged-only on prod.

import type { Db } from '../db/schema.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../rebuild/plan-store.ts';
import { memberZone } from '../time/zone-store.ts';
import { localDate, trackerRun, currentWindow, priorWindow, runIsOver, columnFor,
         type MemberWeek, type TrackerRun } from '../time/member-clock.ts';

// W3 opens the logging window (payload lands with the Momentum slice); b2_noticing is Rebuild B2's skill-noticing
// week; b3_pilot is Rebuild B3's daily health-decision logging; c3_quality is Reclaim C3's Quality-Day logging week.
// reclaim_item is the FIRST kind not opened by a Session — the member starts it from their own Reclaim List
// when an item is a CADENCE ("3 times per week"). Everything else about it is the same mechanic, which is the
// point: the week, the grid, the marks, the close and the keeper all already work per-kind.
export type PracticeKind = 'w2_image' | 'w3_logging' | 'b2_noticing' | 'b3_pilot' | 'c3_quality' | 'reclaim_item';

/**
 * WHAT EACH PRACTICE WEEK IS CALLED — the standard, not a per-surface decision.
 *
 * Jay, 2026-08-29, pointing at the top-left of a grid: "No title." Two things made that possible. The name lived
 * in a map inside the Playbook view, so the grid itself did not know what it was called; and the heading carrying
 * it rendered only when a member had MORE THAN ONE week open, so a member with a single grid saw no name at all.
 * The grid's own header row had an empty cell where the name belongs.
 *
 * `Record<PracticeKind, string>` is doing real work here: it is exhaustive, so adding a sixth kind without a
 * title FAILS TO COMPILE rather than falling through to a generic "This week". That fallback is how `reclaim_item`
 * — which already existed — had no name of its own. ("Make it so for other grids as they get added as the
 * standard.") [[one-fact-many-sites]]
 */
export const PRACTICE_WEEK_TITLE: Record<PracticeKind, string> = {
  w2_image: 'Your picture',
  w3_logging: 'Your triggers this week',
  b2_noticing: 'The skills you’re building',
  b3_pilot: 'Your Lifestyle Pilot',
  c3_quality: 'Your Quality Days',
  reclaim_item: 'Your Reclaim item',
};
export const PRACTICE_WINDOW_DAYS = 7;

export type ActivePractice = {
  kind: PracticeKind;
  startedAt: string;
  /** The member's LOCAL calendar date of startedAt — the day they would say the Session closed. */
  startedOn: string;
  /** The whole run, fixed at close: the partial stub (if any) plus the full Monday–Sunday that carries the review. */
  run: TrackerRun;
  /** The window being ticked today — the stub before the first Monday, the full week after. */
  window: MemberWeek;
  /** The finished stub once it has rolled, so a member's early ticks stay on screen. Null otherwise. */
  prior: MemberWeek | null;
  /** 1..window.days — which column today is. */
  day: number;
};

/**
 * How far back to LOOK for a week that might still be running.
 *
 * A run is at most a six-day stub plus seven days = 13, so 21 is comfortably clear of it. This is a SQL prefilter
 * only — whether a week is actually still open is decided in JS by runIsOver(), because the answer depends on the
 * member's timezone and Postgres has no idea what day it is where they live.
 */
const LOOKBACK_DAYS = 21;

// Open (or restart) a practice window — called when a Rewire session completes. Upsert on (member, kind): re-doing
// the session refreshes started_at (a fresh week). Caller runs it best-effort; it never blocks a conversation turn.
export async function startPracticeWeek(db: Db, memberId: string, kind: PracticeKind): Promise<void> {
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1, $2, now())
     on conflict (member_id, kind) do update set started_at = now()`,
    [memberId, kind],
  );
}

// The member's ACTIVE practice window, if any — the newest run that has not yet passed its Sunday.
// MOST-RECENT started_at WINS when two are active (Decision MM: the latest session's payload leads on the hero).
export async function activePracticeWeek(db: Db, memberId: string, today?: string): Promise<ActivePractice | null> {
  return (await activePracticeWeeks(db, memberId, today))[0] ?? null;
}

/**
 * EVERY practice week still inside its window — newest first.
 *
 * A member can legitimately be running several at once: each Session that closes opens its own (W2 → the picture,
 * W3 → logging, B2 → noticing, B3 → the pilot, C3 → quality days), and they overlap because the Sessions do.
 * activePracticeWeek() returns only the newest, which is right for a single "what are you on" read and WRONG for
 * the Playbook — a member deep in Reclaim had four weeks live and could see one, with three collecting nothing in
 * silence (Jay, 2026-08-11).
 *
 * Jay's call when shown it: "hell yes that's ok, that's what Greg wants! If all you have to do is click four boxes
 * a day, or not, that's not too much to ask. And exactly what we're trying to do to stay engaged with members
 * daily, on their terms." So the surface shows all of them.
 */
/**
 * Build the resolved week from a start date and the member's today. Pure, and the ONE place that decides which
 * window a member is in — so the read path, the tests and anything later that needs to reason about a week all
 * agree by construction rather than by three people remembering the same rule.
 */
export function resolvePractice(kind: PracticeKind, startedOn: string, today: string, startedAt?: string): ActivePractice {
  const run = trackerRun(startedOn);
  const window = currentWindow(run, today);
  return {
    kind,
    startedAt: startedAt ?? `${startedOn}T00:00:00.000Z`,
    startedOn,
    run,
    window,
    prior: priorWindow(run, today),
    // columnFor returns null for a date outside the window; today is inside it by construction for an open run,
    // but a clock skew must degrade to "day 1" rather than NaN.
    day: (columnFor(window, today) ?? 0) + 1,
  };
}

export async function activePracticeWeeks(db: Db, memberId: string, todayOverride?: string): Promise<ActivePractice[]> {
  // The zone is read ONCE for the whole set rather than per week — this runs on the dashboard's hot path.
  const zone = await memberZone(db, memberId);
  // `todayOverride` exists for TESTS, and it earns its keep. A review can now only land on a Sunday, so a test
  // that lets the real clock decide passes six days a week and fails on the seventh — which reads as a flaky
  // suite rather than as a broken product. Nothing in the app passes it.
  const today = todayOverride ?? localDate(zone);
  const { rows } = await db.query<{ kind: string; started_at: string }>(
    // ANCHORED TO `today`, NOT TO now(). This read `now() - interval`, so the override above governed the JS half
    // while the SQL half still asked the real clock — and a prefilter the override cannot reach is not one a test
    // can pin. tests/practice-close.test.ts pins today to a fixed Sunday over a week opened six days earlier; it
    // passed for exactly LOOKBACK_DAYS and began failing at 00:03 UTC on 2026-08-31 as the fixture aged out.
    // Nothing about the product changed — the test simply got old, which is precisely the flaky-suite reading the
    // override was written to prevent, half-applied.
    //
    // It is also the more correct anchor in production. now() is UTC and the window it bounds is the MEMBER's
    // week, so a Boulder member late on a Sunday was prefiltered against tomorrow's UTC date (member-local-time).
    // Anchoring on the end of the member's today keeps the prefilter generous in their zone rather than ours.
    `select kind, started_at
       from practice_week
      where member_id = $1 and started_at > ($3::date + interval '1 day') - ($2 || ' days')::interval
      order by started_at desc`,
    [memberId, String(LOOKBACK_DAYS), today],
  );
  // WHETHER A WEEK IS STILL OPEN IS DECIDED HERE, NOT IN SQL. Postgres does not know what day it is where the
  // member lives, and a run's length now depends on which weekday it started (7 days, or 8–13). The SQL above is
  // only a generous prefilter. Same rule as the jsonb reads: decide in JS, never in a SQL predicate.
  return rows.flatMap((row) => {
    const startedOn = localDate(zone, new Date(row.started_at));
    if (runIsOver(trackerRun(startedOn), today)) return [];
    return [resolvePractice(row.kind as PracticeKind, startedOn, today, row.started_at)];
  });
}

/** One specific open week, by kind — how a tap addresses the grid it was made in. */
export async function practiceWeekOfKind(db: Db, memberId: string, kind: PracticeKind): Promise<ActivePractice | null> {
  return (await activePracticeWeeks(db, memberId)).find((w) => w.kind === kind) ?? null;
}

// The member's most recent saved "image" keeper (W2's Visualization Workshop output) — what the W2 practice surfaces.
export async function latestImageKeeper(db: Db, memberId: string): Promise<string | null> {
  const row = (
    await db.query<{ body: string }>(
      `select body from playbook_entry
        where member_id = $1 and state = 'kept' and keeper_type = 'lights_you_up'
        order by created_at desc limit 1`,
      [memberId],
    )
  ).rows[0];
  return row?.body ?? null;
}

// The member's W2 GOAL — the "hook" of their image (its first line = the named destination, verbatim). The daily
// nudge surfaces this short pull, NOT the full scene (Decision NN): a sharp hook drops them into the picture they
// already built better than reciting it, and stays fresh across the week.
export function imageHook(imageBody: string | null): string | null {
  return (imageBody ?? '').split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? null;
}

// The hero nudge for an active practice window — PURE + testable. Returns null when there's nothing to surface
// (graceful degrade → the hero keeps its normal message). COPY: W2 nudge locked (Decision NN) — plays the member's
// own destination back and echoes W2's close ("the image is real — the lie is a story").
export function practicePrompt(
  kind: PracticeKind,
  payload: { goal?: string | null; plan?: RebuildPilotPayload | null },
): string | null {
  if (kind === 'w2_image') {
    const goal = (payload.goal ?? '').trim();
    if (!goal) return null;
    return `Your five minutes: ${goal}. Close your eyes and stand in it. The picture's real — the lie isn't.`;
  }
  if (kind === 'w3_logging') {
    // W3 · Mindful Monitoring. REWRITTEN 2026-08-08 — this used to be the MOMENTUM ask ("a good call, a false
    // start, or on track?"), which borrowed the ongoing tracker's three call types and quietly made W3 a Momentum
    // week. Greg's week is a different instrument: the member notices what showed up, and which of the triggers
    // THEY named was behind it. The ask now opens that, and the Companion records it with record_w3_day.
    // Deliberately asks for BOTH halves in one line, evenly weighted — a false start is data, not failure, and
    // leading with either one first would tilt the answer.
    return `What showed up today — a good call, a false start, or both? And if something set it off, which one was it?`;
  }
  if (kind === 'b2_noticing') {
    // Rebuild B2 Part B — a week of NOTICING which self-management skills helped or hindered (not changing behavior).
    // Productive-default, never a gate (MM/R1); observational, non-judgmental.
    return `Notice today: which of your skills showed up — and where did one you're still building get in the way?`;
  }
  if (kind === 'b3_pilot') {
    // Rebuild B3 Part B — the daily health-decision log, PLAN-AWARE: the nudge names their two committed changes.
    // Degrades to a generic ask if the plan isn't loaded. Productive-default, non-judgmental (MM/R1, HH).
    const plan = payload.plan;
    if (plan?.activityChange && plan?.dietChange) {
      return `How'd the pilot go today — ${plan.activityChange.toLowerCase()}, and ${plan.dietChange.toLowerCase()}? A good call, a false start, or on track?`;
    }
    return `How'd your two changes go today — a good call, a false start, or on track?`;
  }
  if (kind === 'c3_quality') {
    // Reclaim C3 — the daily Quality-Day check-in. Observational, non-judgmental (MM/R1); the point is noticing what
    // made a day feel like a quality day, not scoring compliance.
    return `How much did today feel like a quality day — and what made it that way (or what was missing)?`;
  }
  return null;
}

// The full hero message for an active practice window, or null (no window / nothing to surface / a read hiccup).
// One call the dashboard makes behind the REWIRE flag; drift-hardened so a missing 0048 degrades, never crashes.
export async function practiceHeroMessage(db: Db, memberId: string): Promise<string | null> {
  try {
    const pw = await activePracticeWeek(db, memberId);
    if (!pw) return null;
    const goal = pw.kind === 'w2_image' ? imageHook(await latestImageKeeper(db, memberId)) : null;
    const plan = pw.kind === 'b3_pilot' ? (await activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild'))?.payload ?? null : null;
    return practicePrompt(pw.kind, { goal, plan });
  } catch {
    return null; // table not applied yet / read hiccup → no practice nudge, dashboard renders normally
  }
}

// W-25 — the COMPACT "this week" line for the Momentum panel + subpage. The practice week no longer OWNS the hero
// (Decision MM R4 revised): the hero returns to greeting + next step, and the active practice surfaces here, on
// Momentum — its natural home (the logging lives there). Short by design: "This week: [the plan] — logging as you
// go." Drift-hardened exactly like practiceHeroMessage, so a missing table degrades to null (no strip), never crashes.
export async function practicePanelLine(db: Db, memberId: string): Promise<string | null> {
  try {
    const pw = await activePracticeWeek(db, memberId);
    if (!pw) return null;
    if (pw.kind === 'w2_image') return 'This week: step into your picture — five minutes a day.';
    // W3 NAMES THE PRACTICE, not the paperwork (Donna, 2026-08-21: neither the copy nor the tracked categories
    // "give the member a clear, logical next step — it's unclear what she's supposed to actually be doing day to
    // day"). "Log your calls as they come" describes the act of logging. Her replacement describes the WORK: the
    // rows are her three protocol moves now, and this says to use them and note it when she does.
    if (pw.kind === 'w3_logging') {
      return 'This week: practice your False Start protocols — note each time you put one into practice.';
    }
    if (pw.kind === 'b2_noticing') return 'This week: notice which skills carry you — and where a gap trips you.';
    if (pw.kind === 'b3_pilot') {
      const plan = (await activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild'))?.payload ?? null;
      if (plan?.activityChange && plan?.dietChange) {
        return `This week: ${plan.activityChange.toLowerCase()} · ${plan.dietChange.toLowerCase()} — logging as you go.`;
      }
      return 'This week: your two changes — logging as you go.';
    }
    if (pw.kind === 'c3_quality') return 'This week: living your Quality Days — logging as you go.';
    return null;
  } catch {
    return null;
  }
}
