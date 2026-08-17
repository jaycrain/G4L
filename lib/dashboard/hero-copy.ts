// Redesign Layer 2 (D-02) — the HERO COPY composer. Turns the resolved HeroState (Layer 1) into the member-facing hero
// text: eyebrow (where you are), title, one warm line, and the CTA label. PURE + testable — no data access, no routing
// (the server component computes the href). Voice: plain, measured, normalizing (brand standards) — a doorway, never a
// pep-talk. The copy leans on the member's real position but never fabricates: every branch reads only what the state
// carries.

import type { HeroState } from './resume-hero.ts';

export type HeroView = { eyebrow: string; title: string; copy: string; ctaLabel: string };

export interface HeroContext {
  phaseLabel: string; // "Rewire"
  phaseOrdinal: number; // 1-based phase number (1..4)
  sessionPosition?: string | null; // "Session 2 of 3", when known
}

export function heroView(state: HeroState, ctx: HeroContext): HeroView {
  const where = (extra?: string | null) =>
    `Phase ${ctx.phaseOrdinal} · ${ctx.phaseLabel}${extra ? ` · ${extra}` : ''}`;
  // Rewire is Phase 2. Donna's Rewire edits (2026-07-26) gave Rewire its OWN hand-off + checkpoint copy — Jay: "it's
  // not meant for every Phase, Rewire is different." So those two beats branch on Rewire; every other phase keeps the
  // generic copy.
  const isRewire = ctx.phaseOrdinal === 2;

  switch (state.kind) {
    case 'resume':
      return {
        eyebrow: where(ctx.sessionPosition),
        title: state.session.label,
        copy: "You're partway into this one. Pick up where you left off — nothing's lost, we start from your last answer.",
        ctaLabel: 'Resume this Session',
      };
    case 'just-finished':
      // ORIENT FORWARD, NOT BACK (Donna, 2026-08-17): "As users move through sessions, this top banner should
      // orient them toward what's ahead, not recap what they just did." The headline named the session they had
      // finished and the body named it AGAIN before getting to what was next — three mentions of the past, one of
      // the future, on the surface whose whole job is the next step. The eyebrow still says "You just finished",
      // so the acknowledgment is not lost; it simply stops being the headline.
      return {
        eyebrow: `${ctx.phaseLabel} · You just finished`,
        title: state.next ? `Nice work — ${state.next.label} is next` : 'Nice work',
        copy: state.next
          ? state.next.isCheckpoint
            ? `You've walked the whole ${ctx.phaseLabel} phase. If you want to keep going, click the button.`
            : state.next.label === 'Quality Days'
              ? 'Quality Days is one of the most fulfilling exercises in the whole program. If you want to keep going, click the button.'
              : 'If you want to keep going, click the button.'
          : `Take a breath — the next step will be here when you are.`,
        // "Start the Session", not "Start the next Session": the subhead directly above now NAMES it, so "next"
        // is the only word in the sentence doing no work (Jay, 2026-08-11).
        ctaLabel: state.next ? (state.next.isCheckpoint ? 'Take the Checkpoint' : 'Start the Session') : 'Back to your path',
      };
    case 'reclaim-locked':
      return {
        eyebrow: 'Reclaim · Coming',
        title: 'Reclaim is coming',
        copy: state.reason,
        // Not a link — the dashboard renders this as a muted "opens" marker (no start button). The Loop opens it later.
        ctaLabel: state.opensOn ? `Opens ${state.opensOn}` : 'Opens when you’re ready',
      };
    case 'checkpoint-ready':
      return {
        eyebrow: `${ctx.phaseLabel} · Checkpoint ready`,
        // Rewire gets Donna's celebratory copy; other phases keep the generic checkpoint framing.
        title: isRewire ? 'You did it!' : `Your ${ctx.phaseLabel} Checkpoint`,
        copy: isRewire
          ? `${ctx.phaseLabel} is some heavy stuff, and now you've walked the whole phase. You should see an uptick in your Grinta Index after this — you couldn't get through without demonstrating some grit. Let's see how it's going.`
          : "You've walked the whole phase. This is where your Grinta moves — no studying, just an honest read.",
        ctaLabel: 'Take the Checkpoint',
      };
    case 'mid-week-practice':
      return {
        eyebrow: `${ctx.phaseLabel} · Day ${state.practice.day} of ${state.practice.total}`,
        title: state.practice.label,
        copy: 'A week of noticing — no grade, just catching what happened. How did today go?',
        ctaLabel: 'Log today with me',
      };
    case 'next-step':
      return {
        eyebrow: where(ctx.sessionPosition),
        title: state.session.label,
        copy: "Here's your next step. It's ready whenever you are — no rush.",
        ctaLabel: 'Open this Session',
      };
    case 'fresh':
      return {
        eyebrow: 'Reconnect · Start here',
        title: 'Reconnect',
        copy: 'This is where it starts — a short first conversation to see yourself clearly. No prep, just honesty.',
        ctaLabel: 'Begin',
      };
  }
}
