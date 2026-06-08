// Gating + dosing as CONFIG (CLAUDE.md principle 2). The engine reads these rules; Greg can
// change them without re-engineering. Prerequisites are hard gates; the recommended-next is
// dosed per member by IDQ subscores ("current focus", non-linear — Decision Log Jun 9).

import type { DimensionScores } from '../idq/scoring.ts';
import { currentFocus } from '../gateway/flow.ts';

export type AssetStatus = 'completed' | 'available' | 'locked';
export type RGroup = 'Reconnect' | 'Rewire' | 'Rebuild' | 'Reclaim';

// Prerequisite config. Reconnect is the gateway; Rewire + Rebuild open in parallel after it
// and are sequenced lightly within each track; Reclaim opens once both tracks have begun.
export const GATES: Record<string, { requires: string[]; group: RGroup }> = {
  'R-1': { requires: [], group: 'Reconnect' },
  'R-4': { requires: ['R-1'], group: 'Reconnect' },
  'R-6': { requires: ['R-4'], group: 'Reconnect' },
  'W-1': { requires: ['R-6'], group: 'Rewire' },
  'W-3': { requires: ['W-1'], group: 'Rewire' },
  'W-5': { requires: ['W-3'], group: 'Rewire' },
  'B-1': { requires: ['R-6'], group: 'Rebuild' },
  'B-2': { requires: ['B-1'], group: 'Rebuild' },
  'B-3': { requires: ['B-1'], group: 'Rebuild' },
  'B-5': { requires: ['B-3'], group: 'Rebuild' },
  'C-1': { requires: ['W-1', 'B-1'], group: 'Reclaim' },
  'C-3': { requires: ['C-1'], group: 'Reclaim' },
  'C-5': { requires: ['C-3'], group: 'Reclaim' },
};

export const ASSET_ORDER = ['R-1', 'R-4', 'R-6', 'W-1', 'W-3', 'W-5', 'B-1', 'B-2', 'B-3', 'B-5', 'C-1', 'C-3', 'C-5'];

const GROUP_FOR_DIMENSION: Record<string, RGroup> = {
  physical: 'Rebuild',
  self: 'Rewire',
  outlook: 'Rewire',
  social: 'Reconnect',
};

export type GateContext = { completed: ReadonlySet<string>; dimensions?: DimensionScores };

// TEMPORARY (demo): when G4L_DEMO_OPEN_REBUILD=1, the Rebuild track is open to everyone so
// fresh accounts can reach Greg's content without first completing Reconnect. Remove the env
// var (Vercel) to restore normal gating — no code change needed.
const DEMO_OPEN_REBUILD = process.env.G4L_DEMO_OPEN_REBUILD === '1';

export function assetStatus(ctx: GateContext, code: string): AssetStatus {
  if (ctx.completed.has(code)) return 'completed';
  const g = GATES[code];
  if (!g) return 'locked';
  if (DEMO_OPEN_REBUILD && g.group === 'Rebuild') return 'available';
  return g.requires.every((r) => ctx.completed.has(r)) ? 'available' : 'locked';
}

export function availableAssets(ctx: GateContext): string[] {
  return ASSET_ORDER.filter((c) => assetStatus(ctx, c) === 'available');
}

/** The single asset to suggest next, dosed by current focus when an IDQ exists. */
export function recommendedNext(ctx: GateContext): string | null {
  const avail = availableAssets(ctx);
  if (avail.length === 0) return null;
  if (ctx.dimensions) {
    const group = GROUP_FOR_DIMENSION[currentFocus(ctx.dimensions).dimension];
    const inFocus = avail.find((c) => GATES[c]!.group === group);
    if (inFocus) return inFocus;
  }
  return avail[0]!;
}
