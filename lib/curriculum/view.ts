// Read models for the dashboard shell — the curriculum forecast, the passport, and the identity
// strip — all derived from the registry (data) + the member's state. The renderer reads these; a new
// Session is a registry row that flows through here with zero renderer change.
import type { Db } from '../db/schema.ts';
import type { Asset, Badge } from './types.ts';
import { phaseColumns, dailyLayer, listBadges, PHASE_ORDER } from './registry.ts';
import { closedSessionIds, listGates, earnedBadgeIds, listFacets, addFacet, earnBadge } from './store.ts';

const PHASE_LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };

export type ForecastItem = {
  id: string;
  title: string;
  kind: Asset['kind'];
  summary: string;
  state: 'done' | 'current' | 'up';
  openable: boolean; // is the asset actually built (authored Session / live Checkpoint)?
  hook?: string; // shown on the lit row
};
export type ForecastPhase = { phase: string; label: string; status: 'Complete' | "You're here" | 'Ahead'; items: ForecastItem[] };
export type Forecast = {
  phases: ForecastPhase[];
  current: { id: string; title: string; summary: string } | null; // the lit Session (the Open-this-Session CTA)
  daily: { id: string; title: string; kind: Asset['kind'] }[];
};

// An asset is "openable" when it's actually built: an authored Session (has steps) or — wired in
// Phase 5 — the Reconnect Checkpoint. Everything else is content-pending and renders greyed.
const isBuilt = (a: Asset): boolean => (a.kind === 'session' && !!a.steps?.length) || a.id === 'RCN-CHECK';

function activePhaseIndex(gates: Set<string>): number {
  let i = 0;
  if (gates.has('reconnect_checkpoint_passed')) i = 1;
  if (gates.has('rewire_checkpoint_passed')) i = 2;
  if (gates.has('rebuild_checkpoint_passed')) i = 3;
  return i;
}

export async function getForecast(db: Db, memberId: string): Promise<Forecast> {
  const [closedArr, gatesArr] = await Promise.all([closedSessionIds(db, memberId), listGates(db, memberId)]);
  const closed = new Set(closedArr);
  const gates = new Set(gatesArr);
  const activeIdx = activePhaseIndex(gates);

  // The lit Session: the first non-closed, BUILT asset, scanning phases in order. For the slice that's
  // Identity Excavation; after it closes, the Reconnect Checkpoint (once Phase 5 wires it).
  const flat = phaseColumns().flatMap((c) => c.items);
  const currentAsset = flat.find((a) => !closed.has(a.id) && isBuilt(a)) ?? null;

  const phases: ForecastPhase[] = phaseColumns().map((col, idx) => {
    const items: ForecastItem[] = col.items.map((a) => {
      const done = closed.has(a.id);
      const state: ForecastItem['state'] = done ? 'done' : currentAsset && a.id === currentAsset.id ? 'current' : 'up';
      return {
        id: a.id,
        title: a.title,
        kind: a.kind,
        summary: a.summary,
        state,
        openable: isBuilt(a),
        ...(state === 'current' ? { hook: a.summary } : {}),
      };
    });
    const allDone = items.length > 0 && items.every((i) => i.state === 'done');
    const hasCurrent = items.some((i) => i.state === 'current');
    const status: ForecastPhase['status'] = allDone ? 'Complete' : hasCurrent || idx <= activeIdx ? "You're here" : 'Ahead';
    return { phase: col.phase, label: PHASE_LABEL[col.phase] ?? col.phase, status, items };
  });

  return {
    phases,
    current: currentAsset ? { id: currentAsset.id, title: currentAsset.title, summary: currentAsset.summary } : null,
    daily: dailyLayer().map((a) => ({ id: a.id, title: a.title, kind: a.kind })),
  };
}

export type PassportView = { earned: number; total: number; badges: (Badge & { earned: boolean })[] };

export async function getPassport(db: Db, memberId: string): Promise<PassportView> {
  const earned = new Set(await earnedBadgeIds(db, memberId));
  // Known badges form the forward-map; surprise badges only appear once earned (uncounted until then).
  const badges = listBadges()
    .filter((b) => b.visibility === 'known' || earned.has(b.id))
    .map((b) => ({ ...b, earned: earned.has(b.id) }));
  return { earned: badges.filter((b) => b.earned).length, total: badges.length, badges };
}

/** Identity strip facets. Seeds the onboarding identity as facet #1 if the member has none yet. */
export async function getFacets(db: Db, memberId: string, identityNoun: string | null): Promise<string[]> {
  let facets = await listFacets(db, memberId);
  if (facets.length === 0 && identityNoun) {
    await addFacet(db, memberId, `the ${identityNoun}`);
    facets = await listFacets(db, memberId);
  }
  return facets.map((f) => f.text);
}

/** Reaching the dashboard means onboarding was completed — seed the Onboarding Courage badge. */
export async function ensureOnboardingBadge(db: Db, memberId: string): Promise<void> {
  await earnBadge(db, memberId, 'onboarding-courage');
}

export { PHASE_ORDER };
