'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';
import {
  rewireEnabled,
  rewireOpening,
  liveTurnRewire,
  rewireW2Opening,
  liveTurnRewireW2,
  rewireW3Opening,
  liveTurnRewireW3,
  type W3Callback,
} from '../../lib/agent/rewire.ts';
import { loadReconnectCaptures } from '../../lib/agent/reconnect.ts';
import { emitHarvestMoment, commitKeeper, type KeeperType } from '../../lib/agent/harvest.ts';
import { startPracticeWeek, latestImageKeeper } from '../../lib/practice/store.ts';

// Which Rewire session — W1 (Disinformation Audit), W2 (Visualization Workshop), W3 (False Start Protocol). All ride
// the same flag, surface, and harvest seam; W2 reads the Reclaim List, W3 additionally pulls the W1 true lines + the
// W2 image FORWARD (the toolkit clicking together).
export type RewireSession = 'w1' | 'w2' | 'w3';

// The member's W1 true lines (principle keepers) — pulled forward at the W3 Reframe. Graceful degrade to [] if none.
async function loadTrueLines(db: Db, memberId: string): Promise<string[]> {
  try {
    return (
      await db.query<{ body: string }>(
        `select body from playbook_entry where member_id=$1 and state='kept' and keeper_type='principle' order by created_at`,
        [memberId],
      )
    ).rows.map((r) => r.body);
  } catch {
    return [];
  }
}

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
  if (session === 'w3') {
    // W3 pulls the prior tools FORWARD — the W1 true lines + the W2 image — plus grounding. Graceful degrade to [].
    const db = (await getDb()) as unknown as Db;
    const [committed, trueLines, image] = await Promise.all([
      loadReconnectCaptures(db, memberId),
      loadTrueLines(db, memberId),
      latestImageKeeper(db, memberId).catch(() => null),
    ]);
    const cb: W3Callback = {
      trueLines,
      image: image ?? undefined,
      reclaimList: committed?.reclaimList ?? [],
      identityNoun: committed?.identityNoun,
    };
    const turn = rewireW3Opening(cb);
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
    const turn =
      session === 'w3'
        ? await liveTurnRewireW3(state, history, message)
        : session === 'w2'
          ? await liveTurnRewireW2(state, history, message)
          : await liveTurnRewire(state, history, message);
    const db = (await getDb()) as unknown as Db;
    await persistRewireHarvest(db, memberId, state, turn); // true lines / image / protocol → Playbook keepers
    // Completing a session OPENS its practice week (Decision MM R4). W2 → the "step into your picture" nudge; W3 →
    // the (dormant until Momentum) logging window. Best-effort: a scaffold hiccup never fails the conversation turn.
    if (turn.complete && (session === 'w2' || session === 'w3')) {
      try {
        await startPracticeWeek(db, memberId, session === 'w3' ? 'w3_logging' : 'w2_image');
      } catch {
        /* swallow — the session still completed; the nudge is a bonus, not load-bearing */
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
