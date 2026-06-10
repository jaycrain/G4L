// Beat engine — DB layer. Assembles member state for the engine, serves a Beat (binding its goal
// item and stamping last_served_at so selection rotates), and records a close (persisting the
// Grinta component flags and advancing the served Reclaim item's state machine).

import type { Db } from '../db/schema.ts';
import { allBeats, beatById, type Beat, type Category, type CloseType, type RGroup, type Rhythm } from './registry.ts';
import { isReady } from './readiness.ts';
import { selectNextBeat } from './select.ts';
import { bindGoalItem, effectiveCloseType, renderClose } from './serves.ts';
import { resolveClose } from './close.ts';
import type { MemberBeatState, ReclaimItem } from './types.ts';

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  const t = d.getTime();
  return Number.isNaN(t) ? null : d.toISOString();
};

export async function getReclaimItems(db: Db, memberId: string): Promise<ReclaimItem[]> {
  const { rows } = await db.query<any>(
    `select id, text, category, rhythm, state, closer_count, sort_order, last_served_at
     from reclaim_item where member_id=$1 order by sort_order, created_at`,
    [memberId],
  );
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    category: r.category as Category,
    rhythm: r.rhythm as Rhythm,
    state: r.state,
    closerCount: Number(r.closer_count ?? 0),
    sortOrder: Number(r.sort_order ?? 0),
    lastServedAt: toIso(r.last_served_at),
  }));
}

// Reconnect Beats whose work the onboarding conversation + IDQ already do (the gateway is the
// compressed Reconnect). Seeded as completed on IDQ baseline so the dashboard Beat surface opens at
// genuinely-next work instead of re-asking the member to name their identity or rebuild their list.
const ONBOARDING_COVERED_BEATS = [
  'RCN-IDQ-01', 'RCN-IDQ-02', // the IDQ itself
  'RCN-FDR-01', 'RCN-FDR-02', 'RCN-FDR-03', // Fade Door(s)
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

export type JourneyStep = { r: RGroup; label: string; state: 'done' | 'current' | 'ahead' };
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

  const items = state.reclaimItems;
  const reclaim = {
    total: items.length,
    reclaimed: items.filter((i) => i.state === 'reclaimed').length,
    moving: items.filter((i) => i.state === 'closer').length,
    notYet: items.filter((i) => i.state === 'not_yet').length,
  };

  // The 4Rs as a path, with the member's position marked — so progress reads immediately.
  const curRank = currentR ? (R_RANK[currentR] ?? 0) : PATH_RS.length;
  const path: JourneyStep[] = PATH_RS.map((r) => ({
    r,
    label: R_LABEL[r],
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
      ? `You've cleared the gateway — ${beatsDone} steps in, and you're into ${place}.${reclaimBit}`
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

// re-exported for callers that need the raw helpers
export { allBeats };

// Re-exports so callers import one module.
export { isReady, selectNextBeat };
