'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import {
  reclaimEnabled,
  reclaimC1Opening,
  applyReclaimC1Turn,
  liveTurnReclaimRefine,
  reclaimC2Opening,
  applyReclaimC2Turn,
  reclaimC3Opening,
  liveTurnReclaimC3,
} from '../../lib/agent/reclaim.ts';
import { getReclaimItems } from '../../lib/beats/store.ts';
import { commitRefinement, isTier, type Tier } from '../../lib/reclaim/refinement-store.ts';
import { persistBiggerWorldReading } from '../../lib/reclaim/bigger-world-store.ts';
import { AUDIT_ITEM_COUNT } from '../../lib/reclaim/bigger-world-instrument.ts';
import { persistQualityDayProfile } from '../../lib/reclaim/quality-day-store.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';

// v2.5 Reclaim server actions. C1 · Readiness (evidence + refine→commit) + C2 · Bigger World Audit (administered →
// RC-1, persisted) + C3 · Quality Days (coach-define the profile → confirm → store + open the logging week).
// Flag-gated (RECLAIM).
export type ReclaimSession = 'c1' | 'c2' | 'c3';

export async function startReclaimAction(
  memberId: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'c2') return { ok: true, ...openTurn(reclaimC2Opening()) };
  if (session === 'c3') return { ok: true, ...openTurn(reclaimC3Opening()) };
  // C1: seed the member's CURRENT Reclaim List so Step 2 can present it for the re-read. Graceful degrade to empty.
  const db = (await getDb()) as unknown as Db;
  const items = (await getReclaimItems(db, memberId).catch(() => [])).map((i) => i.text);
  return { ok: true, ...openTurn(reclaimC1Opening(items)) };
}

function openTurn(turn: { reply: string; state: ConvState }): { reply: string; state: ConvState } {
  return { reply: turn.reply, state: turn.state };
}

export async function reclaimTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // C2 · Bigger World Audit — administered (deterministic 1–10). On completion, persist the durable priorities (RC-4).
    if (session === 'c2') {
      const turn = applyReclaimC2Turn(state, history, message);
      if (turn.complete) {
        const responses = (turn.state.administeredResponses ?? []).slice(0, AUDIT_ITEM_COUNT);
        if (responses.length === AUDIT_ITEM_COUNT) {
          try {
            const db = (await getDb()) as unknown as Db;
            await persistBiggerWorldReading(db, memberId, responses);
          } catch {
            /* swallow — the member saw the summary; the durable reading is best-effort */
          }
        }
      }
      return { ok: true, reply: turn.reply, state: turn.state };
    }
    // C3 · Quality Days — a LIVE coaching turn. On confirm, store the Quality-Day profile + open the logging week.
    if (session === 'c3') {
      const turn = await liveTurnReclaimC3(state, history, message);
      if (turn.complete && turn.state.collected?.pendingQualityDay) {
        const qd = turn.state.collected.pendingQualityDay;
        if (qd.nonNegotiables.length) {
          const db = (await getDb()) as unknown as Db;
          try {
            await persistQualityDayProfile(db, memberId, qd);
          } catch {
            /* swallow — the member saw the confirm; the stored profile is best-effort */
          }
          try {
            await startPracticeWeek(db, memberId, 'c3_quality');
          } catch {
            /* swallow — the logging nudge is a bonus */
          }
        }
      }
      return { ok: true, reply: turn.reply, state: turn.state };
    }
    // C1 · Step 1 (evidence) is administered (deterministic); Step 2 (refine) is the live coaching turn.
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
