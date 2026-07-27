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

  switch (state.kind) {
    case 'resume':
      return {
        eyebrow: where(ctx.sessionPosition),
        title: state.session.label,
        copy: "You're partway into this one. Pick up where you left off — nothing's lost, we start from your last answer.",
        ctaLabel: 'Resume this Session',
      };
    case 'just-finished':
      return {
        eyebrow: `${ctx.phaseLabel} · You just finished`,
        title: `Nice work — ${state.session.label}`,
        copy: state.next
          ? state.next.isCheckpoint
            ? `That's ${state.session.label} done — you've walked the whole ${ctx.phaseLabel} phase. Next up: ${state.next.label}, whenever you're ready.`
            : `Great job completing ${state.session.label}. That was some hard work — take a break if you want, then pick back up here whenever you're ready. If you want to keep going, ${state.next.label} is next.`
          : `That's ${state.session.label} done. Take a breath — the next step will be here when you are.`,
        ctaLabel: state.next ? (state.next.isCheckpoint ? 'Take the Checkpoint' : 'Start the next Session') : 'Back to your path',
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
        title: 'You did it!',
        // Donna's Rewire edits (2026-07-26), generalized to the phase label so it's correct for every checkpoint.
        copy: `${ctx.phaseLabel} is some heavy stuff, and now you've walked the whole phase. You should see an uptick in your Grinta Index after this — you couldn't get through without demonstrating some grit. Let's see how it's going.`,
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
