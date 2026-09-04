// Read models for the dashboard shell — the curriculum forecast, the passport, and the identity
// strip — all derived from the registry (data) + the member's state. The renderer reads these; a new
// Session is a registry row that flows through here with zero renderer change.
import type { Db } from '../db/schema.ts';
import type { Asset, Badge } from './types.ts';
import { phaseColumns, dailyLayer, listBadges, getBadge, PHASE_ORDER, PHASE_GATE_BADGE } from './registry.ts';
import { closedSessionIds, listGates, earnedBadgeIds, listFacets, earnBadge, markSessionClosed } from './store.ts';
import { RECONNECT_SESSION_ASSETS } from '../workspace/session-key.ts';

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
/** The gate → badge map moved to the registry, because BOTH the eager award at the crossing (store.ts) and
 *  the backfill below now read it. Re-exported here so existing importers keep working. */
export { PHASE_GATE_BADGE };

const SESSION_BADGE: Record<string, string> = {
  'RWR-W1': 'turned-voice',
  'RWR-W2': 'built-picture',
  'RWR-W3': 'caught-real-time',
  'RBLD-B1': 'found-why',
  'RBLD-B2': 'honest-read',
  'RBLD-B3': 'week-noticing',
  'RCL-C2': 'widened-world',
  // 'RCL-C3' → 'quality-days' is DELIBERATELY not here: that badge earns when the member LOGS a quality day (living
  // the tracking week, in app/quality-day/actions.ts), not on the C3 definition close (Donna).
};
/**
 * RECONNECT SESSION CLOSES, RECONCILED FROM EVIDENCE.
 *
 * A Session close is bookkeeping, and bookkeeping can be missed; the WORK leaves durable traces that cannot be.
 * When the two disagree, the trace is right.
 *
 * This exists because of a real hole: R1 finishes ON its own stage (`complete = true`, stage unchanged) and the
 * close detector only watched for stage CHANGES, so every member who completed the Mirror before 2026-08-28 has
 * a scored baseline and no record of the Session. The forecast reads closed sessions to decide what is next, so
 * it kept offering them the Mirror they had just finished — a loop, and one that looks like the Session failing
 * rather than a missing row. (Jay's walk.)
 *
 * ONLY THE IDQ, and only from its own baseline. `idq_retake` at sequence_no 0 is written by R1 and by nothing
 * else, so its presence means R1 was worked. The other Sessions have no comparably exclusive trace — the Doors,
 * for instance, are named at ONBOARDING, so closing R2 on "this member has Doors" would mark a Session done that
 * they have never opened. A reconciliation that guesses is worse than the hole it fills.
 *
 * Idempotent (markSessionClosed upserts and emits session_close only on the first close) and best-effort.
 */
export async function reconcileReconnectCloses(db: Db, memberId: string): Promise<void> {
  try {
    const closed = new Set(await closedSessionIds(db, memberId));

    // 1 · THE MIRROR, from its own baseline. idq_retake at sequence_no 0 is written by R1 and by nothing else.
    if (!closed.has('RCN-IDQ')) {
      const hasBaseline =
        (await db.query('select 1 from idq_retake where member_id=$1 and sequence_no=0 limit 1', [memberId])).rows.length > 0;
      if (hasBaseline) {
        await markSessionClosed(db, memberId, 'RCN-IDQ');
        closed.add('RCN-IDQ');
      }
    }

    // 2 · A PARTLY-CLOSED SESSION IS A FINISHED SESSION. A Reconnect Session covers several curriculum rows and
    // closes them together, so a set with SOME rows closed and others open cannot be a member mid-Session — it is
    // the record of a Session that was worked while something was only closing part of it.
    //
    // Which is exactly what happened: until v3.5.22 the close marked RCN-EXC and left RCN-FDR open, so the
    // forecast lit "The Doors" for a member who had just finished it, underneath a line saying he had. The fix
    // only helps Sessions completed after it shipped; this repairs the ones already on record.
    //
    // Safe because it never invents work: a Session with NO rows closed is untouched, so a member who has not
    // reached R3 is not credited with it.
    for (const [key, assets] of Object.entries(RECONNECT_SESSION_ASSETS)) {
      if (key === 'checkpoint') continue; // an alias for r4 — closing it twice is just noise
      const anyClosed = assets.some((a) => closed.has(a));
      if (!anyClosed) continue;
      for (const a of assets) {
        if (closed.has(a)) continue;
        await markSessionClosed(db, memberId, a);
        closed.add(a);
      }
    }
  } catch (e) {
    // Best-effort: a member who cannot be reconciled still gets their dashboard.
    console.error(`[curriculum] could not reconcile Reconnect closes for ${memberId}:`, e);
  }
}

export async function reconcileRedesignBadges(db: Db, memberId: string): Promise<void> {
  try {
    const [closedArr, gatesArr] = await Promise.all([closedSessionIds(db, memberId), listGates(db, memberId)]);
    const closed = new Set(closedArr);
    const gates = new Set(gatesArr);
    // Per-badge, so one failure can't cost the member the rest of the run — but LOGGED, because a badge
    // that silently never lands is a milestone missing from their passport with nothing to explain it.
    const earn = (id: string) =>
      earnBadge(db, memberId, id).catch((e) => { console.error(`[badges] could not earn ${id} for ${memberId}:`, e); });
    for (const [sid, bid] of Object.entries(SESSION_BADGE)) if (closed.has(sid)) await earn(bid);
    // "You named the Doors" is earned at ONBOARDING, where the Doors are named (Jay's walk) — not the Reconnect
    // checkpoint. Any member on the dashboard has finished onboarding; earn it once they've named at least one Door.
    const hasDoors =
      (await db.query('select 1 from member_door where member_id=$1 and removed_at is null limit 1', [memberId])).rows.length > 0 ||
      !!(await db.query<{ named_door: string | null }>('select named_door from member_profile where member_id=$1', [memberId])).rows[0]?.named_door;
    if (hasDoors) await earn('named-yourself'); // "You named the Doors"
    if (gates.has('reclaim_checkpoint_passed')) await earn('wrote-story'); // "You wrote your story" (the Transition)

    // PHASE MILESTONES, AWARDED FROM THE GATE — one place, all four phases.
    //
    // Greg finished Rewire on 2026-08-02: the rewire_checkpoint_passed gate is set, all three Rewire session
    // badges are earned, and the Rewire phase badge is not. His screenshot shows it greyed, tagged "AHEAD",
    // captioned "You completed the second phase of the G4L program" — both states at once.
    //
    // WHY: each phase's conversational arc sets its own gate directly and bypasses the old checkpoint action,
    // which is where the registry's `earns:` used to be honoured. Reconnect got a hand-written fix for exactly
    // this and says so in its own comment ("the v2.2 arc bypasses the checkpoint action, so award it here").
    // Rewire, Rebuild and Reclaim never got the same patch — so THREE phase badges have never awarded for
    // anyone. A fix applied to one instance of a class, with the rest left behind.
    //
    // Driven off the gate rather than repeated in four arc actions: the gate is the fact that the member
    // crossed, it is already durable, and a new phase cannot now ship without its badge because adding the
    // gate to this map is the same edit as adding the phase.
    for (const [gate, badgeId] of Object.entries(PHASE_GATE_BADGE)) {
      if (gates.has(gate)) await earn(badgeId);
    }
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
