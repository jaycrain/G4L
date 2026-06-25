// The Threshold ceremony content (see docs/ceremony-threshold.md). Pure: builds the beat list from
// the member's own data so it's deterministic and testable. Copy lives here as config — wordsmith
// freely. The CeremonySurface renders these; only the data interpolates.

export type Dimensions = { physical: number; self: number; social: number; outlook: number };
export type ThresholdReveal =
  | { kind: 'uncovered'; identity: string | null; doors: string[]; winCount: number; idScore: number | null; dimensions: Dimensions | null }
  | { kind: 'seeds'; seeds: string[] }
  | { kind: 'journey' };

export type CeremonyBeat = { text: string; small?: boolean; reveal?: ThresholdReveal };

export type ThresholdData = {
  identityNoun: string | null; // natural-case noun, e.g. "Athlete"
  doors: string[]; // display names
  winCount: number; // Reclaim List length
  idScore: number | null; // baseline ID Score
  dimensions: Dimensions | null; // the four subscores (each /30) — for the "distance runs widest" read
  seeds: string[]; // 2–3 onboarding-harvested Playbook lines
  firstMoveTitle: string | null; // the engine's real next Beat title (Q3a) — null → generic
};

// ─────────────────────────────────────────────────────────────────────────────────────
// THRESHOLD COPY — the only place to wordsmith the ceremony's spoken lines.
// Edit freely; the structure (which beats carry a data reveal, and the final clip-in) is what's
// load-bearing. Mirrors docs/threshold-copy.md 1:1. {…} marks where the member's own data renders.
// ─────────────────────────────────────────────────────────────────────────────────────
export const THRESHOLD_COPY = {
  // 1 — lands alone, dashboard dimmed behind
  stop: 'Stop for a second.',
  // 2 — honor the work just done
  honor: 'Most people never do that kind of excavation in a lifetime — and you just did it in one sitting.',
  // 3 — reveal: the Reclaimed Identity, Door(s), "N to win back", baseline ID Score
  uncovered: "Here's what you uncovered:",
  // 4a — reveal: 2–3 harvested Playbook lines (when the onboarding harvest produced seeds)
  playbookSeeded: "These aren't answers to a form. They're the first pages of your Playbook.",
  // 4b — fallback when there are no seeds yet (no empty Playbook frame)
  playbookNoSeeds:
    "These aren't answers to a form. They're the start of your Playbook — the record of what's working, which fills as you go.",
  // 5 — reveal: the 4Rs Journey, Reconnect lit
  journey: "Here's the path ahead — your Journey.",
  // 6 — the Playbook is the thing you keep; glosses Grinta on first use
  lasts: 'Your Playbook fills with what works for you as we go — the thing you keep. It’s what builds your Grinta: the grit that keeps you going when motivation runs out. (It’s Italian for grit — you’ll see the word a lot around here.)',
  // 7 — the hand-off; this beat carries the clip-in (glossed on first use). {firstMove} renders only when known.
  clipIn: 'Ready to begin? We call it clipping in — like locking into a pedal before a ride: you commit, and the work carries you from there. Your first move’s a small one.',
  clipInWithMove: (firstMove: string) => `Ready to begin? We call it clipping in — like locking into a pedal before a ride: you commit, and the work carries you from there. Your first move’s a small one — ${firstMove}.`,
} as const;

export function buildThresholdBeats(d: ThresholdData): CeremonyBeat[] {
  const c = THRESHOLD_COPY;
  return [
    { text: c.stop },
    { text: c.honor, small: true },
    { text: c.uncovered, reveal: { kind: 'uncovered', identity: d.identityNoun, doors: d.doors, winCount: d.winCount, idScore: d.idScore, dimensions: d.dimensions } },
    // Beat 4 — seeds reveal only if the harvest produced any; otherwise the softer no-seeds line.
    d.seeds.length > 0
      ? { text: c.playbookSeeded, reveal: { kind: 'seeds', seeds: d.seeds.slice(0, 3) } }
      : { text: c.playbookNoSeeds, small: true },
    { text: c.journey, reveal: { kind: 'journey' } },
    { text: c.lasts, small: true },
    { text: d.firstMoveTitle ? c.clipInWithMove(d.firstMoveTitle) : c.clipIn },
  ];
}

export const THRESHOLD_RESOLVE_LABEL = 'Clip in →';
export const COMPANION_LABEL = 'Your G4L Companion';
