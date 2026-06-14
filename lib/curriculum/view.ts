// Read models for the dashboard shell — the curriculum forecast, the passport, and the identity
// strip — all derived from the registry (data) + the member's state. The renderer reads these; a new
// Session is a registry row that flows through here with zero renderer change.
import type { Db } from '../db/schema.ts';
import type { Asset, Badge } from './types.ts';
import { phaseColumns, dailyLayer, listBadges, PHASE_ORDER } from './registry.ts';
import { closedSessionIds, listGates, earnedBadgeIds, listFacets, earnBadge } from './store.ts';

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

  // An asset is done if its Session is closed, or — for a Checkpoint — its phase gate has passed.
  const isDone = (a: Asset): boolean => closed.has(a.id) || (a.kind === 'checkpoint' && gates.has(`${a.phase}_checkpoint_passed`));

  // The lit asset: the first non-done BUILT asset (authored Session or the Reconnect Checkpoint). If
  // none remain built (e.g. just passed Reconnect, next Rewire Session not authored yet), fall back to
  // the first non-done asset in the active phase so the path still shows the next stop ("coming soon").
  const flat = phaseColumns().flatMap((c) => c.items);
  const currentAsset =
    flat.find((a) => !isDone(a) && isBuilt(a)) ??
    flat.find((a) => !isDone(a) && PHASE_ORDER.indexOf(a.phase) === activeIdx) ??
    null;

  const phases: ForecastPhase[] = phaseColumns().map((col, idx) => {
    const items: ForecastItem[] = col.items.map((a) => {
      const done = isDone(a);
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
    // Phase progression is gate-driven (not every Session is authored in the slice): phases before the
    // active index read Complete, the active phase "You're here", the rest Ahead.
    const status: ForecastPhase['status'] = idx < activeIdx ? 'Complete' : idx === activeIdx ? "You're here" : 'Ahead';
    return { phase: col.phase, label: PHASE_LABEL[col.phase] ?? col.phase, status, items };
  });

  return {
    phases,
    current: currentAsset ? { id: currentAsset.id, title: currentAsset.title, summary: currentAsset.summary } : null,
    daily: dailyLayer().map((a) => ({ id: a.id, title: a.title, kind: a.kind })),
  };
}

export type PassportView = { earned: number; total: number; badges: (Badge & { earned: boolean })[]; placeholders: number };

// The passport's forward-map size — what the full collection grows to. The grid always shows this
// many slots so the member can see how much there is to earn; real badges (defined in the registry)
// fill in, the rest are anonymous greyed slots until they're authored.
const PASSPORT_TOTAL = 16;

export async function getPassport(db: Db, memberId: string): Promise<PassportView> {
  const earnedSet = new Set(await earnedBadgeIds(db, memberId));
  // Known badges form the forward-map; surprise badges only appear once earned (uncounted until then).
  const badges = listBadges()
    .filter((b) => b.visibility === 'known' || earnedSet.has(b.id))
    .map((b) => ({ ...b, earned: earnedSet.has(b.id) }));
  return {
    earned: badges.filter((b) => b.earned).length,
    total: PASSPORT_TOTAL,
    badges,
    placeholders: Math.max(0, PASSPORT_TOTAL - badges.length),
  };
}

/** Identity strip facets — the reclaimed selves the member has NAMED (Identity Excavation onward).
 * Not seeded from onboarding: in v0.4 the identity is named through the work, so the strip fills as
 * Sessions place facets. The dashboard falls back to a gentle prompt when there are none yet. */
export async function getFacets(db: Db, memberId: string): Promise<string[]> {
  return (await listFacets(db, memberId)).map((f) => f.text);
}

/** Reaching the dashboard means onboarding was completed — seed the Onboarding Courage badge. */
export async function ensureOnboardingBadge(db: Db, memberId: string): Promise<void> {
  await earnBadge(db, memberId, 'onboarding-courage');
}

export { PHASE_ORDER };
