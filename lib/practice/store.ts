// The practice-week scaffold (Decision MM R4) — ONE reusable mechanic: a Companion-prompted daily practice that runs
// for a bounded window after a Rewire session, surfaced on the hero (the rail — no net-new surface). Different
// sessions plug DIFFERENT payloads into the same window: W2 surfaces the saved image; W3's good-call/false-start
// logging (the Momentum slice) plugs in later. The window is DERIVED (started_at + N days) — no per-day state — and
// it is a productive-default NUDGE, never a gate (R1). Flag-gated (REWIRE) at the caller; staged-only on prod.

import type { Db } from '../db/schema.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../rebuild/plan-store.ts';

// W3 opens the logging window (payload lands with the Momentum slice); b2_noticing is Rebuild B2's skill-noticing
// week; b3_pilot is Rebuild B3's daily health-decision logging; c3_quality is Reclaim C3's Quality-Day logging week.
export type PracticeKind = 'w2_image' | 'w3_logging' | 'b2_noticing' | 'b3_pilot' | 'c3_quality';
export const PRACTICE_WINDOW_DAYS = 7;

export type ActivePractice = { kind: PracticeKind; startedAt: string; day: number }; // day = 1..PRACTICE_WINDOW_DAYS

// Open (or restart) a practice window — called when a Rewire session completes. Upsert on (member, kind): re-doing
// the session refreshes started_at (a fresh week). Caller runs it best-effort; it never blocks a conversation turn.
export async function startPracticeWeek(db: Db, memberId: string, kind: PracticeKind): Promise<void> {
  await db.query(
    `insert into practice_week (member_id, kind, started_at) values ($1, $2, now())
     on conflict (member_id, kind) do update set started_at = now()`,
    [memberId, kind],
  );
}

// The member's ACTIVE practice window, if any — the one whose window (started_at + N days) still contains today.
// MOST-RECENT started_at WINS when two are active (Decision MM: the latest session's payload leads on the hero).
export async function activePracticeWeek(db: Db, memberId: string): Promise<ActivePractice | null> {
  const row = (
    await db.query<{ kind: string; started_at: string; day: number }>(
      `select kind, started_at, (date_part('day', now() - started_at))::int + 1 as day
         from practice_week
        where member_id = $1 and started_at > now() - ($2 || ' days')::interval
        order by started_at desc
        limit 1`,
      [memberId, String(PRACTICE_WINDOW_DAYS)],
    )
  ).rows[0];
  if (!row) return null;
  const day = Math.min(Math.max(row.day, 1), PRACTICE_WINDOW_DAYS);
  return { kind: row.kind as PracticeKind, startedAt: row.started_at, day };
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
    if (pw.kind === 'w3_logging') return 'This week: log your calls as they come.';
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
