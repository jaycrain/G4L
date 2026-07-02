'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { applyReconnectTurn, loadReconnectCaptures, reconnectEnabled, reconnectOpening } from '../../lib/agent/reconnect.ts';

// v2.2 Reconnect — SKELETON server actions. Flag-gated and read-only: the callback READS the committed captures
// and opens; the entry stage hands into the (stubbed) Doors excavation. No session persistence yet — the walk
// holds state client-side (the real session store + the live model call arrive with the Doors beat, §2b).

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
  // Skeleton: the entry (callback) stage is deterministic — it acknowledges and advances to the Doors stub, so
  // no model call yet. The live model turn lands with the Doors excavation (§2b).
  const turn = applyReconnectTurn(state, history, message, { text: '' });
  return { ok: true, reply: turn.reply, state: turn.state };
}
