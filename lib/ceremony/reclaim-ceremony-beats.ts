// §C4 — The Reclaim Ceremony content (the capstone; mirrors rebuild-ceremony-beats.ts). The culminating reveal at the
// END of Reclaim AND of Cycle 1: the Grinta move (the CHALLENGE COMPONENT, foregrounded), the Playbook seeds (what
// they clarified), a Legacy-revisit beat, and the Community Success Story invite → the Loop. Copy is DIRECTIONAL
// placeholder (Cowork wordsmiths), following the R4/B4 ceremony conventions (Decision EE modifiers, names the Phase,
// down renders grey / never red per HH).

export type ReclaimCeremonyReveal =
  | {
      kind: 'grinta';
      componentNow: number; // the challenge component's Ave2 — the hero number
      componentBaseline: number | null; // Ave1 (the starting line)
      componentChangePct: number | null; // the COMPONENT movement, signed up-positive (grey on down, HH)
      direction: 'up' | 'down' | 'flat' | null;
      composite: number; // the overall Grinta Index — background/context
    }
  | { kind: 'playbook'; keepers: string[] } // what they clarified in Reclaim (their top priorities), in their words
  | { kind: 'cycle_complete' }; // the 4Rs Journey — all four complete, the Loop begins again

export type ReclaimCeremonyBeat = { text: string; small?: boolean; reveal?: ReclaimCeremonyReveal };

export type ReclaimCeremonyData = {
  grinta: {
    componentNow: number;
    componentBaseline: number | null;
    componentChangePct: number | null;
    direction: 'up' | 'down' | 'flat' | null;
    composite: number;
  } | null; // null until the Checkpoint moves it (no baseline → the flat framing, no number)
  keepers: string[]; // the priorities they clarified in Reclaim (top-tier Reclaim List items), in their own words
};

// ─────────────────────────────────────────────────────────────────────────────────────
// RECLAIM CEREMONY COPY — directional (Cowork wordsmiths). The moving number is "your Grinta Index" member-facing;
// the science labels (Challenge/strand/component) stay basement. Down renders grey, never red (HH). Names the Phase.
// ─────────────────────────────────────────────────────────────────────────────────────
export const RECLAIM_CEREMONY_COPY = {
  up: "Look at that — your Reclaim just climbed. The challenge you built this Phase is part of it now — the pull toward what's possible, reading higher than the line you started on. The list you clarified, the priorities you named, the days you learned to shape — that's them, in the number.",
  down: "Your Reclaim reads a little lower than your starting line — and that's Reclaim doing its work. You looked clearly at the gap between where you are and where you want to be; naming it honestly is how it closes. A dip here means you're seeing the whole picture. That's the ground the next cycle builds on.",
  flat: "Your Reclaim held steady — a solid line to build from. The real move was Reclaim itself — watching your world get bigger. The climb comes as you keep reaching.",
  playbook:
    "Here's what you're taking with you, saved to your Playbook: the priorities you clarified, the quality day you defined, the bigger world you mapped. That's your kit for what comes next.",
  playbookEmpty: 'Everything you clarified in Reclaim lives in your Playbook — your kit, ready to reach for.',
  legacy:
    "And one more thing — go back and read the Legacy you wrote near the start. You're not the same person who wrote it. Read it, and see how far you've come.",
  cycle:
    "You've closed your first full cycle — Reconnect, Rewire, Rebuild, Reclaim. That's rare air. The Loop doesn't end here; it begins again, deeper. And you're not doing it alone — share your Success Story with the community, and help someone standing where you started.",
} as const;

export function buildReclaimCeremonyBeats(d: ReclaimCeremonyData): ReclaimCeremonyBeat[] {
  const c = RECLAIM_CEREMONY_COPY;
  const beats: ReclaimCeremonyBeat[] = [];
  // The Grinta move — branch on the COMPONENT delta (up/down/flat); revealed only when the Checkpoint captured it.
  if (d.grinta) {
    const text = d.grinta.direction === 'down' ? c.down : d.grinta.direction === 'up' ? c.up : c.flat;
    beats.push({ text, reveal: { kind: 'grinta', ...d.grinta } });
  } else {
    beats.push({ text: c.flat }); // no reading → the steady framing, no number to show
  }
  // The Playbook seeds — what they clarified (top priorities), revealed together.
  beats.push(
    d.keepers.length > 0
      ? { text: c.playbook, reveal: { kind: 'playbook', keepers: d.keepers.slice(0, 3) } }
      : { text: c.playbookEmpty, small: true },
  );
  // The Legacy revisit (a reflective beat, no reveal).
  beats.push({ text: c.legacy });
  // Cycle complete + the Community Success Story invite + the CTA.
  beats.push({ text: c.cycle, reveal: { kind: 'cycle_complete' } });
  return beats;
}

export const RECLAIM_CEREMONY_RESOLVE_LABEL = 'Share your story →';
