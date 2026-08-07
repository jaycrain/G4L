// CLOSING THE WEEK — the thing the practice week has never been able to do.
//
// Until now a week opened and then aged out: PRACTICE_WINDOW_DAYS elapsed and it silently stopped being "active".
// Nothing reviewed it, nothing recorded it, and the member was never told it was over. Greg has asked for the other
// half of this twice — a "ready to move to the next activity" prompt at the end — and it's also what makes his
// "about a 6 week experience for Cycle 1" framing possible: a cycle can only have a length if its weeks can finish.
//
// THE POSTURE, which is the whole design. This is a review, NOT a report card:
//   · Their own numbers, their own words. "4 of the 5 you aimed for", never a percentage and never a grade.
//   · A shortfall is stated plainly and left alone. No "only", no "just", no encouragement-flavoured consolation —
//     both of those tell the member you think they failed.
//   · Beating a target is not praised as heroism either; it's noticed. Praise turns a practice into a performance.
//   · A week where nothing was marked is still a week that happened, and it gets a truthful, unbothered line.
// The rule underneath: normalise, don't grade. The Fade is a hundred reasonable decisions, not a failing — and a
// week is seven of them.

import type { Db } from '../db/schema.ts';
import type { GridRow, WeekGrid } from './grid.ts';
import { PRACTICE_WINDOW_DAYS, type PracticeKind } from './store.ts';

/** A week is closable once its window has elapsed and it hasn't already been closed. */
export function isClosable(grid: Pick<WeekGrid, 'day' | 'closed' | 'rows'>): boolean {
  return !grid.closed && grid.day >= PRACTICE_WINDOW_DAYS && grid.rows.length > 0;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line per row, in the member's own terms. Pure — every phrasing decision is visible and testable here. */
export function reviewLine(r: GridRow): string {
  if (r.target == null) {
    // No target was ever set, so there is nothing to fall short OF. Just the count.
    return r.done === 0
      ? `${r.label} — no days marked.`
      : `${r.label} — ${plural(r.done, 'day', 'days')}.`;
  }
  if (r.done === 0) return `${r.label} — none this week. It was there, waiting.`;
  if (r.done >= r.target) {
    return r.done > r.target
      ? `${r.label} — ${r.done}, past the ${r.target} you set.`
      : `${r.label} — ${r.done} of ${r.target}. Exactly what you aimed for.`;
  }
  // The shortfall line. Stated, then left alone — no "only", no softener, no silver lining bolted on.
  return `${r.label} — ${r.done} of the ${r.target} you aimed for.`;
}

export type WeekReview = {
  kind: PracticeKind;
  lines: string[];
  /** The one-sentence frame above the lines. Never a verdict on the member. */
  opener: string;
  /** Kept in the Playbook: the week, in their words, as one body. */
  keeperBody: string;
};

/** The Playbook body for a finished week. One definition, so the keeper can't drift from the review the member read. */
export function keeperBodyFrom(lines: string[]): string {
  return ['Your practice week:', ...lines.map((l) => `• ${l}`)].join('\n');
}

export function buildReview(grid: Pick<WeekGrid, 'kind' | 'rows'>): WeekReview {
  const lines = grid.rows.map(reviewLine);
  const anyMarked = grid.rows.some((r) => r.done > 0);
  const opener = anyMarked
    ? "That's your week. Here's how it actually went —"
    : // The hardest case to get right. A week with nothing marked is where a product is most tempted to console or
      // to scold, and both land as judgement. Say the true thing: we don't know what the week held, and asking is
      // more use than assuming.
      "That's the week done. Nothing got marked — which might mean it was a hard week, or just that logging slipped.";
  return {
    kind: grid.kind,
    lines,
    opener,
    keeperBody: keeperBodyFrom(lines),
  };
}

/** Mark the week closed. Idempotent: returns false if it was already closed, so a close beat can't fire twice. */
export async function closeWeek(db: Db, memberId: string, kind: PracticeKind): Promise<boolean> {
  const { rows } = await db.query<{ kind: string }>(
    `update practice_week set closed_at = now()
      where member_id = $1 and kind = $2 and closed_at is null
      returning kind`,
    [memberId, kind],
  );
  return rows.length > 0;
}
