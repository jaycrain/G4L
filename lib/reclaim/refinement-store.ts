// Reclaim C1 Step 2 — the Reclaim List refinement commit + history. Per the C1 Step-2 data-contract decision (Jay,
// 2026-07-09): the refinement is coached in a SNAPSHOT (no mid-session mutation), then COMMITTED back to the live
// Reclaim List on the member's confirm — member-authorized (propose→confirm→commit, Decision L), NOT silent engine
// mutation. One source of truth (the live list, refined). The pre-refinement state is kept as HISTORY (RC-4 "show me
// my past priorities"). Tier rides as an ATTRIBUTE on the committed items; "No Longer Central" is the lowest tier,
// never a delete (releasing an item stays a separate explicit member action).

import type { Db } from '../db/schema.ts';
import { addReclaimItemForMember } from '../member/refine.ts';
import { readJson, payloadKind } from '../db/jsonb.ts';
import { getReclaimItems } from '../beats/store.ts';
import { addReclaimItems, refineReclaimItemByText, removeReclaimItemByText, reorderReclaimList } from '../beats/store.ts';
import { categorizeReclaimItems } from '../beats/categorize.ts';

export type Tier = 'top' | 'important' | 'emerging' | 'no_longer_central';
export const REFINE_TIERS: readonly Tier[] = ['top', 'important', 'emerging', 'no_longer_central'];
export const TIER_LABEL: Record<Tier, string> = {
  top: 'Top Priorities Now',
  important: 'Important but Not First',
  emerging: 'Emerging Priorities',
  no_longer_central: 'No Longer Central',
};
export const isTier = (t: unknown): t is Tier => typeof t === 'string' && (REFINE_TIERS as readonly string[]).includes(t);
const TIER_ORDER: Record<Tier, number> = { top: 0, important: 1, emerging: 2, no_longer_central: 3 };

// One refined item: `original` matches a live item (the member's current wording), `text` is the confirmed refined
// wording (may equal original), `tier` is the bucket. Additions/removals are NOT part of a refinement commit.
export type RefinedItem = {
  original: string; text: string; tier: Tier;
  /** The live reclaim_item this refines, RESOLVED WHEN THE REFINEMENT IS PROPOSED (CAT-36 fix, option b).
   *  The model's `original` string used to be the join key at commit time, so a wording it invented matched
   *  nothing and applied 0 rows — while the member was told their list now reflected them. Resolving up front
   *  means anything that survives to the confirmation is guaranteed to apply. */
  reclaimItemId?: string;
};
/**
 * A goal that was NOT on the list before — Greg's C1 question 5, "which new priorities have emerged?"
 *
 * WHY THIS IS A SEPARATE SHAPE and not a RefinedItem with a null id. RefinedItem carries `original` (must match a
 * live item) and `reclaimItemId` (resolved at PROPOSE time). That resolution is a deliberate fix: the model's
 * invented wording used to be the join key at commit, so a phrasing it made up matched nothing and applied 0 rows
 * — while the member was told their list now reflected them. A nullable id on the same type would re-open exactly
 * that hole, because "no match" and "new item" would become indistinguishable at the point of writing.
 */
export type AddedItem = {
  text: string;
  tier: Tier;
  /** Greg's `emergence_source` — what brought it into view. Free text, the member's words, optional. */
  emergedFrom?: string;
};

export type RefinementResult = {
  items: RefinedItem[];
  top3: string[]; // the refined texts, member's order
  /** C1 must be able to ADMIT a goal, not only re-rank and re-word. Optional: most refinements add nothing. */
  added?: AddedItem[];
};

const norm = (s: string): string => (s ?? '').trim().toLowerCase();

/** The ONE matcher. Shared by the propose-time resolve and the commit, so they can never disagree about
 *  which live item a refined line refers to. */
export function matchLiveId(live: Array<{ id: string; text: string }>, original: string): string | undefined {
  const q = norm(original);
  if (!q) return undefined;
  return (live.find((i) => norm(i.text) === q) ?? live.find((i) => norm(i.text).includes(q) || q.includes(norm(i.text))))?.id;
}

/**
 * CAT-36 (option b) — resolve a proposed refinement against the member's LIVE list BEFORE they are asked to
 * confirm it. Returns only the items that actually point at something, plus what didn't match.
 *
 * The old flow validated nothing until commit, so the failure surfaced as a lie: "Done — your Reclaim List now
 * reflects where you actually are", zero rows changed. Doing it here means the ceremony can only ever confirm
 * changes that will land — and if NOTHING resolves, the caller declines to propose at all rather than promising.
 */
export async function resolveRefinement(
  db: Db,
  memberId: string,
  items: RefinedItem[],
): Promise<{ resolved: RefinedItem[]; unmatched: RefinedItem[] }> {
  const live = await getReclaimItems(db, memberId);
  const taken = new Set<string>();
  const resolved: RefinedItem[] = [];
  const unmatched: RefinedItem[] = [];
  for (const it of items) {
    const id = matchLiveId(live, it.original);
    // One refined line per live item — a second claim on the same id is a dupe, not a second change.
    if (id && !taken.has(id)) { taken.add(id); resolved.push({ ...it, reclaimItemId: id }); }
    else unmatched.push(it);
  }
  return { resolved, unmatched };
}

// Commit a member-CONFIRMED refinement. (1) snapshot the pre-refinement live list to coaching_plan as history;
// (2) apply the confirmed refinement to the LIVE list — reword text + set the tier attribute; (3) reorder (top-3
// lead in their order, then by tier). Matches refined items to live items by fuzzy text (same posture as the existing
// refine/reorder CRUD). Unmatched refined items are skipped (adds go through the normal path); live items absent from
// the refinement keep their prior tier and trail. NEVER removes an item.
export async function commitRefinement(db: Db, memberId: string, result: RefinementResult): Promise<{ ok: boolean; applied: number }> {
  const live = await getReclaimItems(db, memberId); // the pre-refinement state (source of truth for matching)

  // (1) history snapshot — the pre-state + the refinement, kept for RC-4 retrieval. status 'complete' (a record, not
  // an active plan), so it never collides with an active coaching_plan.
  await db.query(
    `insert into coaching_plan (member_id, phase, payload, status) values ($1, 'reclaim', $2::text::jsonb, 'complete')`,
    [
      memberId,
      JSON.stringify({
        kind: 'c1_refinement',
        preRefinement: live.map((i) => ({ text: i.text, category: i.category, tier: i.tier ?? null })),
        refinement: result,
      }),
    ],
  );

  const matchId = (original: string): string | undefined => matchLiveId(live, original);

  // (2) apply — reword + tier for each matched item. Map BOTH the original and the refined text → id, so the top-3
  // (which references the REFINED wording) resolves even though `live` holds the pre-refinement text.
  const idTier: Record<string, Tier> = {};
  const textToId: Record<string, string> = {};
  const usedText = new Set<string>(); // guard against a MERGE producing two identical-text items
  let applied = 0;
  for (const it of result.items) {
    // Prefer the id RESOLVED AT PROPOSE TIME. Falling back to string matching keeps snapshots written before
    // this fix committable, but a fresh refinement never depends on the model's wording surviving the round trip.
    const id = it.reclaimItemId ?? matchId(it.original);
    if (!id || !isTier(it.tier) || idTier[id] !== undefined) continue; // one refined line per live item — a second match is a dupe
    const text = (it.text ?? '').trim();
    const key = norm(text);
    if (text && usedText.has(key)) {
      // Two originals refined to the SAME text = a merge. Release this one to the lowest tier (never a delete, per the
      // contract) rather than writing a duplicate row — so the list can't render the same item twice.
      await db.query('update reclaim_item set tier=$3 where member_id=$1 and id=$2', [memberId, id, 'no_longer_central']);
      idTier[id] = 'no_longer_central';
      applied += 1;
      continue;
    }
    if (text) {
      usedText.add(key);
      await db.query('update reclaim_item set text=$3, tier=$4 where member_id=$1 and id=$2', [memberId, id, text, it.tier]);
    } else {
      await db.query('update reclaim_item set tier=$3 where member_id=$1 and id=$2', [memberId, id, it.tier]);
    }
    idTier[id] = it.tier;
    textToId[norm(it.original)] = id;
    if (text) textToId[norm(text)] = id;
    applied += 1;
  }

  // (2b) ADD — the goals that were not on the list before. AFTER the refinement pass, so a new item can never
  // collide with a rewording in flight, and via addReclaimItemForMember so it inherits the duplicate guard and the
  // category inference rather than re-implementing either. An addition that duplicates an existing item is a
  // reword the model mis-filed; dropping it silently is right, and it is COUNTED so `applied` stays honest.
  const addedIds: string[] = [];
  for (const a of result.added ?? []) {
    const text = (a.text ?? '').trim();
    if (!text || !isTier(a.tier)) continue;
    const r = await addReclaimItemForMember(db, memberId, text);
    if (!r.ok) continue; // duplicate or empty — already on the list, nothing to add
    const { rows } = await db.query<{ id: string }>(
      'select id from reclaim_item where member_id=$1 and text=$2 order by created_at desc limit 1',
      [memberId, text],
    );
    const id = rows[0]?.id;
    if (!id) continue;
    await db.query('update reclaim_item set tier=$3 where member_id=$1 and id=$2', [memberId, id, a.tier]);
    idTier[id] = a.tier;
    textToId[norm(text)] = id; // so a top-3 naming a NEW item resolves
    addedIds.push(id);
    applied += 1;
  }

  // (3) reorder — top-3 first (member's order), then the rest by tier (stable within a tier: `live` preserves prior order).
  const top3Ids: string[] = [];
  for (const t of result.top3) {
    const id = textToId[norm(t)] ?? matchId(t);
    if (id && !top3Ids.includes(id)) top3Ids.push(id);
  }
  // Added ids join `live` here. Without this they keep the default sort_order 0 and leapfrog the member's own
  // ordering — a new item silently outranking the three they just named as top priorities.
  const rest = [...live.map((i) => i.id), ...addedIds].filter((id) => !top3Ids.includes(id));
  rest.sort((a, b) => TIER_ORDER[idTier[a] ?? 'important'] - TIER_ORDER[idTier[b] ?? 'important']);
  const ordered = [...top3Ids, ...rest];
  for (let i = 0; i < ordered.length; i++) {
    await db.query('update reclaim_item set sort_order=$3 where member_id=$1 and id=$2', [memberId, ordered[i], i]);
  }

  return { ok: true, applied };
}

export type RefinementHistory = {
  preRefinement: { text: string; category: string; tier: string | null }[];
  refinement: RefinementResult;
  takenAt: string;
};

// The member's most recent refinement snapshot — the "past priorities" retrieval (RC-4). Null on none / on error
// (drift-hardened, same posture as the other agent-context reads). The CURRENT priorities live on the list itself
// (getReclaimItems now carries `tier`); this is the prior state, for "show me where my list used to be."
export async function latestRefinement(db: Db, memberId: string): Promise<RefinementHistory | null> {
  try {
    // KIND IS MATCHED IN JS, NOT SQL. `payload->>'kind'` is NULL on a jsonb string, and prod stores these as
    // strings — so this filter matched nothing there while passing every local test. See lib/db/jsonb.ts.
    const { rows } = await db.query<{ payload: unknown; created_at: string }>(
      `select payload, created_at from coaching_plan
        where member_id=$1 and phase='reclaim'
        order by created_at desc`,
      [memberId],
    );
    const r = rows.find((row) => payloadKind(row.payload) === 'c1_refinement');
    if (!r) return null;
    const p = readJson<{ preRefinement?: RefinementHistory['preRefinement']; refinement: RefinementResult }>(r.payload);
    if (!p?.refinement) return null;
    return { preRefinement: p.preRefinement ?? [], refinement: p.refinement, takenAt: String(r.created_at) };
  } catch (e) {
    // LOG. A failed read here is indistinguishable from "they never refined" — the caller shows nothing either way.
    console.error(`latestRefinement read failed for member=${memberId}:`, (e as Error).message);
    return null;
  }
}

/**
 * COMMIT ONE CONFIRMED REVISION PASS to the member's live Reclaim List.
 *
 * C1 runs Greg's six passes (C1.md:495) and commits AS IT GOES — a member who stops after pass three keeps those
 * three (Jay, 2026-08-29). That is the difference this function exists for: `commitRefinement` above takes a
 * whole settled list at the end, which is the contract the six passes replace.
 *
 * IT IS THE SEAM THE PASSES WERE PARKED FOR. The engine applies each confirmed change to the CONVERSATION's copy
 * of the list; without this, a member could walk all six passes, confirm every change, be told their list was
 * refined, and have nothing reach the table. That failure does not error — it lies, about the one artifact whose
 * loss leaves no evidence — which is why the arc shipped built-and-not-switched-on until this landed.
 *
 * EVERY OP IS ALREADY AUDITED AND REVERSIBLE, which is why this dispatches rather than writing SQL: `drop` is a
 * SOFT remove (stamps removed_at, the row and its history survive), `reword` keeps the item's id and its whole
 * trail, `reorder` only moves sort_order and never deletes. Nothing here can destroy a member's item.
 *
 * Returns what actually happened, never a bare boolean: the caller has already TOLD the member the change was
 * made, so a silent failure here would be the same lie one layer down. [[swallowed-read-renders-as-truth]]
 */
export async function commitListChange(
  db: Db,
  memberId: string,
  change: { op: 'drop'; target: string } | { op: 'reword'; target: string; text: string } | { op: 'add'; text: string } | { op: 'reorder'; order: string[] },
): Promise<{ ok: boolean; reason?: string }> {
  if (change.op === 'drop') {
    const r = await removeReclaimItemByText(db, memberId, change.target);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason ?? 'nomatch' };
  }
  if (change.op === 'reword') {
    const r = await refineReclaimItemByText(db, memberId, change.target, change.text);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason ?? 'nomatch' };
  }
  if (change.op === 'add') {
    // The category is the agent's usual call; 'physical' is not assumed. categorizeReclaimItems is the one
    // classifier, so the item arrives on the list the same way one added from the rail does.
    const [category] = await categorizeReclaimItems([change.text]);
    await addReclaimItems(db, memberId, [{ text: change.text, category: category ?? 'self' }]);
    return { ok: true };
  }
  await reorderReclaimList(db, memberId, change.order);
  return { ok: true };
}
