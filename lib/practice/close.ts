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
import { type PracticeKind } from './store.ts';

/**
 * A week is closable once its window has elapsed and it hasn't already been closed.
 *
 * THE PARTIAL FIRST WEEK IS NEVER CLOSABLE. A Session closed on a Sunday afternoon produces a one-day stub, and
 * reviewing that would read as the program mocking the member. The full Monday–Sunday that follows carries the
 * review, so every review lands on a Sunday (Jay, 2026-08-12).
 */
export function isClosable(grid: Pick<WeekGrid, 'day' | 'closed' | 'rows' | 'window'>): boolean {
  if (grid.window.partial) return false;
  return !grid.closed && grid.day >= grid.window.days && grid.rows.length > 0;
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

/**
 * What a finished week is CALLED once it reaches the Playbook.
 *
 * Every closed week used to land as "Your practice week", so a member who had run three of them saw three
 * identical headings under What worked with no way to tell them apart — a pile, not an operating manual. These
 * are the names they have already read on the outcome cards, so the Playbook agrees with the surface that sent
 * them there.
 */
export const PRACTICE_KEEPER_NAME: Record<PracticeKind, string> = {
  w2_image: 'Your picture',
  w3_logging: 'Mindful Monitoring',
  b2_noticing: 'Your map',
  b3_pilot: 'The Lifestyle Pilot',
  c3_quality: 'Quality Days',
  reclaim_item: 'From your Reclaim List',
};

/** The Playbook body for a finished week. One definition, so the keeper can't drift from the review the member read. */
export function keeperBodyFrom(lines: string[], kind?: PracticeKind): string {
  const head = (kind && PRACTICE_KEEPER_NAME[kind]) ?? 'Your practice week';
  return [`${head}:`, ...lines.map((l) => `• ${l}`)].join('\n');
}

/** W3 ONLY — how many days they used the response they prepared. Greg names this as one of the three things
 *  affirmations MAY target ("consistency of tracking, honesty of observation, and use of the recovery skill"),
 *  and it is the only one the grid alone cannot see. Null when they never said either way. */
export type W3CloseExtras = { recoveryUsed: number; daysLogged: number } | null;

export function buildReview(grid: Pick<WeekGrid, 'kind' | 'rows'>, w3?: W3CloseExtras): WeekReview {
  const lines = grid.rows.map(reviewLine);
  const anyMarked = grid.rows.some((r) => r.done > 0);

  // W3 · Mindful Monitoring gets its OWN frame, because the generic one asks the wrong question of it. "Here's how
  // it actually went" invites a verdict on the week, and W3's week is explicitly not about performance — Greg:
  // "The week is explicitly NOT about changing behavior — that is B3's work." What it was about is NOTICING, so
  // that is what the close reflects back.
  if (grid.kind === 'w3_logging') {
    const opener = anyMarked
      ? "That's the week. Here's what you noticed —"
      : "That's the week done. Nothing got written down — which might mean a hard week, or just that the noticing " +
        'slipped. Either is worth knowing.';
    // The ONE affirmation the close is allowed to make, and only when it is true. Greg's disallowed list is
    // explicit — "Great, you avoided False Starts today!", "You only had two Smart Choices this week" — so nothing
    // here counts good calls against false starts, and nothing praises an absence. Using the protocol they wrote
    // IS the competence W3 builds, which makes it the honest thing to name.
    const extra: string[] = [];
    if (w3 && w3.recoveryUsed > 0) {
      extra.push(
        w3.recoveryUsed === 1
          ? 'You used the protocol you wrote once. That is the skill this week was for.'
          : `You used the protocol you wrote ${w3.recoveryUsed} times. That is the skill this week was for.`,
      );
    }
    return { kind: grid.kind, lines: [...lines, ...extra], opener, keeperBody: keeperBodyFrom([...lines, ...extra]) };
  }

  // C3 · QUALITY DAYS gets its own close, carrying Greg's review stages (C3.md:608–622). The generic close reads
  // the week back as counts and stops; his stages 6–8 are the point of the week:
  //
  //   6 · PATTERN REVIEW — what stands out, what CONDITIONS supported quality, what BARRIERS interfered, and a
  //       TENTATIVE summary. Tentative is not a hedge for its own sake: the member tracked seven days, which
  //       cannot support a claim about their life, and C2-81's causality rule applies here as everywhere.
  //   7 · PROCESS AND PRODUCT — tracking is the process, wellness is the product, and the parallel to B3 is his.
  //       "Avoid promising wellness as an outcome of tracking" (C3-87) is the one thing this close must not do,
  //       and it is exactly what a close about good days is tempted to do.
  //   8 · CLOSING — affirm the HABIT of self-monitoring (not the results), and hand forward.
  //
  // IT ASKS RATHER THAN CONCLUDES. The conditions and the barriers are the member's to name — a summary that
  // supplied them would be the narrative of growth C2-37 forbids, one Session later.
  if (grid.kind === 'c3_quality') {
    const best = [...grid.rows].sort((a, b) => b.done - a.done)[0];
    const thin = [...grid.rows].sort((a, b) => a.done - b.done)[0];
    // The tentative summary, and only when the days can actually carry one. A single marked day is not a pattern,
    // and naming one from it would be inventing the thing this stage exists to draw out.
    const pattern =
      anyMarked && best && thin && best.label !== thin.label && best.done > thin.done + 1
        ? `Across the week, ${best.label.toLowerCase()} showed up most and ${thin.label.toLowerCase()} least. ` +
          `That may be telling you something about what a good day of yours is actually made of.`
        : anyMarked
          ? 'A week is short, and yours does not fall into an obvious shape — which is itself worth knowing.'
          : '';
    const opener = anyMarked
      ? "That's the week of tracking done. Here is what got marked —"
      : "That's the week done. Nothing got marked, which might mean a hard week or just that the logging slipped.";
    const extra = [
      ...(pattern ? [pattern] : []),
      'What was going on in the days that felt like quality — and what got in the way on the ones that did not?',
      // Stage 7, in his terms. The B3 parallel is his; the refusal to promise wellness is C3-87.
      'Tracking is the process here; the quality is what the process is for. Same shape as the pilot week in ' +
        'Rebuild — the logging was never the point, noticing was.',
      // Stage 8 — the HABIT, not the results.
      'Either way, you watched your own days for a week. That is the habit this was for, and it is yours now.',
    ];
    return { kind: grid.kind, lines: [...lines, ...extra], opener, keeperBody: keeperBodyFrom([...lines, ...extra]) };
  }

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
