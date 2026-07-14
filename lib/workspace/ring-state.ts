// Redesign Layer 1 (D-03) — the RING STATE deriver. Journey merges into the hero as the bullseye ring (build spec §5):
// four concentric phases, center-out reconnect → rewire → rebuild → reclaim (self radiating to the bigger world).
// Completed phases render solid, the ACTIVE phase fills by its share of done items (its "thirds": 3 sessions + a
// checkpoint), upcoming phases ghost. PURE — derived entirely from the forecast the dashboard already computes, so the
// ring and the program path never disagree. No visuals here (Scott's ring reads these numbers); "borrowed grammar,
// refused semantics" — rings only advance, never empty, down-states are the renderer's job, never guilt.
//
// Cycle-aware shell: `cycle` defaults to 1. When all four fill, Cycle 2 re-runs the rings (a second pass / cycle
// marker) — that behavior is a later pass; the parameter is here so callers commit to it from the start (spec §5).

import { PHASES, type Phase } from './session-registry.ts';
import type { Forecast } from '../curriculum/view.ts';

export type RingPhaseState = {
  phase: Phase;
  label: string;
  state: 'done' | 'current' | 'ahead';
  fill: number; // 0..1 — solid (1) when done, fractional in the active phase, 0 when ahead
  done: number; // items completed in the phase
  total: number; // items in the phase (sessions + checkpoint)
};

const PHASE_LABEL: Record<Phase, string> = {
  reconnect: 'Reconnect',
  rewire: 'Rewire',
  rebuild: 'Rebuild',
  reclaim: 'Reclaim',
};

// Returned in center-out order (reconnect first) — the renderer maps index → ring radius.
export function deriveRingState(forecast: Forecast, _cycle = 1): RingPhaseState[] {
  const byPhase = new Map(forecast.phases.map((p) => [p.phase, p]));
  return PHASES.map((phase) => {
    const fp = byPhase.get(phase);
    const items = fp?.items ?? [];
    const total = items.length;
    const done = items.filter((i) => i.state === 'done').length;
    const state: RingPhaseState['state'] =
      fp?.status === 'Complete' ? 'done' : fp?.status === "You're here" ? 'current' : 'ahead';
    // Done rings read solid and ahead rings empty regardless of item bookkeeping; only the active ring shows fraction.
    const fill = state === 'done' ? 1 : state === 'ahead' ? 0 : total > 0 ? done / total : 0;
    return { phase, label: PHASE_LABEL[phase], state, fill, done, total };
  });
}
