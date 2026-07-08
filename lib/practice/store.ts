// The practice-week scaffold (Decision MM R4) — ONE reusable mechanic: a Companion-prompted daily practice that runs
// for a bounded window after a Rewire session, surfaced on the hero (the rail — no net-new surface). Different
// sessions plug DIFFERENT payloads into the same window: W2 surfaces the saved image; W3's good-call/false-start
// logging (the Momentum slice) plugs in later. The window is DERIVED (started_at + N days) — no per-day state — and
// it is a productive-default NUDGE, never a gate (R1). Flag-gated (REWIRE) at the caller; staged-only on prod.

import type { Db } from '../db/schema.ts';

export type PracticeKind = 'w2_image'; // 'w3_logging' joins with the Momentum slice
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

// The hero nudge for an active practice window — PURE + testable. W2 surfaces the saved image (mostly the member's
// own words). Returns null when there's nothing to surface (graceful degrade → the hero keeps its normal message).
// MICROCOPY is placeholder — the daily-nudge voice is the wordsmith's lane; shaped in the felt-walk.
export function practicePrompt(kind: PracticeKind, payload: { image?: string | null }): string | null {
  if (kind === 'w2_image') {
    const img = (payload.image ?? '').trim();
    if (!img) return null;
    return `Five minutes with your picture today — close your eyes and step into it:\n\n“${img}”`;
  }
  return null;
}

// The full hero message for an active practice window, or null (no window / nothing to surface / a read hiccup).
// One call the dashboard makes behind the REWIRE flag; drift-hardened so a missing 0048 degrades, never crashes.
export async function practiceHeroMessage(db: Db, memberId: string): Promise<string | null> {
  try {
    const pw = await activePracticeWeek(db, memberId);
    if (!pw) return null;
    const image = pw.kind === 'w2_image' ? await latestImageKeeper(db, memberId) : null;
    return practicePrompt(pw.kind, { image });
  } catch {
    return null; // table not applied yet / read hiccup → no practice nudge, dashboard renders normally
  }
}
