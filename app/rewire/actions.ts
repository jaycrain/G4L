'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';
import { rewireEnabled, rewireOpening, liveTurnRewire, rewireW2Opening, liveTurnRewireW2 } from '../../lib/agent/rewire.ts';
import { loadReconnectCaptures } from '../../lib/agent/reconnect.ts';
import { emitHarvestMoment, commitKeeper, type KeeperType } from '../../lib/agent/harvest.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';

// Which Rewire session — W1 (the Disinformation Audit) or W2 (the Visualization Workshop). Both ride the same flag,
// surface, and harvest seam; W2 additionally READS the member's Reconnect captures (the Reclaim List) to open.
export type RewireSession = 'w1' | 'w2';

// v2.3 Rewire server actions (W1 · the Disinformation Audit). Flag-gated (REWIRE). Conversation state is held
// client-side for the walk; the true lines the member writes are harvested to the Playbook (default-emit,
// member-owned) as they land. No captures are read for W1 (W2's callback to the Reconnect Spark arrives later).

export async function startRewireAction(
  memberId: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'w2') {
    // W2 opens on the Reclaim List (the callback seam) — read the committed captures; graceful degrade if null/thin.
    const db = (await getDb()) as unknown as Db;
    const committed = await loadReconnectCaptures(db, memberId);
    const turn = rewireW2Opening(committed);
    return { ok: true, reply: turn.reply, state: turn.state };
  }
  const turn = rewireOpening();
  return { ok: true, reply: turn.reply, state: turn.state };
}

// Drain the NEW harvest signals this turn (the true lines) → a member_event moment + a kept Playbook entry in the
// member's own words. Best-effort: a harvest hiccup never fails the conversation turn.
async function persistRewireHarvest(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    const priorN = prev.pendingHarvest?.length ?? 0;
    for (const s of (turn.state.pendingHarvest ?? []).slice(priorN)) {
      const momentId = await emitHarvestMoment(db, memberId, {
        destinationIntent: s.destinationIntent,
        keeperType: s.keeperType as KeeperType,
        surface: 'rewire',
        sourceRef: { kind: s.kind, ref: s.kind, label: s.label ?? s.kind },
        payloadRef: s.payloadRef,
        private: s.private,
      });
      if (s.destinationIntent !== 'share' && !s.private) {
        await commitKeeper(db, memberId, {
          momentId,
          keeperType: s.keeperType as KeeperType,
          section: 'own_words',
          body: s.payloadRef,
          state: 'kept',
          source: { kind: 'own', ref: s.kind, label: s.label ?? s.kind },
        });
      }
    }
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

export async function rewireTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // Every turn is a live model turn — the model supplies the reflection; the kernel sequences + harvests.
    const turn = session === 'w2' ? await liveTurnRewireW2(state, history, message) : await liveTurnRewire(state, history, message);
    const db = (await getDb()) as unknown as Db;
    await persistRewireHarvest(db, memberId, state, turn); // W1 true lines / the W2 image → Playbook keepers
    // W2 completing OPENS the practice week (Decision MM R4) — the daily "step into your picture" nudge on the hero.
    // Best-effort: a scaffold hiccup never fails the conversation turn.
    if (session === 'w2' && turn.complete) {
      try {
        await startPracticeWeek(db, memberId, 'w2_image');
      } catch {
        /* swallow — the session still completed; the nudge is a bonus, not load-bearing */
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
