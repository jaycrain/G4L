'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { reclaimEnabled, reclaimC1Opening, applyReclaimC1Turn, liveTurnReclaimRefine } from '../../lib/agent/reclaim.ts';
import { getReclaimItems } from '../../lib/beats/store.ts';
import { commitRefinement, isTier, type Tier } from '../../lib/reclaim/refinement-store.ts';

// v2.5 Reclaim server actions. SLICE 1 = C1 · Readiness Assessment. Step 1 (evidence) is administered + FORMATIVE
// (deterministic, nothing persisted); Step 2 (refine) is the LIVE coaching turn → on the member's confirm, the
// refined list is COMMITTED back to the live Reclaim List (member-authorized, propose→confirm→commit). Flag-gated (RECLAIM).
export type ReclaimSession = 'c1';

export async function startReclaimAction(
  memberId: string,
  _session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  // Seed the member's CURRENT Reclaim List so Step 2 can present it for the re-read. Graceful degrade to empty.
  const db = (await getDb()) as unknown as Db;
  const items = (await getReclaimItems(db, memberId).catch(() => [])).map((i) => i.text);
  const turn = reclaimC1Opening(items);
  return { ok: true, reply: turn.reply, state: turn.state };
}

export async function reclaimTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  _session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // Step 1 (evidence) is administered (deterministic); Step 2 (refine) is the live coaching turn.
    const turn = state.stage === 'refine' ? await liveTurnReclaimRefine(state, history, message) : applyReclaimC1Turn(state, history, message);

    // On completion (the member confirmed the refinement) → COMMIT the snapshot to the live Reclaim List. Best-effort:
    // the member already saw the confirmation; a write hiccup never breaks the close.
    if (turn.complete && turn.state.collected?.pendingRefinement) {
      const p = turn.state.collected.pendingRefinement;
      const items = p.items
        .filter((i) => isTier(i.tier))
        .map((i) => ({ original: i.original, text: i.text, tier: i.tier as Tier }));
      if (items.length) {
        try {
          const db = (await getDb()) as unknown as Db;
          await commitRefinement(db, memberId, { items, top3: p.top3 });
        } catch {
          /* swallow — the member saw the confirm; the commit is best-effort */
        }
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
