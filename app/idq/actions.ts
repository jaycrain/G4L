'use server';

import { getDb } from '../../lib/db/pglite.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Score + persist a completed 24-item IDQ response set. The conversation runs client-side
 *  (deterministic); only the final scoring/persistence touches the server. */
export async function submitIdqResponses(
  memberId: string,
  responses: number[],
): Promise<{ ok: boolean; errors?: string[] }> {
  const db = (await getDb()) as unknown as Db;
  const res = await submitIdq(db, memberId, responses);
  return res.ok ? { ok: true } : { ok: false, errors: res.errors };
}
