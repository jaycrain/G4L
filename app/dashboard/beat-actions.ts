'use server';

// Member-facing Beat surface actions. The Member Agent serves one Beat at a time and runs its
// close; both are auth-gated to the member (or admin). The same engine serves every member —
// nothing here is persona-specific.

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { nextBeat, completeBeat, type ServedBeat } from '../../lib/beats/store.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import type { Db } from '../../lib/db/schema.ts';


export type CloseBeatResult = { ok: boolean; next: ServedBeat | null; reclaimed: boolean };

export async function closeBeatAction(
  memberId: string,
  beatId: string,
  response: string,
): Promise<CloseBeatResult> {
  if (!(await authorizeMember(memberId))) return { ok: false, next: null, reclaimed: false };
  const db = (await getDb()) as unknown as Db;
  const res = await completeBeat(db, memberId, beatId, response);
  if (res) await logEvent(db, memberId, 'beat_close', { surface: 'dashboard', ref: beatId, meta: { response } });
  const next = await nextBeat(db, memberId);
  return { ok: !!res, next, reclaimed: res?.itemReclaimed ?? false };
}
