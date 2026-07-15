// Beat engine — DB layer. Assembles member state for the engine, serves a Beat (binding its goal
// item and stamping last_served_at so selection rotates), and records a close (persisting the
// Grinta component flags and advancing the served Reclaim item's state machine).

import type { Db } from '../db/schema.ts';
import { allBeats, beatById, isCategory, type Beat, type Category, type CloseType, type RGroup, type Rhythm } from './registry.ts';
import { isVagueReclaim } from './category.ts';
import { isReady } from './readiness.ts';
import { selectNextBeat } from './select.ts';
import { bindGoalItem, effectiveCloseType, renderClose } from './serves.ts';
import { resolveClose } from './close.ts';
import { RECLAIMED_THRESHOLD, type MemberBeatState, type ReclaimItem } from './types.ts';
import { listMeasures, measureMoving } from '../measure/store.ts';

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  const t = d.getTime();
  return Number.isNaN(t) ? null : d.toISOString();
};

export async function getReclaimItems(db: Db, memberId: string): Promise<ReclaimItem[]> {
  const { rows } = await db.query<any>(
    `select id, text, category, rhythm, state, closer_count, sort_order, last_served_at, tier
     from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at`,
    [memberId],
  );
  const seen = new Set<string>();
  return rows
    .map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category as Category,
      rhythm: r.rhythm as Rhythm,
      state: r.state,
      closerCount: Number(r.closer_count ?? 0),
      sortOrder: Number(r.sort_order ?? 0),
      lastServedAt: toIso(r.last_served_at),
      tier: (r.tier as string | null) ?? null,
    }))
    // Collapse exact-text duplicates (e.g. a C1 refinement that merged two items into the same wording) — keep the
    // first (lowest sort_order), so no surface ever renders the same item twice. Data isn't mutated; the row lingers
    // harmlessly, just not shown twice.
    .filter((i) => {
      const key = (i.text ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The member's LIVE Reclaim List as text[], resilient to reclaim_item drift (W-29): try the categorized rows, and if
 *  they're empty OR unreadable (e.g. a prod-drifted DB missing the `tier`/`removed_at` columns → getReclaimItems
 *  throws), fall back to the legacy `member_profile.reclaim_list` jsonb — the SAME degrade the dashboard does. So the
 *  member's committed list is NEVER shown as empty when items actually exist. This is the single LIVE source C1's Step-2
 *  refinement reads + writes back to — never a parallel/stale/empty list (the reclaim-c1-step2 data contract). */
export async function liveReclaimTexts(db: Db, memberId: string): Promise<string[]> {
  const rows = await getReclaimItems(db, memberId).catch(() => [] as ReclaimItem[]);
  const fromRows = rows.map((i) => (i.text ?? '').trim()).filter(Boolean);
  if (fromRows.length) return fromRows;
  const jsonb = await db
    .query<{ reclaim_list: unknown }>('select reclaim_list from member_profile where member_id=$1', [memberId])
    .then((r) => r.rows[0]?.reclaim_list)
    .catch(() => null);
  return Array.isArray(jsonb) ? (jsonb as unknown[]).map((s) => String(s ?? '').trim()).filter(Boolean) : [];
}

// Reconnect Beats whose work the onboarding conversation + IDQ already do (the gateway is the
// compressed Reconnect). Seeded as completed on IDQ baseline so the dashboard Beat surface opens at
// genuinely-next work instead of re-asking the member to name their identity or rebuild their list.
const ONBOARDING_COVERED_BEATS = [
  'RCN-IDQ-01', 'RCN-IDQ-02', // the IDQ itself
  'RCN-FDR-01', 'RCN-FDR-02', 'RCN-FDR-03', // the Doors
  'RCN-EXC-04', // naming the Reclaimed Identity
  'RCN-WIN-03', 'RCN-WIN-04', // building + sharpening the Reclaim List
];

/** Seed the onboarding-covered Reconnect Beats as completed (idempotent). Feeds Consistency. */
export async function seedOnboardingBeats(db: Db, memberId: string): Promise<void> {
  for (const id of ONBOARDING_COVERED_BEATS) {
    await db.query(
      `insert into beat_completion (member_id, beat_id, close_type, close_response, feeds_consistency)
       select $1,$2,'reflect','onboarding',false
       where not exists (select 1 from beat_completion where member_id=$1 and beat_id=$2)`,
      [memberId, id],
    );
  }
}

/** Insert categorized Reclaim items (onboarding + test seeding). Appends after any existing. */
export async function addReclaimItems(
  db: Db,
  memberId: string,
  items: { text: string; category: Category; rhythm?: Rhythm }[],
): Promise<void> {
  const base = (
    await db.query<{ n: number }>('select count(*)::int n from reclaim_item where member_id=$1', [memberId])
  ).rows[0]!.n;
  for (let i = 0; i < items.length; i++) {
    await db.query(
      `insert into reclaim_item (member_id, text, category, rhythm, sort_order)
       values ($1,$2,$3,$4,$5)`,
      [memberId, items[i]!.text, items[i]!.category, items[i]!.rhythm ?? 'weekly', base + i],
    );
  }
}

/**
 * Mark a Reclaim item reclaimed by a member's text reference — the companion-only path (life items'
 * only advancement; also honors a member's clear "it's done" for any item). Sets state=reclaimed and
 * records a marker beat_completion so it counts as program activity / Reach like a real close — that
 * marker (close_response='self_marked') is hidden from Past Beats. Idempotent. See docs/reclaim-anygoal.md.
 */
export async function markReclaimReclaimedByText(
  db: Db,
  memberId: string,
  query: string,
): Promise<{ ok: boolean; text?: string; reason?: 'nomatch' | 'empty' }> {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return { ok: false, reason: 'empty' };
  const rows = (
    await db.query<{ id: string; text: string; state: string }>(
      'select id, text, state from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
  ).rows;
  const norm = (s: string) => s.trim().toLowerCase();
  const match =
    rows.find((r) => norm(r.text) === q) ?? rows.find((r) => norm(r.text).includes(q) || q.includes(norm(r.text)));
  if (!match) return { ok: false, reason: 'nomatch' };
  if (match.state === 'reclaimed') return { ok: true, text: match.text }; // idempotent
  await db.query("update reclaim_item set state='reclaimed', reclaimed_at=now() where member_id=$1 and id=$2", [memberId, match.id]);
  await db.query(
    `insert into beat_completion (member_id, beat_id, close_type, close_response, reclaim_item_id, feeds_consistency, feeds_recovery, feeds_reach)
     values ($1,'SELF-MARK','goal','self_marked',$2,true,false,true)`,
    [memberId, match.id],
  );
  return { ok: true, text: match.text };
}

/**
 * Reverse a member self-mark (the minimal undo). Only undoes a self_marked completion — a goal earned
 * through the Beats is untouched. Deletes the marker (removes its Reach/activity contribution) and
 * restores state from genuine progress (closer_count): >=threshold → reclaimed (was already), >0 →
 * closer, else not_yet. Journey re-reads state, so the tick reverses.
 */
export async function unmarkReclaimReclaimedByText(
  db: Db,
  memberId: string,
  query: string,
): Promise<{ ok: boolean; text?: string; reason?: 'nomatch' | 'not_self_marked' | 'empty' }> {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return { ok: false, reason: 'empty' };
  const rows = (
    await db.query<{ id: string; text: string; closer_count: number }>(
      'select id, text, closer_count from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
  ).rows;
  const norm = (s: string) => s.trim().toLowerCase();
  const match = rows.find((r) => norm(r.text) === q) ?? rows.find((r) => norm(r.text).includes(q) || q.includes(norm(r.text)));
  if (!match) return { ok: false, reason: 'nomatch' };
  const marker = (
    await db.query<{ id: string }>(
      "select id from beat_completion where member_id=$1 and reclaim_item_id=$2 and close_response='self_marked' order by completed_at desc limit 1",
      [memberId, match.id],
    )
  ).rows[0];
  if (!marker) return { ok: false, reason: 'not_self_marked' };
  await db.query('delete from beat_completion where id=$1', [marker.id]);
  const cc = Number(match.closer_count ?? 0);
  const newState = cc >= RECLAIMED_THRESHOLD ? 'reclaimed' : cc > 0 ? 'closer' : 'not_yet';
  await db.query(
    "update reclaim_item set state=$3, reclaimed_at = case when $3='reclaimed' then reclaimed_at else null end where member_id=$1 and id=$2",
    [memberId, match.id, newState],
  );
  return { ok: true, text: match.text };
}

/**
 * Refine the WORDING of an existing Reclaim item (the "Refine" half of add/refine). Keeps the item's
 * id, state, progress (closer_count), bindings, and category — only the text changes — so it's the
 * SAFE edit (the risky delete / progress-losing edits stay deferred). Refuses fog (must stay
 * specific & observable). Optionally updates category if the agent says it genuinely changed.
 */
export async function refineReclaimItemByText(
  db: Db,
  memberId: string,
  query: string,
  newText: string,
  agentCategory?: string,
): Promise<{ ok: boolean; oldText?: string; newText?: string; reason?: 'empty' | 'vague' | 'nomatch' | 'duplicate' }> {
  const q = (query ?? '').trim().toLowerCase();
  const text = (newText ?? '').trim();
  if (!q || !text) return { ok: false, reason: 'empty' };
  if (isVagueReclaim(text)) return { ok: false, reason: 'vague' };
  const rows = (
    await db.query<{ id: string; text: string; category: string }>(
      'select id, text, category from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
  ).rows;
  const norm = (s: string) => s.trim().toLowerCase();
  const match = rows.find((r) => norm(r.text) === q) ?? rows.find((r) => norm(r.text).includes(q) || q.includes(norm(r.text)));
  if (!match) return { ok: false, reason: 'nomatch' };
  if (rows.some((r) => r.id !== match.id && norm(r.text) === text.toLowerCase())) return { ok: false, reason: 'duplicate' };
  const category: Category = isCategory(agentCategory) ? agentCategory : (match.category as Category);
  await db.query('update reclaim_item set text=$3, category=$4 where member_id=$1 and id=$2', [memberId, match.id, text, category]);
  return { ok: true, oldText: match.text, newText: text };
}

// Remove an item from the Reclaim List — SOFT, audited, reversible (handoff 2026-06-25). NEVER a hard
// delete: stamps removed_at so the row and its whole history survive and it can be restored by clearing
// removed_at. Fuzzy-matches the member's wording the same way refine/mark do.
export async function removeReclaimItemByText(
  db: Db,
  memberId: string,
  query: string,
): Promise<{ ok: boolean; removedText?: string; reason?: 'empty' | 'nomatch' }> {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return { ok: false, reason: 'empty' };
  const rows = (
    await db.query<{ id: string; text: string }>(
      'select id, text from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
  ).rows;
  const norm = (s: string) => s.trim().toLowerCase();
  const match = rows.find((r) => norm(r.text) === q) ?? rows.find((r) => norm(r.text).includes(q) || q.includes(norm(r.text)));
  if (!match) return { ok: false, reason: 'nomatch' };
  await db.query('update reclaim_item set removed_at=now() where member_id=$1 and id=$2 and removed_at is null', [memberId, match.id]);
  return { ok: true, removedText: match.text };
}

// Reorder the Reclaim List. The agent passes the list in the desired order (item texts); each is matched
// and assigned its new sort_order. Any active item not named keeps its relative order, after the named
// ones. State/order only — no deletion.
export async function reorderReclaimList(
  db: Db,
  memberId: string,
  orderedTexts: string[],
): Promise<{ ok: boolean; count: number; reason?: 'empty' | 'nomatch' }> {
  const wanted = (orderedTexts ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
  if (!wanted.length) return { ok: false, count: 0, reason: 'empty' };
  const rows = (
    await db.query<{ id: string; text: string }>(
      'select id, text from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
  ).rows;
  const norm = (s: string) => s.trim().toLowerCase();
  const used = new Set<string>();
  const ordered: string[] = [];
  for (const w of wanted) {
    const wn = norm(w);
    const m =
      rows.find((r) => !used.has(r.id) && norm(r.text) === wn) ??
      rows.find((r) => !used.has(r.id) && (norm(r.text).includes(wn) || wn.includes(norm(r.text))));
    if (m) {
      used.add(m.id);
      ordered.push(m.id);
    }
  }
  if (!ordered.length) return { ok: false, count: 0, reason: 'nomatch' };
  for (const r of rows) if (!used.has(r.id)) ordered.push(r.id); // unnamed items keep their order, after
  for (let i = 0; i < ordered.length; i++) {
    await db.query('update reclaim_item set sort_order=$3 where member_id=$1 and id=$2', [memberId, ordered[i], i]);
  }
  return { ok: true, count: used.size };
}

export async function assembleState(db: Db, memberId: string): Promise<MemberBeatState> {
  const reclaimItems = await getReclaimItems(db, memberId);

  const completed = (
    await db.query<{ beat_id: string }>('select distinct beat_id from beat_completion where member_id=$1', [memberId])
  ).rows;
  const completedBeatIds = new Set(completed.map((r) => r.beat_id));

  let rebuildFoundationCount = 0;
  for (const id of completedBeatIds) {
    const b = beatById(id);
    if (b && b.position.r === 'rebuild' && b.position.layer === 'Foundation') rebuildFoundationCount++;
  }

  const idqRows = (
    await db.query<{ taken_at: unknown; physical_score: number; self_score: number; social_score: number; outlook_score: number }>(
      `select taken_at, physical_score, self_score, social_score, outlook_score
       from idq_retake where member_id=$1 order by cycle_indicator desc, sequence_no desc limit 1`,
      [memberId],
    )
  ).rows;
  const idqDone = idqRows.length > 0;
  const lastIdqIso = idqDone ? toIso(idqRows[0]!.taken_at) : null;
  const daysSinceLastIdq = lastIdqIso ? Math.floor((Date.now() - new Date(lastIdqIso).getTime()) / 86_400_000) : null;

  let lowestDimension: Category | null = null;
  if (idqDone) {
    const r = idqRows[0]!;
    const dims: [Category, number][] = [
      ['physical', Number(r.physical_score)], ['self', Number(r.self_score)],
      ['social', Number(r.social_score)], ['outlook', Number(r.outlook_score)],
    ];
    dims.sort((a, b) => a[1] - b[1]);
    lowestDimension = dims[0]![0];
  }

  const prof = (
    await db.query<{ identity_noun: string | null; named_door: string | null }>(
      'select identity_noun, named_door from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0] ?? { identity_noun: null, named_door: null };
  const doorRows = (await db.query('select 1 from member_door where member_id=$1 limit 1', [memberId])).rows;

  return {
    completedBeatIds,
    reclaimItems,
    identitySet: !!prof.identity_noun?.trim?.(),
    doorCaptured: doorRows.length > 0 || !!prof.named_door,
    idqDone,
    rewireCheckpointDone: completedBeatIds.has('RWR-CHK-01'),
    rebuildFoundationCount,
    daysSinceLastIdq,
    lowestDimension,
  };
}

export type ServedBeat = {
  beat: Beat;
  effectiveType: CloseType;
  close: string; // rendered ({reclaim_item} filled, or degraded)
  boundItemId: string | null;
};

/** Resolve and serve a specific Beat (binds its goal item, stamps last_served_at for rotation). */
export async function serveBeat(db: Db, memberId: string, beatId: string): Promise<ServedBeat | null> {
  const beat = beatById(beatId);
  if (!beat) return null;
  const items = await getReclaimItems(db, memberId);
  const bound = bindGoalItem(beat, items);
  if (bound) {
    await db.query('update reclaim_item set last_served_at=now() where id=$1', [bound.id]);
  }
  return {
    beat,
    effectiveType: effectiveCloseType(beat, items),
    close: renderClose(beat, items),
    boundItemId: bound?.id ?? null,
  };
}

/** The next Beat the in-app surface should serve (or null). */
export async function nextBeat(db: Db, memberId: string): Promise<ServedBeat | null> {
  const state = await assembleState(db, memberId);
  const beat = selectNextBeat(state);
  return beat ? serveBeat(db, memberId, beat.beat_id) : null;
}

export type CompletionResult = {
  feedsConsistency: boolean;
  feedsRecovery: boolean;
  feedsReach: boolean;
  itemReclaimed: boolean;
};

/** Record a close: persist the completion (+ component flags) and advance the served item. */
export async function completeBeat(
  db: Db,
  memberId: string,
  beatId: string,
  response: string,
): Promise<CompletionResult | null> {
  const beat = beatById(beatId);
  if (!beat) return null;
  const items = await getReclaimItems(db, memberId);
  const effectiveType = effectiveCloseType(beat, items);
  const boundItem = beat.close_type === 'goal' ? bindGoalItem(beat, items) : null;

  // Return-after-a-miss: a ≥2-day gap since the member's last completed Beat.
  const last = (
    await db.query<{ m: unknown }>('select max(completed_at) m from beat_completion where member_id=$1', [memberId])
  ).rows[0]?.m;
  const lastIso = toIso(last);
  const isReturn = lastIso ? (Date.now() - new Date(lastIso).getTime()) / 86_400_000 >= 2 : false;

  const out = resolveClose({ effectiveType, response, boundItem, isReturn });

  await db.query(
    `insert into beat_completion
       (member_id, beat_id, close_type, close_response, reclaim_item_id,
        feeds_consistency, feeds_recovery, feeds_reach)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [memberId, beatId, effectiveType, response, boundItem?.id ?? null,
     out.feedsConsistency, out.feedsRecovery, out.feedsReach],
  );

  if (out.itemUpdate) {
    await db.query(
      `update reclaim_item set state=$2, closer_count=$3, reclaimed_at=$4 where id=$1`,
      [out.itemUpdate.id, out.itemUpdate.newState, out.itemUpdate.newCloserCount,
       out.itemUpdate.reclaimedNow ? new Date().toISOString() : null],
    );
  }

  return {
    feedsConsistency: out.feedsConsistency,
    feedsRecovery: out.feedsRecovery,
    feedsReach: out.feedsReach,
    itemReclaimed: out.itemUpdate?.reclaimedNow ?? false,
  };
}

// --- Journey — the third feedback: a place, never a score -------------------------------
const R_LABEL: Record<RGroup, string> = {
  reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim', cross_cutting: 'Daily',
};
const R_RANK: Record<string, number> = { reconnect: 0, rewire: 1, rebuild: 2, reclaim: 3, cross_cutting: -1 };

export type JourneyStep = { r: RGroup; label: string; blurb: string; state: 'done' | 'current' | 'ahead' };

// One-line meaning of each R (canonical, from the Learning Strategy) — context for "where you are".
const R_BLURB: Record<RGroup, string> = {
  reconnect: 'See where you are honestly, remember who you were, find the spark.',
  rewire: 'Dismantle the old stories; build new frames around body, food, and self.',
  rebuild: 'The physical work — movement, fuel, sleep. The numbers start to move.',
  reclaim: 'Carry the recovered identity outward — people, community, adventure.',
  cross_cutting: 'The daily reps that run across every part of the path.',
};
export type Journey = {
  currentR: RGroup | null;
  currentRLabel: string | null;
  currentLayer: string | null;
  reclaim: { total: number; reclaimed: number; moving: number; notYet: number };
  beatsDone: number; // earned reps so far (incl. the onboarding gateway) — immediate progress
  path: JourneyStep[]; // the 4Rs with the member's position marked
  line: string;
};

const PATH_RS: RGroup[] = ['reconnect', 'rewire', 'rebuild', 'reclaim'];

/** Where the member is on the 4Rs (the frontier Beat's position) + their Reclaim List movement. */
export async function getJourney(db: Db, memberId: string): Promise<Journey> {
  const state = await assembleState(db, memberId);
  const next = selectNextBeat(state);

  let currentR: RGroup | null = next?.position.r ?? null;
  let currentLayer: string | null = next?.position.layer ?? null;
  if (!currentR && state.completedBeatIds.size > 0) {
    // No frontier Beat — read the furthest R the member has completed.
    let best = -2;
    for (const id of state.completedBeatIds) {
      const b = beatById(id);
      if (b && (R_RANK[b.position.r] ?? -2) > best) {
        best = R_RANK[b.position.r] ?? -2;
        currentR = b.position.r;
        currentLayer = b.position.layer;
      }
    }
  }

  // The tally must reflect REAL movement, not just coached-Beat state: a goal with a climbing
  // tracker (incl. witnessed life goals, which never earn coached Beats) reads as "moving", so
  // "0 moving" stops being a false zero. Counts ALL items — coached and witnessed alike.
  const items = state.reclaimItems;
  const measures = await listMeasures(db, memberId);
  const movingByTracker = new Set(
    measures.filter(measureMoving).map((m) => m.reclaimItemId).filter((id): id is string => Boolean(id)),
  );
  const isMoving = (i: ReclaimItem) =>
    i.state !== 'reclaimed' && (i.state === 'closer' || movingByTracker.has(i.id));
  const reclaim = {
    total: items.length,
    reclaimed: items.filter((i) => i.state === 'reclaimed').length,
    moving: items.filter(isMoving).length,
    notYet: items.filter((i) => i.state !== 'reclaimed' && !isMoving(i)).length,
  };

  // The 4Rs as a path, with the member's position marked — so progress reads immediately.
  const curRank = currentR ? (R_RANK[currentR] ?? 0) : PATH_RS.length;
  const path: JourneyStep[] = PATH_RS.map((r) => ({
    r,
    label: R_LABEL[r],
    blurb: R_BLURB[r],
    state: (R_RANK[r] ?? 0) < curRank ? 'done' : currentR === r ? 'current' : 'ahead',
  }));
  const beatsDone = state.completedBeatIds.size; // earned (the onboarding gateway counts as real work)

  const place = currentR ? R_LABEL[currentR] : 'the start';
  const reclaimBit =
    reclaim.reclaimed > 0
      ? ` ${reclaim.reclaimed} of ${reclaim.total} reclaimed, the rest in motion.`
      : reclaim.total > 0
        ? ` ${reclaim.total} things to win back.`
        : '';
  const line =
    beatsDone > 0
      ? `You've crossed the Threshold — ${beatsDone} steps in, and you're into ${place}.${reclaimBit}`
      : `You're at the start. Your Reclaim List is where this all points.`;

  return {
    currentR,
    currentRLabel: currentR ? R_LABEL[currentR] : null,
    currentLayer,
    reclaim,
    beatsDone,
    path,
    line,
  };
}

// --- Daily Hardiness Beat — the cross-cutting daily rep (runs across every gate) ---------
export type DailyHardiness = { served: ServedBeat | null; doneToday: boolean };

/** One Hardiness Beat for today — least-recently-done (cycles through them); null + doneToday
 *  once the member has logged one today. These feed Grinta Consistency like any completion. */
export async function dailyHardiness(db: Db, memberId: string): Promise<DailyHardiness> {
  const hardiness = allBeats().filter((b) => b.source === 'hardiness_beat');
  const rows = (
    await db.query<{ beat_id: string; completed_at: unknown }>(
      `select beat_id, completed_at from beat_completion
       where member_id=$1 and beat_id like 'HRD-%' order by completed_at desc`,
      [memberId],
    )
  ).rows;
  const today = new Date().toDateString();
  const doneToday = rows.some((r) => {
    const iso = toIso(r.completed_at);
    return iso != null && new Date(iso).toDateString() === today;
  });
  if (doneToday) return { served: null, doneToday: true };

  const lastMs = new Map<string, number>();
  for (const r of rows) {
    if (!lastMs.has(r.beat_id)) lastMs.set(r.beat_id, new Date(toIso(r.completed_at) ?? 0).getTime());
  }
  const pick = [...hardiness].sort(
    (a, b) => (lastMs.get(a.beat_id) ?? -Infinity) - (lastMs.get(b.beat_id) ?? -Infinity),
  )[0];
  if (!pick) return { served: null, doneToday: false };
  return { served: await serveBeat(db, memberId, pick.beat_id), doneToday: false };
}

// --- Past Beats — a re-readable record of completed work --------------------------------
export type PastBeat = {
  beatId: string;
  title: string;
  content: string;
  closeType: CloseType;
  response: string; // raw stored close response
  answered: string; // human label of what they answered ("Closer", "Yes", or their reflection)
  when: string; // relative, e.g. "2h ago"
};

const relWhen = (iso: string | null): string => {
  if (!iso) return '';
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 90) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
};

function answeredLabel(closeType: CloseType, response: string): string {
  if (closeType === 'reflect') return response?.trim() ? `“${response.trim()}”` : 'Reflected';
  const goal: Record<string, string> = { closer: 'Closer', not_yet: 'Not yet', sideways: 'Took me sideways' };
  const rep: Record<string, string> = { yes: 'Yes', no: 'No' };
  return goal[response] ?? rep[response] ?? response ?? '';
}

/** Completed Beats, most recent first — re-readable, with what the member answered. Excludes the
 *  onboarding-handoff seeds (bookkeeping, not member-worked). */
export async function getBeatHistory(db: Db, memberId: string, limit = 30): Promise<PastBeat[]> {
  const rows = (
    await db.query<{ beat_id: string; close_type: CloseType; close_response: string | null; completed_at: unknown }>(
      // ctid desc breaks ties on completed_at (two Beats closed in the same instant would otherwise sort
      // non-deterministically). beat_completion is append-only, so ctid = insertion order = "most recent
      // first," matching the display intent.
      `select beat_id, close_type, close_response, completed_at
       from beat_completion
       where member_id=$1 and coalesce(close_response,'') not in ('onboarding','self_marked')
       order by completed_at desc, ctid desc limit $2`,
      [memberId, limit],
    )
  ).rows;
  return rows.map((r) => {
    const beat = beatById(r.beat_id);
    const response = r.close_response ?? '';
    return {
      beatId: r.beat_id,
      title: beat?.title ?? r.beat_id,
      content: beat?.content ?? '',
      closeType: r.close_type,
      response,
      answered: answeredLabel(r.close_type, response),
      when: relWhen(toIso(r.completed_at)),
    };
  });
}

// re-exported for callers that need the raw helpers
export { allBeats };

// Re-exports so callers import one module.
export { isReady, selectNextBeat };
