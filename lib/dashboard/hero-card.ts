// The HERO CARD — the resolved resume/next-step reduced to a serializable object the navy Companion center renders as its
// hero (Jay: the center IS the navy hero, the current design brought into the triptych — headline + guiding line + CTA +
// the merged 4R ring, which is the phase/progress indicator, same grammar as the bullseye logo). Centralizes the
// resolveHero → heroView → ctaHref + ring derivation the redesign dashboard computes inline. Server-only; returns a plain
// object safe to pass to a client component.

import type { Db } from '../db/schema.ts';
import type { RingPhaseState } from '../workspace/ring-state.ts';
import { getForecast } from '../curriculum/view.ts';
import { resolveHero } from './hero-signals.ts';
import { deriveRingState } from '../workspace/ring-state.ts';
import { heroView } from './hero-copy.ts';
import { keyFromForecast } from '../workspace/session-key.ts';
import { sessionsForPhase } from '../workspace/session-registry.ts';

const R_STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;

export type HeroCard = {
  eyebrow: string;
  title: string;
  copy: string;
  ctaLabel: string;
  ctaHref: string | null; // null when the state is a non-link (reclaim-locked "opens…" marker)
  kind: string;
  // The merged 4R ring — phase + progress (same grammar as the bullseye logo). Rendered onDark in the navy center.
  rings: RingPhaseState[];
  ringTop: string; // e.g. "Rewire"
  ringSub: string | null; // e.g. "2 of 3" / "checkpoint" / "coming"
  // A practice week is a Momentum action, not the hero — when one is active the hero shows the NEXT SESSION (above) and
  // "Log today with me →" moves to the Momentum panel (Jay, 2026-07-22). null unless a practice week is active.
  momentumCta: { label: string; href: string } | null;
};

export async function heroCard(db: Db, memberId: string): Promise<HeroCard> {
  const [forecast, { state: heroState }] = await Promise.all([
    getForecast(db, memberId),
    resolveHero(db, memberId),
  ]);

  const rings = deriveRingState(forecast, heroState.kind === 'reclaim-locked' ? 'reclaim' : undefined);
  const activeRing = rings.find((r) => r.state === 'current') ?? rings.find((r) => r.state === 'locked') ?? rings[0]!;
  const activePhase = activeRing.phase;
  const phaseOrdinal = R_STRANDS.findIndex((r) => r.key === activePhase) + 1 || 1;
  const phaseLabel = R_STRANDS[phaseOrdinal - 1]!.label;

  const cur = forecast.current;
  const wsKey = keyFromForecast(activePhase, cur ? { id: cur.id, route: cur.route, kind: cur.kind } : null);
  const phaseSessions = sessionsForPhase(activePhase).filter((s) => s.kind === 'session');
  const curSessionIdx = wsKey ? phaseSessions.findIndex((s) => s.id === wsKey) : -1;
  const sessionPosition =
    phaseSessions.length > 1 && curSessionIdx >= 0 ? `Session ${curSessionIdx + 1} of ${phaseSessions.length}` : null;

  // The CTA destination — session runs in the workspace when the lit step maps to a key; else the legacy route so a walk
  // never dead-ends. reclaim-locked is a non-link marker (the Loop opens it later).
  const pathHref = wsKey
    ? `/workspace/${memberId}/${wsKey}`
    : cur?.openable
      ? cur.route
        ? cur.route.replace('{memberId}', memberId)
        : `/${cur.kind === 'checkpoint' ? 'checkpoint' : 'session'}/${memberId}/${cur.id}`
      : `/reconnect/${memberId}`;

  // Ring center reads PROGRESS, not the pointer (finishing 2nd of 3 shows "2 of 3", never "3 of 3").
  const ringSub =
    heroState.kind === 'checkpoint-ready'
      ? 'checkpoint'
      : heroState.kind === 'reclaim-locked'
        ? 'coming'
        : phaseSessions.length > 1
          ? `${Math.min(activeRing.done, phaseSessions.length)} of ${phaseSessions.length}`
          : null;

  // Practice-week split (Jay, 2026-07-22): the hero shows the next SESSION; the log becomes a Momentum-panel action.
  if (heroState.kind === 'mid-week-practice') {
    const momentumCta = { label: 'Log today with me →', href: `/momentum/${memberId}` };
    if (cur?.openable) {
      const isCheckpoint = cur.kind === 'checkpoint';
      return {
        eyebrow: `Phase ${phaseOrdinal} · ${phaseLabel}${sessionPosition ? ` · ${sessionPosition}` : ''}`,
        title: cur.title,
        copy: "Here's your next step, ready whenever you are. You're mid-week on your practice — keep logging as you go.",
        ctaLabel: isCheckpoint ? 'Take the Checkpoint' : 'Open this Session',
        ctaHref: pathHref,
        kind: 'mid-week-practice',
        rings,
        ringTop: phaseLabel,
        ringSub,
        momentumCta,
      };
    }
    // No openable next step yet (waiting out the week) — a soft forward line, log still on Momentum.
    return {
      eyebrow: `Phase ${phaseOrdinal} · ${phaseLabel}`,
      title: 'Your week is running',
      copy: 'Keep noticing what happens — no grade, just catching it. Your next step opens as the week completes.',
      ctaLabel: 'See the Program',
      ctaHref: `/program/${memberId}`,
      kind: 'mid-week-practice',
      rings,
      ringTop: phaseLabel,
      ringSub,
      momentumCta,
    };
  }

  const hero = heroView(heroState, { phaseLabel, phaseOrdinal, sessionPosition });
  return {
    eyebrow: hero.eyebrow,
    title: hero.title,
    copy: hero.copy,
    ctaLabel: hero.ctaLabel,
    ctaHref: heroState.kind === 'reclaim-locked' ? null : pathHref,
    kind: heroState.kind,
    rings,
    ringTop: phaseLabel,
    ringSub,
    momentumCta: null,
  };
}
