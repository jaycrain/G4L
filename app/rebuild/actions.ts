'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { rebuildEnabled, rebuildB1Opening, liveTurnRebuildB1 } from '../../lib/agent/rebuild.ts';
import { persistWhyReading } from '../../lib/rebuild/store.ts';
import { WHY_ITEM_COUNT } from '../../lib/rebuild/why-instrument.ts';

// v2.4 Rebuild server actions. SLICE 1 = B1 · "What is Your Why?" — an ADMINISTERED SDT read (deterministic Likert,
// no model call). Flag-gated (REBUILD). Conversation state is held client-side for the walk; on completion the SDT
// profile is scored + stored (RB-1: stored, never shown). The forecast/journey wiring is a later Rebuild slice.
export type RebuildSession = 'b1';

export async function startRebuildAction(
  memberId: string,
  _session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn = rebuildB1Opening();
  return { ok: true, reply: turn.reply, state: turn.state };
}

export async function rebuildTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  _session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // B1 is ADMINISTERED (deterministic Likert parse) — no model call needed.
    const turn = liveTurnRebuildB1(state, history, message);
    // On completion: score the 12 responses → the SDT profile → store it (RB-1: stored, not displayed). Best-effort —
    // a write hiccup never breaks the member's close; the forward-looking reflection has already been handed over.
    if (turn.complete) {
      const responses = (turn.state.administeredResponses ?? []).slice(0, WHY_ITEM_COUNT);
      if (responses.length === WHY_ITEM_COUNT) {
        try {
          const db = (await getDb()) as unknown as Db;
          await persistWhyReading(db, memberId, responses);
        } catch {
          /* swallow — the member still completed B1; the stored reading is best-effort */
        }
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
