// §2f — The Reconnect Ceremony content (mirrors threshold-beats.ts). Pure + deterministic: builds the beat list from
// the member's own Reconnect data, so it's testable and the CeremonySurface just renders + interpolates. This is the
// culminating reveal at the END of the Reconnect arc — the awareness moment made whole: the doors seen, the baseline
// taken, the drift named, the spark found.
//
// REVEALS (Jay, §2f): the ID Score radar (baseline, §2c) · the Playbook (the §2d keepers) · the Door(s) (§2b) · the
// 4Rs Journey with REWIRE lit (Reconnect done → Rewire/Rebuild next).
// DEFERRED (hard): the Grinta / Hardiness reveal. §2e (the Checkpoint) hasn't captured it and the "Grinta Index"
// naming is unsettled (Jay + Greg, post-Monday) — so it is NOT revealed and NOT named anywhere in this copy. (Unlike
// the onboarding Threshold ceremony, which glosses Grinta — that line is deliberately absent here.)

import type { Dimensions } from './threshold-beats.ts';

export type ReconnectCeremonyReveal =
  | { kind: 'score'; idScore: number | null; dimensions: Dimensions | null } // the ID Score radar (the mirror)
  | { kind: 'playbook'; keepers: string[] } // the §2d keepers (the drift recognition + the spark)
  | { kind: 'doors'; doors: string[] } // the member's Door(s), as they stand after any re-seeing
  | { kind: 'journey_rewire' }; // the 4Rs Journey — Reconnect complete, Rewire lit

// This ceremony's own beat type — same shape as the Threshold's, but carrying the Reconnect reveals.
export type ReconnectCeremonyBeat = { text: string; small?: boolean; reveal?: ReconnectCeremonyReveal };

export type ReconnectCeremonyData = {
  idScore: number | null; // baseline ID Score (§2c) — the mirror; null if somehow uncaptured
  dimensions: Dimensions | null; // the four subscores (/30) for the radar shape
  keepers: string[]; // the §2d Playbook keepers, in the member's own words (drift recognition, the spark)
  doors: string[]; // display names, primary first (post-revision)
};

// ─────────────────────────────────────────────────────────────────────────────────────
// RECONNECT CEREMONY COPY — the only place to wordsmith the spoken lines. The structure (which beats carry a data
// reveal) is load-bearing; the copy interpolates the member's own data. NO Grinta/Hardiness language (deferred).
// ─────────────────────────────────────────────────────────────────────────────────────
export const RECONNECT_CEREMONY_COPY = {
  // 1 — lands alone
  stop: 'Stop for a second.',
  // 2 — honor the whole of the Reconnect work just done
  honor:
    'You just did the real work of Reconnect — you looked at the doors that opened the distance, took an honest read of where you stand, named what the drift cost, and found the version of you still worth chasing.',
  // 3 — reveal: the ID Score radar (the mirror, a starting point — never a grade)
  score: "Here's the mirror — where you're starting from. Not a grade. A place to push off from.",
  // 4 — reveal: the Playbook keepers (the member's own words)
  playbook: "And here's what you're keeping — in your own words, not a form's.",
  // 4b — fallback if nothing was kept (should be rare — the drift + spark usually land)
  playbookEmpty: 'Your Playbook is the record of what you find — and it fills from here.',
  // 5 — reveal: the Door(s), as they stand
  doors: 'These are the doors you named — and the ones you re-saw as the truer shape of it.',
  // 5b — fallback when no Door was ever tagged (a real-Fade member can route to none)
  doorsNone: 'You told the story of how the distance opened — in your words, not a label.',
  // 6 — reveal: the Journey, Rewire lit
  journey: "Here's the path ahead — your Journey. Reconnect is behind you now. Rewire and Rebuild light up next.",
  // 7 — the hand-off (no Grinta gloss here — that lives elsewhere, later)
  handoff: "That's the turn — from seeing it to changing it. Your first move ahead is a small one.",
} as const;

export function buildReconnectCeremonyBeats(d: ReconnectCeremonyData): ReconnectCeremonyBeat[] {
  const c = RECONNECT_CEREMONY_COPY;
  const beats: ReconnectCeremonyBeat[] = [
    { text: c.stop },
    { text: c.honor, small: true },
    { text: c.score, reveal: { kind: 'score', idScore: d.idScore, dimensions: d.dimensions } },
  ];
  // The Playbook keepers — the reveal only when something was actually kept (never an empty frame).
  beats.push(
    d.keepers.length > 0
      ? { text: c.playbook, reveal: { kind: 'playbook', keepers: d.keepers.slice(0, 3) } }
      : { text: c.playbookEmpty, small: true },
  );
  // The Door(s) — reveal only when one or more is tagged; else honor the story-in-their-words (a null Door is valid).
  beats.push(
    d.doors.length > 0
      ? { text: c.doors, reveal: { kind: 'doors', doors: d.doors } }
      : { text: c.doorsNone, small: true },
  );
  beats.push({ text: c.journey, reveal: { kind: 'journey_rewire' } });
  beats.push({ text: c.handoff });
  return beats;
}

export const RECONNECT_CEREMONY_RESOLVE_LABEL = 'Begin Rewire →';
