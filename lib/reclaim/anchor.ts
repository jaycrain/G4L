// THE ANCHOR — the one Reclaim List item C1 (Looking Forward) marks as `top`.
//
// It is the thing the rest of the list organises itself around, and naming it and then burying it undoes the
// Session that found it. Jay, on his own card where it had landed fourth: "Shouldn't the starred item be on top.
// That was the whole point of Looking Forward."
//
// This lives in its own module because three surfaces need the same answer — the C1 session card, the Reclaim
// List subpage, and the Companion's context — and a rule restated at three call sites is one rule and two wrong
// copies waiting to happen.

/** The stored tier that means "this is the anchor". The other tiers are important / emerging / no_longer_central. */
export const ANCHOR_TIER = 'top';

export const isAnchorTier = (tier: string | null | undefined): boolean => tier === ANCHOR_TIER;

/**
 * Lift the anchor to the front, leaving everything else exactly as the member arranged it.
 *
 * STABLE ON PURPOSE. The member's own order (the rail's drag, `sort_order`) is theirs; this is not a re-ranking,
 * it is one item being surfaced. Only the anchor moves.
 */
export function anchorFirst<T>(items: readonly T[], isAnchor: (item: T) => boolean): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => Number(isAnchor(b.item)) - Number(isAnchor(a.item)) || a.idx - b.idx)
    .map((x) => x.item);
}
