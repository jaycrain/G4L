// The close — where delivery becomes measurement (pure logic). Given the effective close type, the
// member's response, the bound Reclaim item, and whether this completion is a return-after-a-miss,
// resolve: which Grinta components it feeds (Decision 4) and how the served item's state moves
// (not_yet → closer → reclaimed). store.ts persists the outcome.

import type { CloseType } from './registry.ts';
import { RECLAIMED_THRESHOLD, type ReclaimItem, type ReclaimState } from './types.ts';

export type CloseOutcome = {
  feedsConsistency: boolean; // any completion = showing up
  feedsRecovery: boolean; // a return after a miss
  feedsReach: boolean; // a goal Beat closed "closer" (or a stretch)
  itemUpdate: null | { id: string; newState: ReclaimState; newCloserCount: number; reclaimedNow: boolean };
};

export function resolveClose(args: {
  effectiveType: CloseType;
  response: string;
  boundItem: ReclaimItem | null;
  isReturn: boolean;
}): CloseOutcome {
  const { effectiveType, response, boundItem, isReturn } = args;
  const isCloser = effectiveType === 'goal' && response === 'closer';

  let itemUpdate: CloseOutcome['itemUpdate'] = null;
  if (isCloser && boundItem) {
    const newCloserCount = boundItem.closerCount + 1;
    const reclaimedNow = newCloserCount >= RECLAIMED_THRESHOLD;
    itemUpdate = {
      id: boundItem.id,
      newState: reclaimedNow ? 'reclaimed' : 'closer',
      newCloserCount,
      reclaimedNow,
    };
  }

  return {
    feedsConsistency: true, // every completed Beat feeds Consistency, regardless of close type
    feedsRecovery: isReturn,
    feedsReach: isCloser, // (stretch / measuring-stick Beats would also set this when tagged)
    itemUpdate,
  };
}
