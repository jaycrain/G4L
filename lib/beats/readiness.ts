// Readiness evaluator — resolves the predicate vocabulary from the Slice Spec Addendum. A Beat is
// eligible only when every predicate in its `readiness` array is true. The permissive, layer-split
// Rebuild gate is encoded in the Beats' readiness arrays themselves (Foundation →
// reconnect_core_complete, in parallel with Rewire; Structure/Elevation → rewire_threshold_met),
// so this evaluator stays a flat predicate resolver — no special-case gate logic here.

import type { Beat } from './registry.ts';
import type { MemberBeatState } from './types.ts';

const categorizedReclaimCount = (s: MemberBeatState) =>
  s.reclaimItems.length; // items always carry a category by construction

export function predicateMet(pred: string, s: MemberBeatState): boolean {
  switch (pred) {
    case 'onboarding_complete':
      return s.identitySet && s.doorCaptured && categorizedReclaimCount(s) >= 3;
    case 'reconnect_core_complete':
      // IDQ intake done AND Reclaim List built (≥3 categorized). Opens Rewire + Rebuild Foundation.
      return s.idqDone && categorizedReclaimCount(s) >= 3;
    case 'rewire_threshold_met':
      // [VALUE PENDING GREG] interim = Rewire Checkpoint reached. Opens Rebuild Structure/Elevation.
      return s.rewireCheckpointDone;
    case 'rebuild_underway':
      return s.rebuildFoundationCount >= 1;
    case 'day>=60_since_last_idq':
      return s.daysSinceLastIdq != null && s.daysSinceLastIdq >= 60;
    default:
      // A bare Beat id — an in-asset prerequisite.
      return s.completedBeatIds.has(pred);
  }
}

export function isReady(beat: Beat, s: MemberBeatState): boolean {
  return beat.readiness.every((p) => predicateMet(p, s));
}
