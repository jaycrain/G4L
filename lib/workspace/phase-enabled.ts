// CAT-40 — THE COUPLING INVARIANT BETWEEN A ROUTE AND ITS ENGINE.
//
// One member surface was protected by two independent flags at two layers: REDESIGN at the /workspace route, and
// the phase flag (RECLAIM/REWIRE/…) down in the arc-turn action. Nothing tied them. So a deploy with REDESIGN on
// and a phase flag off produced the worst possible shape: the workspace rendered completely — wayfinding, ring,
// artifact — emitted session_open, and then refused EVERY turn with "Reclaim is not enabled." The member sat in a
// session that looked alive and would not move, and QI recorded an open with no close.
//
// The lesson generalises past this route: a surface gated by more than one flag needs ONE resolver that answers
// "can a member actually finish this?", checked at the entrance. Independent flags at different layers will
// eventually disagree — that isn't a hypothetical, it's a scheduling detail.
//
// Deliberately a pure map with no default: adding a phase forces a decision here rather than silently inheriting
// "enabled" and reintroducing exactly this bug.

import { reconnectEnabled } from '../agent/reconnect.ts';
import { rewireEnabled } from '../agent/rewire.ts';
import { rebuildEnabled } from '../agent/rebuild.ts';
import { reclaimEnabled } from '../agent/reclaim.ts';
import type { Phase } from './session-registry.ts';

const PHASE_ENGINE: Record<Phase, () => boolean> = {
  reconnect: reconnectEnabled,
  rewire: rewireEnabled,
  rebuild: rebuildEnabled,
  reclaim: reclaimEnabled,
};

/** True when the ENGINE behind this phase can actually run a turn. Check before rendering a session surface. */
export function phaseEngineEnabled(phase: Phase): boolean {
  return PHASE_ENGINE[phase]();
}
