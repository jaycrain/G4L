// Decides the one-time "you've crossed into the next R" dashboard banner. Pure + framework-free so
// it's unit-testable; the page handles the persistence (phase_crossing_seen) and the CTA. A crossing
// is announced once, when the member's active R is past Reconnect and differs from what they've seen.

const PHASE_ORDER = ['reconnect', 'rewire', 'rebuild', 'reclaim'];
const LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };
const BLURB: Record<string, string> = {
  rewire: 'Now the rewiring — dismantling the old stories and building new frames around your body, your habits, and your self.',
  rebuild: 'Now the physical work — movement, fuel, sleep. This is where the numbers start to move.',
  reclaim: 'Now you carry the recovered self outward — to the people, the community, and the things you do.',
};

export type Crossing = { phase: string; prevLabel: string; newLabel: string; blurb: string };

/** The crossing to announce, or null. activePhase = the R they're in now; seenPhase = the last R whose
 * crossing banner they've already been shown. */
export function crossingToShow(activePhase: string, seenPhase: string | null): Crossing | null {
  if (activePhase === 'reconnect') return null; // the start — they didn't cross into it
  if (seenPhase === activePhase) return null; // already announced this one
  const idx = PHASE_ORDER.indexOf(activePhase);
  if (idx <= 0) return null;
  const blurb = BLURB[activePhase];
  if (!blurb) return null;
  return { phase: activePhase, prevLabel: LABEL[PHASE_ORDER[idx - 1]!]!, newLabel: LABEL[activePhase]!, blurb };
}
