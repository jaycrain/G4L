// Reclaim C1 Step 2 — the Reclaim List refinement commit + history. Per the C1 Step-2 data-contract decision (Jay,
// 2026-07-09): the refinement is coached in a SNAPSHOT (no mid-session mutation), then COMMITTED back to the live
// Reclaim List on the member's confirm — member-authorized (propose→confirm→commit, Decision L), NOT silent engine
// mutation. One source of truth (the live list, refined). The pre-refinement state is kept as HISTORY (RC-4 "show me
// my past priorities"). Tier rides as an ATTRIBUTE on the committed items; "No Longer Central" is the lowest tier,
// never a delete (releasing an item stays a separate explicit member action).

import type { Db } from '../db/schema.ts';
import { getReclaimItems } from '../beats/store.ts';

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
export type RefinedItem = { original: string; text: string; tier: Tier };
export type RefinementResult = { items: RefinedItem[]; top3: string[] }; // top3 = the refined texts, member's order

const norm = (s: string): string => (s ?? '').trim().toLowerCase();

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
    `insert into coaching_plan (member_id, phase, payload, status) values ($1, 'reclaim', $2::jsonb, 'complete')`,
    [
      memberId,
      JSON.stringify({
        kind: 'c1_refinement',
        preRefinement: live.map((i) => ({ text: i.text, category: i.category, tier: i.tier ?? null })),
        refinement: result,
      }),
    ],
  );

  const matchId = (original: string): string | undefined => {
    const q = norm(original);
    if (!q) return undefined;
    return (live.find((i) => norm(i.text) === q) ?? live.find((i) => norm(i.text).includes(q) || q.includes(norm(i.text))))?.id;
  };

  // (2) apply — reword + tier for each matched item. Map BOTH the original and the refined text → id, so the top-3
  // (which references the REFINED wording) resolves even though `live` holds the pre-refinement text.
  const idTier: Record<string, Tier> = {};
  const textToId: Record<string, string> = {};
  const usedText = new Set<string>(); // guard against a MERGE producing two identical-text items
  let applied = 0;
  for (const it of result.items) {
    const id = matchId(it.original);
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

  // (3) reorder — top-3 first (member's order), then the rest by tier (stable within a tier: `live` preserves prior order).
  const top3Ids: string[] = [];
  for (const t of result.top3) {
    const id = textToId[norm(t)] ?? matchId(t);
    if (id && !top3Ids.includes(id)) top3Ids.push(id);
  }
  const rest = live.map((i) => i.id).filter((id) => !top3Ids.includes(id));
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
    const { rows } = await db.query<{ payload: unknown; created_at: string }>(
      `select payload, created_at from coaching_plan
        where member_id=$1 and phase='reclaim' and payload->>'kind'='c1_refinement'
        order by created_at desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    if (!r) return null;
    const p = (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) as {
      preRefinement?: RefinementHistory['preRefinement'];
      refinement: RefinementResult;
    };
    return { preRefinement: p.preRefinement ?? [], refinement: p.refinement, takenAt: String(r.created_at) };
  } catch {
    return null;
  }
}
