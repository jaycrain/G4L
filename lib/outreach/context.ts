// The engine's member-context loader (OutreachDeps.loadContext) — the member's current phase + how many sessions
// they've closed IN that phase, which together set the voice-dial + earned-plan threshold (engine.pickTense).
// Phase is read from the curriculum gates (same source the dashboard uses), so outreach never drifts from Program state.

import type { Db } from '../db/schema.ts';
import { listGates, closedSessionIds } from '../curriculum/store.ts';
import { CURRICULUM, PHASE_ORDER } from '../curriculum/registry.ts';
import type { OutreachContext, Phase } from './engine.ts';

// Gates advance the active phase one step at a time (mirrors curriculum/view.activePhaseIndex).
export function phaseFromGates(gates: string[]): Phase {
  const g = new Set(gates);
  let i = 0;
  if (g.has('reconnect_checkpoint_passed')) i = 1;
  if (g.has('rewire_checkpoint_passed')) i = 2;
  if (g.has('rebuild_checkpoint_passed')) i = 3;
  return PHASE_ORDER[i] as Phase;
}

export async function loadContext(db: Db, memberId: string): Promise<OutreachContext> {
  const [gates, closed] = await Promise.all([listGates(db, memberId), closedSessionIds(db, memberId)]);
  const phase = phaseFromGates(gates);
  const inPhase = new Set(CURRICULUM.filter((a) => a.phase === phase).map((a) => a.id));
  const sessionsInPhase = closed.filter((id) => inPhase.has(id)).length;
  return { phase, sessionsInPhase };
}
