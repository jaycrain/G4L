// The hero's subhead — the last thing the member actually finished, named.
//
// Jay (2026-08-08): the centre column reads Program breadcrumb → next session → "what you just did" → CTA. This
// resolves the third line. It exists because a hero that only ever points FORWARD makes a member who has been
// working feel like the program has no memory of it. One sentence of "you did this" before "here's the next
// thing" is the difference.
//
// TWO SOURCES, most recent wins:
//   1. A practice week that has been CLOSED — the richest signal, because it carries their own numbers.
//   2. The most recently closed Session — always available once they're moving.
//
// The week line is NOT re-derived here. buildReview() already authors it ("— 4 of the 5 you aimed for") and its
// wording is deliberate: no "only", no softener, no silver lining bolted on. Re-writing that sentence here would
// let the hero drift from the review the member read at close, which is exactly the class of copy defect the
// summaries sweep kept turning up. One definition, quoted in two places.

import type { Db } from '../db/schema.ts';
import { weekGrid } from '../practice/grid.ts';
import { buildReview } from '../practice/close.ts';
import { getForecast } from '../curriculum/view.ts';

export type Accomplishment = {
  /** The full sentence, ready to render. */
  text: string;
  /** What produced it — for telemetry and tests, never shown. */
  source: 'practice_week' | 'session';
};

/** "on Friday" / "yesterday" / "today" — a human anchor, not a date stamp. Null when it's older than a week,
 *  where naming the day stops helping and starts reading like a reprimand about the gap. */
function whenLabel(closedAt: Date, now: Date): string | null {
  const days = Math.floor((now.getTime() - closedAt.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `on ${closedAt.toLocaleDateString('en-US', { weekday: 'long' })}`;
  return null;
}

/** The last thing they finished, or null when there isn't one yet (a brand-new member — the hero simply omits
 *  the line rather than inventing an achievement, which is the failure mode worth avoiding here). */
export async function lastAccomplishment(db: Db, memberId: string, now = new Date()): Promise<Accomplishment | null> {
  // ── 1. a closed practice week ────────────────────────────────────────────────────────────────────────────
  // weekGrid is window-scoped (7 days) and already includes closed weeks, so a week closed in the last few days
  // still yields a full grid. Older than that and it correctly stops being "the last thing you did".
  try {
    const grid = await weekGrid(db, memberId);
    if (grid?.closed && grid.rows.length > 0) {
      const review = buildReview(grid);
      const line = review.lines[0];
      if (line) return { text: `You closed your practice week — ${lowerFirstClause(line)}`, source: 'practice_week' };
    }
  } catch (e) {
    // Degrade to the session line rather than taking the hero down. LOUD, because a silent failure here renders
    // as "this member has never finished anything", which is a confident lie about a member who has.
    console.error(`lastAccomplishment: practice-week read failed for member=${memberId}:`, e);
  }

  // ── 2. the most recently closed Session ──────────────────────────────────────────────────────────────────
  try {
    const { rows } = await db.query<{ session_id: string; closed_at: string }>(
      `select session_id, closed_at::text as closed_at
         from session_progress
        where member_id = $1 and status = 'closed' and closed_at is not null
        order by closed_at desc
        limit 1`,
      [memberId],
    );
    const row = rows[0];
    if (!row) return null;

    // Title from the forecast so it reads exactly as it does everywhere else the member sees that Session named.
    const forecast = await getForecast(db, memberId);
    const title = forecast.phases.flatMap((p) => p.items).find((i) => i.id === row.session_id)?.title;
    if (!title) return null;

    const when = whenLabel(new Date(row.closed_at), now);
    return { text: when ? `You finished ${title} ${when}.` : `You finished ${title}.`, source: 'session' };
  } catch (e) {
    console.error(`lastAccomplishment: session read failed for member=${memberId}:`, e);
    return null;
  }
}

/** buildReview's lines start with the row label ("Your Lifestyle Pilot — 4 of the 5 you aimed for."). Spliced
 *  after "You closed your practice week — " it needs its own capital dropped, but ONLY when the label isn't a
 *  proper noun the member named themselves. Cheap test: leave anything that isn't a plain sentence start alone. */
function lowerFirstClause(line: string): string {
  const trimmed = line.trim();
  return /^(Your|The)\b/.test(trimmed) ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed;
}
