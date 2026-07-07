'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';
import { rewireEnabled, rewireOpening, liveTurnRewire } from '../../lib/agent/rewire.ts';
import { emitHarvestMoment, commitKeeper, type KeeperType } from '../../lib/agent/harvest.ts';

// v2.3 Rewire server actions (W1 · the Disinformation Audit). Flag-gated (REWIRE). Conversation state is held
// client-side for the walk; the true lines the member writes are harvested to the Playbook (default-emit,
// member-owned) as they land. No captures are read for W1 (W2's callback to the Reconnect Spark arrives later).

export async function startRewireAction(memberId: string): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
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
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // Every turn is a live model turn — the model supplies the per-domain reflection; the kernel sequences + harvests.
    const turn = await liveTurnRewire(state, history, message);
    const db = (await getDb()) as unknown as Db;
    await persistRewireHarvest(db, memberId, state, turn); // W1 true lines → Playbook keepers
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
