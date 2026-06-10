// serves binding (Slice Spec Decisions 2 & 3). A goal Beat carries a reclaim CATEGORY, not a
// hardcoded item. At runtime it binds to the member's least-recently-served OPEN item in that
// category (ties broken by entry order). If there's no open item in the category, the goal close
// degrades to a `rep` ("Did you do it?") rather than pointing at an unrelated goal.

import { goalCategory, type Beat, type CloseType } from './registry.ts';
import { isVagueReclaim } from './category.ts';
import type { ReclaimItem } from './types.ts';

const isOpen = (i: ReclaimItem) => i.state !== 'reclaimed';

/** Least-recently-served open, SPECIFIC item in the Beat's category (or any). Null → no match
 *  (which makes the close degrade to rep). Vague items are skipped so a goal close never points at
 *  unanswerable fog — they fall through to a "did you do it?" rep until sharpened. */
export function bindGoalItem(beat: Beat, items: ReclaimItem[]): ReclaimItem | null {
  if (beat.close_type !== 'goal') return null;
  const cat = goalCategory(beat);
  const candidates = items.filter(
    (i) => isOpen(i) && !isVagueReclaim(i.text) && (cat === 'any' || i.category === cat),
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
