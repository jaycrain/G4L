// The Threshold ceremony content (see docs/ceremony-threshold.md). Pure: builds the beat list from
// the member's own data so it's deterministic and testable. Copy lives here as config — wordsmith
// freely. The CeremonySurface renders these; only the data interpolates.

export type ThresholdReveal =
  | { kind: 'uncovered'; identity: string | null; doors: string[]; winCount: number; idScore: number | null }
  | { kind: 'seeds'; seeds: string[] }
  | { kind: 'journey' };

export type CeremonyBeat = { text: string; small?: boolean; reveal?: ThresholdReveal };

export type ThresholdData = {
  identityNoun: string | null; // natural-case noun, e.g. "Athlete"
  doors: string[]; // display names
  winCount: number; // Reclaim List length
  idScore: number | null; // baseline ID Score
  seeds: string[]; // 2–3 onboarding-harvested Playbook lines
  firstMoveTitle: string | null; // the engine's real next Beat title (Q3a) — null → generic
};

export function buildThresholdBeats(d: ThresholdData): CeremonyBeat[] {
  const beats: CeremonyBeat[] = [
    { text: 'Stop for a second.' },
    {
      text: 'Most people never do that kind of excavation in a lifetime — and you just did it in one sitting.',
      small: true,
    },
    {
      text: "Here's what you uncovered:",
      reveal: { kind: 'uncovered', identity: d.identityNoun, doors: d.doors, winCount: d.winCount, idScore: d.idScore },
    },
  ];

  // Beat 4 — the seeds. Only reveal if the harvest produced any (older/seedless members skip the reveal).
  beats.push(
    d.seeds.length > 0
      ? { text: "These aren't answers to a form. They're the first pages of your Playbook.", reveal: { kind: 'seeds', seeds: d.seeds.slice(0, 3) } }
      : { text: "These aren't answers to a form. They're the start of your Playbook — the record of what's working, which fills as you go.", small: true },
  );

  beats.push({ text: "Here's the path ahead — your Journey.", reveal: { kind: 'journey' } });
  beats.push({
    text: 'Your Playbook fills in with what works for you as we go. That’s the thing you keep — it’s how the Grinta lasts.',
    small: true,
  });
  beats.push({
    text: d.firstMoveTitle
      ? `Ready to clip in? Your first move’s a small one — ${d.firstMoveTitle}.`
      : 'Ready to clip in? Your first move’s a small one.',
  });

  return beats;
}

export const THRESHOLD_RESOLVE_LABEL = 'Clip in →';
export const COMPANION_LABEL = 'Your G4L Companion';
