// §R4 — The Rewire Ceremony content (mirrors reconnect-ceremony-beats.ts). Pure + deterministic: builds the beat list
// from the member's own Rewire close data, so it's testable and the CeremonySurface just renders + interpolates. The
// culminating reveal at the END of Rewire: the Grinta move (the COMMITMENT COMPONENT, foregrounded — Jay's call, so
// the moment lands even when the composite barely twitches), the three Playbook tools revealed together, and Rebuild lit.

// The grinta reveal FOREGROUNDS the component (the commitment strand the member just built): its before→after + the
// component %. The composite is carried as a quiet "overall" — present, but not the number the moment leans on.
import { BADGE_BEAT_COPY, type BadgeRevealData } from './badge-reveal.ts';

export type RewireCeremonyReveal =
  | {
      kind: 'grinta';
      componentNow: number; // the commitment component's Ave2 (the 9-item mean) — the hero number
      componentBaseline: number | null; // Ave1 (the starting line)
      componentChangePct: number | null; // the COMPONENT movement, signed up-positive (grey on down, HH)
      direction: 'up' | 'down' | 'flat' | null;
      composite: number; // the overall Grinta Index — background/context
    }
  | { kind: 'playbook'; keepers: string[] } // the three tools (true lines · picture · protocol), already keepers
  | { kind: 'journey_rebuild' } // the 4Rs Journey — Rewire complete, Rebuild lit
  | { kind: 'badge'; name: string; badgeId: string }; // the earned milestone medal (redesign; Decision WW)

export type RewireCeremonyBeat = { text: string; small?: boolean; reveal?: RewireCeremonyReveal };

export type RewireCeremonyData = {
  grinta: {
    componentNow: number;
    componentBaseline: number | null;
    componentChangePct: number | null;
    direction: 'up' | 'down' | 'flat' | null;
    composite: number;
  } | null; // null until the Checkpoint moves it (no baseline / skipped → the flat framing, no number)
  keepers: string[]; // the W1 true line, the W2 image, the W3 protocol — in the member's own words
  badge?: BadgeRevealData | null; // the earned milestone medal — redesign only (Decision WW)
};

// ─────────────────────────────────────────────────────────────────────────────────────
// REWIRE CEREMONY COPY — Jay-approved (R4 doc), verbatim. The moving number is "your Grinta Index" member-facing; the
// science labels (Commitment/strand/component) stay basement. Down renders grey, never red (HH).
// ─────────────────────────────────────────────────────────────────────────────────────
export const REWIRE_CEREMONY_COPY = {
  up: "Before Rewire, you answered 6 questions. Then, the lies you caught, the picture you built, the protocol you wrote, impacted your answers when you revisited them at the end. That's real progress!",
  down: "Your Rewire reads a little lower than your starting line — and that's Rewire doing exactly what it should. You just named your mental traps and your false starts out loud; before, they ran in the dark, and now you see them. A number that dips right here means you're looking clearly. That's the ground the next Phase builds on.",
  flat: "Your Rewire held steady — a solid line to build from. The real move was Rewire itself — the tools you built. The climb comes as you use them.",
  playbook:
    "Here's what you're taking with you. Everything you built is in your Playbook: the true lines that answer your lies, the picture of where you're headed, and the protocol that turns a slip into a comeback. That's your kit — reach for it anytime.",
  // Fallback if somehow nothing was kept (edge case; voice-matched, not part of the approved verbatim).
  playbookEmpty: "Everything you build in Rewire lives in your Playbook — your kit, ready to reach for.",
  // PAST TENSE CONTRADICTED THE PROGRAM MODEL (Greg's walk, 2026-08-04). Rewire and Rebuild run in
  // PARALLEL, dosed per member — so "Rewire was" tells a member the mind work is finished and behind
  // them, which is not how the program works and not what we want them to believe on the way into
  // Rebuild. Greg's own correction, and it is right: both are for, neither is over.
  rebuild: 'Rewire is for the mind. Rebuild is for the body — where you take all of this and put it to work. When you’re ready.',
} as const;

export function buildRewireCeremonyBeats(d: RewireCeremonyData): RewireCeremonyBeat[] {
  const c = REWIRE_CEREMONY_COPY;
  const beats: RewireCeremonyBeat[] = [];
  // The Grinta move — branch on the COMPONENT delta (up/down/flat); revealed only when the Checkpoint captured it.
  if (d.grinta) {
    const text = d.grinta.direction === 'down' ? c.down : d.grinta.direction === 'up' ? c.up : c.flat;
    beats.push({ text, reveal: { kind: 'grinta', ...d.grinta } });
  } else {
    beats.push({ text: c.flat }); // no reading → the steady framing, no number to show
  }
  // The three tools, revealed together (already keepers — this just reveals them).
  beats.push(
    d.keepers.length > 0
      ? { text: c.playbook, reveal: { kind: 'playbook', keepers: d.keepers.slice(0, 3) } }
      : { text: c.playbookEmpty, small: true },
  );
  // Light Rebuild + the CTA.
  beats.push({ text: c.rebuild, reveal: { kind: 'journey_rebuild' } });
  if (d.badge) beats.push({ text: BADGE_BEAT_COPY, reveal: { kind: 'badge', name: d.badge.name, badgeId: d.badge.badgeId } });
  return beats;
}

export const REWIRE_CEREMONY_RESOLVE_LABEL = 'Start Rebuilding →';
