// Beat engine — DB layer. Assembles member state for the engine, serves a Beat (binding its goal
// item and stamping last_served_at so selection rotates), and records a close (persisting the
// Grinta component flags and advancing the served Reclaim item's state machine).

import type { Db } from '../db/schema.ts';
import { beatById, type Beat, type Category, type CloseType, type Rhythm } from './registry.ts';
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
    await db.query<{ taken_at: unknown }>(
      'select taken_at from idq_retake where member_id=$1 order by taken_at desc limit 1',
      [memberId],
    )
  ).rows;
  const idqDone = idqRows.length > 0;
  const lastIdqIso = idqDone ? toIso(idqRows[0]!.taken_at) : null;
  const daysSinceLastIdq = lastIdqIso ? Math.floor((Date.now() - new Date(lastIdqIso).getTime()) / 86_400_000) : null;

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

// Re-exports so callers import one module.
export { isReady, selectNextBeat };
