'use server';

import { authorizeMember } from '../authz.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { reclaimEnabled, reclaimC1Opening, liveTurnReclaimC1 } from '../../lib/agent/reclaim.ts';

// v2.5 Reclaim server actions. SLICE 1 = C1 · Readiness Assessment. Step 1 (here) is the administered evidence
// self-check — deterministic (no model call) and FORMATIVE (RC-2: nothing persisted). Flag-gated (RECLAIM).
export type ReclaimSession = 'c1';

export async function startReclaimAction(
  memberId: string,
  _session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn = reclaimC1Opening();
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
    // C1 Step 1 is ADMINISTERED + FORMATIVE — deterministic, and nothing is persisted (RC-2).
    const turn = liveTurnReclaimC1(state, history, message);
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
