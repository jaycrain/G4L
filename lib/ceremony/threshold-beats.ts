// The Threshold ceremony content (see docs/ceremony-threshold.md). Pure: builds the beat list from
// the member's own data so it's deterministic and testable. Copy lives here as config — wordsmith
// freely. The CeremonySurface renders these; only the data interpolates.

export type Dimensions = { physical: number; self: number; social: number; outlook: number };
export type ThresholdReveal =
  | { kind: 'uncovered'; identity: string | null; doors: string[]; reclaimItems: string[]; idScore: number | null; dimensions: Dimensions | null }
  | { kind: 'seeds'; seeds: string[] }
  | { kind: 'journey' };

export type CeremonyBeat = { text: string; small?: boolean; reveal?: ThresholdReveal };

export type ThresholdData = {
  identityNoun: string | null; // natural-case noun, e.g. "Athlete"
  doors: string[]; // display names
  // THE ITEMS, NOT A COUNT (Cowork + Jay, 2026-08-14). This was `winCount: number`, and the card rendered
  // "3 on your Reclaim List" — a tally standing in front of the three things the member actually said they
  // want back, on the one beat whose whole job is to hand them their goals. A count is also a second copy of
  // a fact we already hold; anything that needs the number reads reclaimItems.length.
  reclaimItems: string[]; // the Reclaim List, in the member's own words
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
  honor: 'Most people never do that kind of excavation in a lifetime. You just did it in one sitting.',
  // 3 — reveal: the Reclaimed Identity, Door(s), "N to win back", baseline ID Score
  // "found", not "uncovered" — Part 3 of the walk is called "What you found", and the beat that opens it should
  // use the same word the member just read at the top of it.
  uncovered: "Here's what you found:",
  // 4a — reveal: 2–3 harvested Playbook lines (when the onboarding harvest produced seeds)
  playbookSeeded: 'Your first pages are written.',
  // 4b — fallback when there are no seeds yet (no empty Playbook frame)
  playbookNoSeeds:
    "These aren't answers to a form. They're the start of your Playbook — the record of what's working, which fills as you go.",
  // 5 — reveal: the 4Rs (Reconnect lit). The line is now a plain "get to work" transition (the standalone Journey
  //     panel is merged into the Companion center — Jay 2026-07-26), reordered AFTER the Playbook beat below.
  // The doc's version ends "…and that's where we're headed now." Dropped: the ceremony already runs ON the
  // dashboard, so narrating a journey to where they are standing reads as filler.
  journey: 'Your Comeback starts with Reconnect — your first Session’s ready whenever you are.',
  // 6 — the Playbook, described plainly. Reordered to run BEFORE the "get to work" beat (Donna's Reconnect edits).
  lasts:
    'Your answers, in your own words, filled the first pages of your Playbook. From here it keeps building itself — ' +
    'everything worth keeping lands there, ready when you need it. It’s uniquely yours.',
  // 7 — the hand-off. THIS BEAT NO LONGER EXPLAINS "clip in" (Cowork + Jay, 2026-08-14).
  //
  // The word stays everywhere — the daily clip-in, the clip-back-in move, the Grinta lines, the closer. What was
  // wrong was teaching it HERE. This is the threshold: the beat where a member steps through. Stopping to gloss a
  // cycling metaphor at the moment of commitment breaks the moment to run a footnote. It is now defined once,
  // upstream, on the "A few words you'll hear" language screen — where they are still learning the vocabulary and
  // nothing is being asked of them yet — and the button below it reads "Clip in →". Downstream just USES the word.
  //
  // CONFIRMED BY JAY, 2026-08-14. Cowork drafted this line and marked it "Jay to confirm"; it shipped ahead of
  // that sign-off and was the one unconfirmed string in the batch. It is now settled copy — treat it like any
  // other authored line, and quotable as canon.
  clipIn: 'This is where it starts — a commitment to get going, and keep going.',
  // Donna dropped the per-member "first move" tail; keep the signature so callers don't change, ignore the arg.
  clipInWithMove: (_firstMove: string) => 'This is where it starts — a commitment to get going, and keep going.',
} as const;

export function buildThresholdBeats(d: ThresholdData): CeremonyBeat[] {
  const c = THRESHOLD_COPY;
  return [
    { text: c.stop },
    { text: c.honor, small: true },
    { text: c.uncovered, reveal: { kind: 'uncovered', identity: d.identityNoun, doors: d.doors, reclaimItems: d.reclaimItems, idScore: d.idScore, dimensions: d.dimensions } },
    // Beat 4 — seeds reveal only if the harvest produced any; otherwise the softer no-seeds line.
    d.seeds.length > 0
      ? { text: c.playbookSeeded, reveal: { kind: 'seeds', seeds: d.seeds.slice(0, 3) } }
      : { text: c.playbookNoSeeds, small: true },
    // Reordered (Donna's Reconnect edits): the Playbook beat runs 5th, then the "get to work → Reconnect" beat 6th.
    { text: c.lasts, small: true },
    { text: c.journey, reveal: { kind: 'journey' } },
    { text: d.firstMoveTitle ? c.clipInWithMove(d.firstMoveTitle) : c.clipIn },
  ];
}

export const THRESHOLD_RESOLVE_LABEL = 'Clip in →';
export const COMPANION_LABEL = 'Your G4L Companion';
