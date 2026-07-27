// §B4 — The Rebuild Ceremony content (mirrors rewire-ceremony-beats.ts). Pure + deterministic: builds the beat list
// from the member's own Rebuild close data. The culminating reveal at the END of Rebuild: the Grinta move (the CONTROL
// COMPONENT, foregrounded — same as R4), the Playbook seeds (their why + their plan) revealed together, and Reclaim lit.

// The grinta reveal FOREGROUNDS the control component (the strand the member just built): before→after + the
// component %. The composite is carried as a quiet "overall". Identical shape to the Rewire reveal — down renders grey.
import { BADGE_BEAT_COPY, type BadgeRevealData } from './badge-reveal.ts';

export type RebuildCeremonyReveal =
  | {
      kind: 'grinta';
      componentNow: number; // the control component's Ave2 (the 9-item-equivalent mean) — the hero number
      componentBaseline: number | null; // Ave1 (the starting line)
      componentChangePct: number | null; // the COMPONENT movement, signed up-positive (grey on down, HH)
      direction: 'up' | 'down' | 'flat' | null;
      composite: number; // the overall Grinta Index — background/context
    }
  | { kind: 'playbook'; keepers: string[] } // their why + their plan, in their own words
  | { kind: 'journey_reclaim' } // the 4Rs Journey — Rebuild complete, Reclaim lit
  | { kind: 'badge'; name: string }; // the earned milestone medal (redesign; Decision WW)

export type RebuildCeremonyBeat = { text: string; small?: boolean; reveal?: RebuildCeremonyReveal };

export type RebuildCeremonyData = {
  grinta: {
    componentNow: number;
    componentBaseline: number | null;
    componentChangePct: number | null;
    direction: 'up' | 'down' | 'flat' | null;
    composite: number;
  } | null; // null until the Checkpoint moves it (no baseline → the flat framing, no number)
  keepers: string[]; // the pilot plan (and any why keeper) — in the member's own words
  badge?: BadgeRevealData | null; // the earned milestone medal — redesign only (Decision WW)
};

// ─────────────────────────────────────────────────────────────────────────────────────
// REBUILD CEREMONY COPY — B4 doc, verbatim. The moving number is "your Grinta Index" member-facing; the science
// labels (Control/strand/component) stay basement. Down renders grey, never red (HH). Names the Phase in every branch.
// ─────────────────────────────────────────────────────────────────────────────────────
export const REBUILD_CEREMONY_COPY = {
  up: "Look at that — your Rebuild just climbed. The control you built this Phase moved it up from where you started. The why you found, the skills you named, the pilot you ran — that's them, in the number.",
  down: "Your Rebuild reads a little lower than your starting line — and that's Rebuild doing exactly what it should. You looked honestly at your habits and your health decisions; before, they ran on autopilot, and now you see them. A number that dips right here means you're looking clearly. That's the ground the next Phase builds on.",
  flat: "Your Rebuild held steady — a solid line to build from. The real move was Rebuild itself — the habits you started. The climb comes as you keep them.",
  playbook:
    "Here's what you're taking with you. It's saved to your Playbook: your why (the reason under the work), and the plan you're running — the small changes you're building into real habits. That's your kit — reach for it anytime.",
  // Fallback if somehow nothing was kept (edge case; voice-matched, not part of the approved verbatim).
  playbookEmpty: "Everything you build in Rebuild lives in your Playbook — your kit, ready to reach for.",
  reclaim: 'Rebuild was the body. Reclaim is the bigger world — where all of this makes your life larger, not just healthier. When you’re ready.',
} as const;

export function buildRebuildCeremonyBeats(d: RebuildCeremonyData): RebuildCeremonyBeat[] {
  const c = REBUILD_CEREMONY_COPY;
  const beats: RebuildCeremonyBeat[] = [];
  // The Grinta move — branch on the COMPONENT delta (up/down/flat); revealed only when the Checkpoint captured it.
  if (d.grinta) {
    const text = d.grinta.direction === 'down' ? c.down : d.grinta.direction === 'up' ? c.up : c.flat;
    beats.push({ text, reveal: { kind: 'grinta', ...d.grinta } });
  } else {
    beats.push({ text: c.flat }); // no reading → the steady framing, no number to show
  }
  // The Playbook seeds — their why + their plan, revealed together (already keepers — this just reveals them).
  beats.push(
    d.keepers.length > 0
      ? { text: c.playbook, reveal: { kind: 'playbook', keepers: d.keepers.slice(0, 3) } }
      : { text: c.playbookEmpty, small: true },
  );
  // Light Reclaim + the CTA.
  beats.push({ text: c.reclaim, reveal: { kind: 'journey_reclaim' } });
  if (d.badge) beats.push({ text: BADGE_BEAT_COPY, reveal: { kind: 'badge', name: d.badge.name } });
  return beats;
}

export const REBUILD_CEREMONY_RESOLVE_LABEL = 'Start Reclaiming →';
