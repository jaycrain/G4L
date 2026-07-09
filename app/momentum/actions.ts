'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { logCall, isCallType, isCallDomain, type CallType, type CallDomain } from '../../lib/momentum/store.ts';

// Log a Momentum call from the /momentum quick-log (source 'momentum_page') — the SAME primitive the rail's log_call
// uses (no wrong door, Decision FF). `domain` is OPTIONAL (activity/diet — Decision OO, tagged during the B3 pilot; an
// absent/invalid value is simply untagged, never an error — the tag never gates logging). Flag-gated (REWIRE).
export async function logCallAction(memberId: string, type: CallType, note?: string, domain?: CallDomain): Promise<{ ok: boolean; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Not available.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!isCallType(type)) return { ok: false, error: 'Unrecognized call.' };
  try {
    const db = (await getDb()) as unknown as Db;
    await logCall(db, memberId, { type, note: note?.trim() || undefined, domain: isCallDomain(domain) ? domain : undefined, source: 'momentum_page' });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not log — please try again.' };
  }
}
