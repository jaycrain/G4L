// serves binding (Slice Spec Decisions 2 & 3). A goal Beat carries a reclaim CATEGORY, not a
// hardcoded item. At runtime it binds to the member's least-recently-served OPEN item in that
// category (ties broken by entry order). If there's no open item in the category, the goal close
// degrades to a `rep` ("Did you do it?") rather than pointing at an unrelated goal.

import { goalCategory, isCoachedCategory, type Beat, type CloseType } from './registry.ts';
import type { ReclaimItem } from './types.ts';

const isOpen = (i: ReclaimItem) => i.state !== 'reclaimed';

/**
 * Least-recently-served open, SPECIFIC item in the Beat's category (or any). Null → no match (which
 * makes the close degrade to rep).
 *
 * THE FOG GATE IS GONE FROM HERE TOO (2026-08-16, second half). The morning's fix took `isVagueReclaim`
 * off the WRITE path in refine.ts; this was the other half of the same mistake, and it survived because
 * nothing failed loudly — the item saved fine and then quietly never bound to a goal close.
 *
 * The old justification was that a fog close is "unanswerable": *"did this move you toward feeling
 * better about myself?"* But that question IS answerable, and it is very close to the questions Greg's
 * C1 is built out of ("which items feel more real or possible now than they did before?"). The premise
 * was wrong, not just the placement.
 *
 * What settles it: the regex (`feel`, `happier`, `at peace`, `content`, `fulfilled`, `confiden*`,
 * `mindset`) is Greg's vocabulary for a GOOD item, not a bad one. His worked examples of a well-refined
 * Reclaim item — RECLAIM Gated Assets V4, substep 2.3 "Refine the list" — are *"feel physically capable
 * and steady again"* and *"feel more connected to people I care about"*. Those are the OUTPUT of the
 * refinement the program is designed to produce, and this filter refused to serve them. An engine that
 * declines to work toward the goals its own curriculum teaches members to write is not being careful.
 *
 * A member's wording is theirs. If they said it, we serve it.
 */
export function bindGoalItem(beat: Beat, items: ReclaimItem[]): ReclaimItem | null {
  if (beat.close_type !== 'goal') return null;
  const cat = goalCategory(beat);
  const candidates = items.filter(
    // 'life' items are tracked & witnessed, never coached — they never bind to a goal Beat (even an
    // "any" one), so no goal close ever fires for them. They advance via the companion mark instead.
    // See docs/reclaim-anygoal.md.
    (i) => isOpen(i) && isCoachedCategory(i.category) && (cat === 'any' || i.category === cat),
  );
  if (candidates.length === 0) return null;
  // never-served (lastServedAt null) sorts first; then oldest served; ties by entry order.
  candidates.sort((a, b) => {
    const ta = a.lastServedAt ? new Date(a.lastServedAt).getTime() : -Infinity;
    const tb = b.lastServedAt ? new Date(b.lastServedAt).getTime() : -Infinity;
    if (ta !== tb) return ta - tb;
    return a.sortOrder - b.sortOrder;
  });
  return candidates[0]!;
}

/** The close type actually used: a goal Beat with no bindable item degrades to rep (Decision 3). */
export function effectiveCloseType(beat: Beat, items: ReclaimItem[]): CloseType {
  if (beat.close_type === 'goal' && !bindGoalItem(beat, items)) return 'rep';
  return beat.close_type;
}

/** Fill {reclaim_item} in a goal close with the bound item's text. */
export function renderClose(beat: Beat, items: ReclaimItem[]): string {
  if (beat.close_type === 'goal') {
    const item = bindGoalItem(beat, items);
    if (item) return beat.close.replace(/\{reclaim_item\}/g, item.text);
    return 'Did you do it?  (Yes / No)'; // degraded to rep
  }
  return beat.close;
}
