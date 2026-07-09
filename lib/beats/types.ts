// Shared types for the Beat engine. Member state is assembled from the DB (store.ts) and handed
// to the pure engine functions (readiness / serves / select), so the logic is testable without a DB.

import type { Category, Rhythm } from './registry.ts';

export type { Category } from './registry.ts';

export type ReclaimState = 'not_yet' | 'closer' | 'reclaimed';

export type ReclaimItem = {
  id: string;
  text: string;
  category: Category;
  rhythm: Rhythm;
  state: ReclaimState;
  closerCount: number;
  sortOrder: number;
  lastServedAt: string | null; // ISO; null = never served
  tier?: string | null; // Reclaim C1 Step 2 refinement tier (top|important|emerging|no_longer_central); null = untiered (0053)
};

export type MemberBeatState = {
  completedBeatIds: Set<string>;
  reclaimItems: ReclaimItem[];
  identitySet: boolean;
  doorCaptured: boolean;
  idqDone: boolean; // ≥1 IDQ retake recorded
  rewireCheckpointDone: boolean; // RWR-CHK-01 completed
  rebuildFoundationCount: number; // completed Rebuild Foundation Beats
  daysSinceLastIdq: number | null;
  lowestDimension: Category | null; // weakest IDQ subscore → biases Beat selection toward it
};

// "Reclaimed" threshold (Slice decide-in-passing #1): an item flips to reclaimed after this many
// "closer" closes (or on explicit member confirmation). Trivially tunable.
export const RECLAIMED_THRESHOLD = 3;
