// Read models for the dashboard shell — the curriculum forecast, the passport, and the identity
// strip — all derived from the registry (data) + the member's state. The renderer reads these; a new
// Session is a registry row that flows through here with zero renderer change.
import type { Db } from '../db/schema.ts';
import type { Asset, Badge } from './types.ts';
import { phaseColumns, dailyLayer, listBadges, getBadge, PHASE_ORDER } from './registry.ts';
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
  route?: string; // an exact CTA route (v2.3 conversational Rewire) — overrides the kind-default; '{memberId}' token
};
export type ForecastPhase = { phase: string; label: string; status: 'Complete' | "You're here" | 'Ahead'; items: ForecastItem[] };
export type Forecast = {
  phases: ForecastPhase[];
  // the lit step (the Open-this-Session / Cross-this-Checkpoint CTA). openable=false means it's the
  // next stop but not yet built ("coming soon") — so the companion knows not to send them to it.
  current: { id: string; title: string; summary: string; kind: Asset['kind']; openable: boolean; route?: string } | null;
  daily: { id: string; title: string; kind: Asset['kind'] }[];
};

// An asset is "openable" when it's actually built: an authored Session (has steps) or ANY Checkpoint
// (every phase resolves to its own crossable Checkpoint — the page + actions are phase-generic). Other
// kinds (measurement/pulse/tracker) are content-pending and render greyed until the daily-layer pass.
// ...or a route-backed conversational asset (v2.3 Rewire) — a real, reachable surface even without registry steps.
const isBuilt = (a: Asset): boolean => (a.kind === 'session' && !!a.steps?.length) || a.kind === 'checkpoint' || !!a.route;

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

  // An asset is done if its Session is closed, its Checkpoint's phase gate has passed, or its whole
  // phase is already behind the member (a phase you've crossed reads fully done — no pulling back).
  const isDone = (a: Asset): boolean =>
    closed.has(a.id) ||
    PHASE_ORDER.indexOf(a.phase) < activeIdx ||
    (a.kind === 'checkpoint' && gates.has(`${a.phase}_checkpoint_passed`));

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
        ...(a.route ? { route: a.route } : {}),
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
    current: currentAsset
      ? { id: currentAsset.id, title: currentAsset.title, summary: currentAsset.summary, kind: currentAsset.kind, openable: isBuilt(currentAsset), ...(currentAsset.route ? { route: currentAsset.route } : {}) }
      : null,
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

// The redesign's 16-milestone badges (Decision WW). Six earn via the existing wiring (checkpoints / reclaim-keep /
// RCN-EXC); the other ten earn HERE, reconciled idempotently from committed state so no arc-completion code is touched.
// Called at redesign dashboard load (behind REDESIGN → prod never runs it). earnBadge is idempotent (fires once).
const SESSION_BADGE: Record<string, string> = {
  'RWR-W1': 'turned-voice',
  'RWR-W2': 'built-picture',
  'RWR-W3': 'caught-real-time',
  'RBLD-B1': 'found-why',
  'RBLD-B2': 'honest-read',
  'RBLD-B3': 'week-noticing',
  'RCL-C2': 'widened-world',
  'RCL-C3': 'quality-days',
};
export async function reconcileRedesignBadges(db: Db, memberId: string): Promise<void> {
  try {
    const [closedArr, gatesArr] = await Promise.all([closedSessionIds(db, memberId), listGates(db, memberId)]);
    const closed = new Set(closedArr);
    const gates = new Set(gatesArr);
    const earn = (id: string) => earnBadge(db, memberId, id).catch(() => {});
    for (const [sid, bid] of Object.entries(SESSION_BADGE)) if (closed.has(sid)) await earn(bid);
    // "You named the Doors" is earned at ONBOARDING, where the Doors are named (Jay's walk) — not the Reconnect
    // checkpoint. Any member on the dashboard has finished onboarding; earn it once they've named at least one Door.
    const hasDoors =
      (await db.query('select 1 from member_door where member_id=$1 and removed_at is null limit 1', [memberId])).rows.length > 0 ||
      !!(await db.query<{ named_door: string | null }>('select named_door from member_profile where member_id=$1', [memberId])).rows[0]?.named_door;
    if (hasDoors) await earn('named-yourself'); // "You named the Doors"
    if (gates.has('reclaim_checkpoint_passed')) await earn('wrote-story'); // "You wrote your story" (the Transition)
    const idq = await db.query<{ one: number }>('select 1 as one from idq_retake where member_id=$1 limit 1', [memberId]);
    if (idq.rows.length) await earn('starting-line'); // "You met your starting line" — the first ID Score landed
  } catch {
    /* best-effort — a reconcile hiccup never blocks the dashboard */
  }
}

// Session-close badge acknowledgment (Jay's call): when a session that maps to a milestone completes, earn its badge
// and — ONLY if it was newly earned this moment — return its member-facing name so the Companion can name it in the
// hand-home ("And you just earned a badge: …"). Returns null when the session earns nothing, the badge isn't in the
// active set (legacy build), or it was already earned (no double-acknowledgment). Idempotent + best-effort by the caller.
export async function acknowledgeSessionBadge(db: Db, memberId: string, sessionId: string): Promise<{ id: string; name: string } | null> {
  const badgeId = SESSION_BADGE[sessionId];
  if (!badgeId) return null;
  const badge = getBadge(badgeId);
  if (!badge) return null; // not in the active (redesign) set → nothing to acknowledge
  const newlyEarned = await earnBadge(db, memberId, badgeId);
  return newlyEarned ? { id: badge.id, name: badge.name } : null;
}

export { PHASE_ORDER };
