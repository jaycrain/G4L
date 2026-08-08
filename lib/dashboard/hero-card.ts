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
import { lastAccomplishment } from './last-accomplishment.ts';

const R_STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;

export type HeroCard = {
  eyebrow: string;
  /** The breadcrumb, structured rather than a joined string so the centre can style the first crumb as the
   *  anchor and the rest as position (Jay, 2026-08-08: "Program ... still needs to pay off and connect with
   *  the app"). Leading with "Program" makes the marketing word do in-product work as the FRAME a member is
   *  inside, which is also what stops it competing with the Playbook for the same job. eyebrow stays for the
   *  surfaces that haven't adopted crumbs. */
  crumbs: string[];
  /** The live state at the end of the trail ("Checkpoint ready"), kept SEPARATE from the crumbs rather than
   *  being "the last crumb". Styling the last crumb as the state highlighted the PHASE for anyone who had no
   *  state — Reconnect rendered in the state colour, saying nothing. A state is a different kind of thing from
   *  a position, so it gets its own field. */
  crumbState: string | null;
  title: string;
  copy: string;
  /** "You closed your practice week — 4 of the 5 you aimed for." The last thing they actually finished, shown
   *  under the title so the hero isn't purely forward-facing. Null for a member with nothing closed yet. */
  accomplishment: string | null;
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
  const [forecast, { state: heroState }, done] = await Promise.all([
    getForecast(db, memberId),
    resolveHero(db, memberId),
    lastAccomplishment(db, memberId),
  ]);
  const accomplishment = done?.text ?? null;

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

  // The breadcrumb: "Program › Reclaim › 3 of 4 sessions › Checkpoint ready". Always anchored on "Program" so the
  // word names the frame the member is inside. The state crumb is appended per-return below, since only the hero
  // state knows whether they're mid-week, checkpoint-ready, or simply next-up.
  const baseCrumbs = ['Program', phaseLabel, ...(sessionPosition ? [sessionPosition.replace(/^Session /, '')] : [])];

  // Practice-week split (Jay, 2026-07-22): the hero shows the next SESSION; the log becomes a Momentum-panel action.
  if (heroState.kind === 'mid-week-practice') {
    const momentumCta = { label: 'Log today with me →', href: `/momentum/${memberId}` };
    if (cur?.openable) {
      const isCheckpoint = cur.kind === 'checkpoint';
      return {
        eyebrow: `Phase ${phaseOrdinal} · ${phaseLabel}${sessionPosition ? ` · ${sessionPosition}` : ''}`,
        crumbs: baseCrumbs,
        crumbState: 'practice week running',
        title: cur.title,
        accomplishment,
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
      crumbs: baseCrumbs,
      crumbState: 'practice week running',
      title: 'Your week is running',
      accomplishment,
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
    crumbs: baseCrumbs,
    crumbState: ringSub === 'checkpoint' ? 'Checkpoint ready' : ringSub === 'coming' ? 'opens later' : null,
    title: hero.title,
    accomplishment,
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
