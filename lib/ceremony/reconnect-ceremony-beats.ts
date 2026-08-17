// §2f — The Reconnect Ceremony content (mirrors threshold-beats.ts). Pure + deterministic: builds the beat list from
// the member's own Reconnect data, so it's testable and the CeremonySurface just renders + interpolates. This is the
// culminating reveal at the END of the Reconnect arc — the awareness moment made whole: the doors seen, the baseline
// taken, the drift named, the spark found.
//
// REVEALS (Jay, §2f): the ID Score radar (baseline, §2c) · the GRINTA MOVEMENT (§2e — the first time grit moves) · the
// Playbook (the §2d keepers) · the Door(s) (§2b) · the 4Rs Journey with REWIRE lit (Reconnect done → Rewire/Rebuild).
// The Grinta reveal appears ONLY when a Checkpoint reading exists (the movement actually happened); otherwise the beat
// is skipped (a v1-onboarded member with no baseline, or a skipped Checkpoint, never sees an empty frame).

import type { Dimensions } from './threshold-beats.ts';
import { BADGE_BEAT_COPY, type BadgeRevealData } from './badge-reveal.ts';

export type ReconnectCeremonyReveal =
  | { kind: 'score'; idScore: number | null; dimensions: Dimensions | null } // the ID Score radar (the mirror)
  | { kind: 'grinta'; composite: number; changePct: number | null; direction: 'up' | 'down' | 'flat' | null; reconnect: number; reconnectChangePct: number | null } // §2e — the Index (headline) moved BY Reconnect (the driver)
  | { kind: 'playbook'; keepers: string[] } // the §2d keepers (the drift recognition + the spark)
  | { kind: 'doors'; doors: string[] } // the member's Door(s), as they stand after any re-seeing
  | { kind: 'journey_rewire' } // the 4Rs Journey — Reconnect complete, Rewire lit
  | { kind: 'badge'; name: string; badgeId: string }; // the earned milestone medal (redesign; Decision WW)

export type GrintaStrands = { reconnect?: number; rewire?: number; rebuild?: number; reclaim?: number };

// This ceremony's own beat type — same shape as the Threshold's, but carrying the Reconnect reveals.
export type ReconnectCeremonyBeat = { text: string; small?: boolean; reveal?: ReconnectCeremonyReveal };

export type ReconnectCeremonyData = {
  idScore: number | null; // baseline ID Score (§2c) — the mirror; null if somehow uncaptured
  dimensions: Dimensions | null; // the four subscores (/30) for the radar shape
  grinta: { composite: number; changePct: number | null; direction: 'up' | 'down' | 'flat' | null; reconnect: number; reconnectChangePct: number | null } | null; // §2e — null until a Checkpoint moves it
  keepers: string[]; // the §2d Playbook keepers, in the member's own words (drift recognition, the spark)
  doors: string[]; // display names, primary first (post-revision)
  badge?: BadgeRevealData | null; // the earned milestone medal — set only in the redesign (Decision WW)
};

// ─────────────────────────────────────────────────────────────────────────────────────
// RECONNECT CEREMONY COPY — the only place to wordsmith the spoken lines. The structure (which beats carry a data
// reveal) is load-bearing; the copy interpolates the member's own data. NO Grinta/Hardiness language (deferred).
// ─────────────────────────────────────────────────────────────────────────────────────
// Jay's voice, APPROVED — use verbatim. Still Grinta-free (deferred).
export const RECONNECT_CEREMONY_COPY = {
  // 1 — honor the work
  honor: 'Way to step up. Most people spend a lifetime avoiding looking that closely at themselves.',
  // 2 — name what they just did
  measured: 'You measured the distance to reclaim yourself, and you took the first step toward closing it.',
  // 3 — reveal: the ID Score radar (the starting line)
  score: 'Here it is, by the numbers — your starting line.',
  // 3b — reveal: the Grinta movement (§2e). Branches on the Checkpoint delta — a DOWN-move is expected and healthy
  // (per Greg: a more realistic self-appraisal often reads LOWER; the reflection matters more than the number), so it
  // must never read as failure. Jay's lines, approved.
  grinta: 'You just did the work in Reconnect — and your Grinta, your grit, went up because of it.',
  grintaDown:
    "You just did the work in Reconnect — the kind of excavation most people never do. Your Grinta reads a little lower than your starting line. That is what a clearer look does to a first estimate, and it is the foundation everything else builds on.",
  grintaFlat:
    'You just did the work in Reconnect. Your Grinta held steady — a solid line to build from. The real move was the excavation itself; the climb comes as you keep going.',
  // 4 — reveal: the Playbook keepers (their own words)
  playbook: 'And these are your words — the ones that begin to frame the way forward.',
  // 4b — fallback if nothing was kept (voice-matched; edge case, not part of the approved verbatim)
  playbookEmpty: 'Your words will begin to frame the way forward — your Playbook fills from here.',
  // 5 — reveal: the Door(s)
  doors:
    "These are the Doors you came through — the ones you first named, and what you saw when you dug deeper. They don't get to play in the dark anymore.",
  // 5b — fallback when no Door was ever tagged (a real-Fade member can route to none)
  doorsNone: 'You told the story of how the distance opened — in your words, no label needed.',
  // 6 — reveal: the Journey, Rewire lit
  journey: "And this is the road. Reconnect — the seeing — is behind you. Rewire is next: it's where seeing turns into changing.",
  // 7 — the hand-off (no Grinta gloss — deferred)
  handoff:
    "You've done the hard part — the brutal honesty. Now comes the part where you start taking back the real you. A new way of thinking and believing that leads to that change. Rewiring your brain.",
} as const;

export function buildReconnectCeremonyBeats(d: ReconnectCeremonyData): ReconnectCeremonyBeat[] {
  const c = RECONNECT_CEREMONY_COPY;
  const beats: ReconnectCeremonyBeat[] = [
    { text: c.honor },
    { text: c.measured, small: true },
    { text: c.score, reveal: { kind: 'score', idScore: d.idScore, dimensions: d.dimensions } },
  ];
  // The Grinta movement — revealed ONLY when a Checkpoint captured it (the first movement actually happened).
  if (d.grinta) {
    // Branch the spoken line on the delta sign: up = grew, down = clearer-seeing (never failure), flat/null = held.
    const grintaText = d.grinta.direction === 'down' ? c.grintaDown : d.grinta.direction === 'up' ? c.grinta : c.grintaFlat;
    beats.push({ text: grintaText, reveal: { kind: 'grinta', composite: d.grinta.composite, changePct: d.grinta.changePct, direction: d.grinta.direction, reconnect: d.grinta.reconnect, reconnectChangePct: d.grinta.reconnectChangePct } });
  }
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
  // The climax (redesign): the earned milestone medal, right before the hand-off.
  if (d.badge) beats.push({ text: BADGE_BEAT_COPY, reveal: { kind: 'badge', name: d.badge.name, badgeId: d.badge.badgeId } });
  beats.push({ text: c.handoff });
  return beats;
}

export const RECONNECT_CEREMONY_RESOLVE_LABEL = 'Start Rewiring →';
