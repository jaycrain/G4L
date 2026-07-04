'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { applyReconnectTurn, liveTurnReconnect, loadReconnectCaptures, reconnectEnabled, reconnectOpening } from '../../lib/agent/reconnect.ts';

// v2.2 Reconnect server actions. Flag-gated. The callback (entry) READS committed captures and opens; the DOORS
// excavation (§2b increment 1) is a live model turn (draw-out + insight). State is client-held for the walk (the
// session store lands with a later increment).

export async function startReconnectAction(memberId: string): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const committed = await loadReconnectCaptures(db, memberId);
  if (!committed) return { ok: false, error: 'We could not find your intake.' };
  const turn = reconnectOpening(committed);
  return { ok: true, reply: turn.reply, state: turn.state };
}

export async function reconnectTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // The entry (callback) stage is deterministic — it acknowledges and advances to Doors, no model needed. From
    // Doors on, it's a live model turn (draw-out + the insight reflect).
    const turn =
      state.stage === 'entry'
        ? applyReconnectTurn(state, history, message, { text: '' })
        : await liveTurnReconnect(state, history, message);
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
