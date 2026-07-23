// The HERO CARD — the resolved resume/next-step, reduced to a small serializable object the Companion center renders as
// its lightly-guiding "start here" line (Jay: the hero belongs in the Companion's voice, where the member begins each
// session and feels the Companion). This centralizes the resolveHero → heroView → ctaHref derivation that the redesign
// dashboard computes inline, so the triptych doesn't fork a second copy. Server-only (touches the db); returns a plain
// object safe to pass to a client component.

import type { Db } from '../db/schema.ts';
import { getForecast } from '../curriculum/view.ts';
import { resolveHero } from './hero-signals.ts';
import { deriveRingState } from '../workspace/ring-state.ts';
import { heroView } from './hero-copy.ts';
import { keyFromForecast } from '../workspace/session-key.ts';
import { sessionsForPhase } from '../workspace/session-registry.ts';

// The four Grinta strands, in R order (matches redesign-dashboard's R_STRANDS).
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

  // Session position by the REDESIGN session model (see redesign-dashboard) — single-session phases omit the count.
  const cur = forecast.current;
  const wsKey = keyFromForecast(activePhase, cur ? { id: cur.id, route: cur.route, kind: cur.kind } : null);
  const phaseSessions = sessionsForPhase(activePhase).filter((s) => s.kind === 'session');
  const curSessionIdx = wsKey ? phaseSessions.findIndex((s) => s.id === wsKey) : -1;
  const sessionPosition =
    phaseSessions.length > 1 && curSessionIdx >= 0 ? `Session ${curSessionIdx + 1} of ${phaseSessions.length}` : null;

  const hero = heroView(heroState, { phaseLabel, phaseOrdinal, sessionPosition });

  // The CTA destination — the session runs in the workspace when the lit step maps to a key; practice → the log surface;
  // else the legacy route so a walk never dead-ends. reclaim-locked is a non-link marker (the Loop opens it later).
  const pathHref = wsKey
    ? `/workspace/${memberId}/${wsKey}`
    : cur?.openable
      ? cur.route
        ? cur.route.replace('{memberId}', memberId)
        : `/${cur.kind === 'checkpoint' ? 'checkpoint' : 'session'}/${memberId}/${cur.id}`
      : `/reconnect/${memberId}`;
  const ctaHref = heroState.kind === 'mid-week-practice' ? `/momentum/${memberId}` : pathHref;

  return {
    eyebrow: hero.eyebrow,
    title: hero.title,
    copy: hero.copy,
    ctaLabel: hero.ctaLabel,
    ctaHref: heroState.kind === 'reclaim-locked' ? null : ctaHref,
    kind: heroState.kind,
  };
}
