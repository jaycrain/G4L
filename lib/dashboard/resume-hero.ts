// Redesign scaffold (D-02) — the stateful RESUME HERO. Re-entry is the dashboard's top job, so the hero reads the
// member's position and shows the single most-actionable productive next thing. This is the PURE decision function; the
// dashboard maps its real data (forecast, gates, practice weeks, in-flight arc_session) into `HeroSignals` and renders
// the returned `HeroState`. No copy/visuals here — that's Scott's layer. Dormant until wired.

export interface HeroSignals {
  hasStarted: boolean; // any session completed yet?
  inProgressSession?: { id: string; label: string } | null; // a session left mid-way (arc_session persisted) — resumable
  justFinishedSession?: { id: string; label: string } | null; // completed this visit / very recently
  checkpointReady?: { phase: string; label: string } | null; // a phase Checkpoint is unlocked and unstarted
  activePractice?: { kind: string; label: string; day: number; total: number } | null; // a practice week in flight
  nextSession?: { id: string; label: string } | null; // the lit next step from the forecast
  reclaimLocked?: { reason: string; opensOn: string | null } | null; // at the Reclaim boundary but not yet ready (the Loop gate)
}

export type HeroState =
  | { kind: 'resume'; session: { id: string; label: string } } // finish what you started (highest priority)
  | { kind: 'just-finished'; session: { id: string; label: string }; next: { id: string; label: string; isCheckpoint: boolean } | null }
  | { kind: 'reclaim-locked'; reason: string; opensOn: string | null } // Reclaim is next but gated (the Loop) — coming, not active
  | { kind: 'checkpoint-ready'; checkpoint: { phase: string; label: string } }
  | { kind: 'mid-week-practice'; practice: { kind: string; label: string; day: number; total: number } }
  | { kind: 'next-step'; session: { id: string; label: string } }
  | { kind: 'fresh' }; // brand new — nothing started

// Priority order (most-actionable first). Exactly one state wins, deterministically.
//   resume → just-finished → checkpoint-ready → mid-week-practice → next-step → fresh
export function resolveHeroState(s: HeroSignals): HeroState {
  if (s.inProgressSession) return { kind: 'resume', session: s.inProgressSession };
  if (s.justFinishedSession) {
    // Name what's actually next — a session if one's lit, otherwise the phase Checkpoint (finishing the last session
    // hands into the Checkpoint, so "the next step will be here" read as a dead end). Never leave it unnamed.
    const next = s.nextSession
      ? { id: s.nextSession.id, label: s.nextSession.label, isCheckpoint: false }
      : s.checkpointReady
        ? { id: s.checkpointReady.phase, label: s.checkpointReady.label, isCheckpoint: true }
        : null;
    return { kind: 'just-finished', session: s.justFinishedSession, next };
  }
  // The Loop gate: at the Reclaim boundary but not yet ready → "coming, not active" (never offers C1). Outranks the
  // next-step it would otherwise be.
  if (s.reclaimLocked) return { kind: 'reclaim-locked', reason: s.reclaimLocked.reason, opensOn: s.reclaimLocked.opensOn };
  if (s.checkpointReady) return { kind: 'checkpoint-ready', checkpoint: s.checkpointReady };
  if (s.activePractice) return { kind: 'mid-week-practice', practice: s.activePractice };
  if (s.hasStarted && s.nextSession) return { kind: 'next-step', session: s.nextSession };
  return { kind: 'fresh' };
}
