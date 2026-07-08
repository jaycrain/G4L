'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { logCall, isCallType, type CallType } from '../../lib/momentum/store.ts';

// Log a Momentum call from the /momentum quick-log (source 'momentum_page') — the SAME primitive the rail's log_call
// uses (no wrong door, Decision FF). Flag-gated (REWIRE); prod stays v2.
export async function logCallAction(memberId: string, type: CallType, note?: string): Promise<{ ok: boolean; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Not available.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!isCallType(type)) return { ok: false, error: 'Unrecognized call.' };
  try {
    const db = (await getDb()) as unknown as Db;
    await logCall(db, memberId, { type, note: note?.trim() || undefined, source: 'momentum_page' });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not log — please try again.' };
  }
}
