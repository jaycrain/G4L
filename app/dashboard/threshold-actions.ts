'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Stamp the once-per-member Threshold flag when the member clips in (completes the ceremony). */
export async function markThresholdCrossedAction(memberId: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await db.query(
      'update member_profile set threshold_crossed_at = now() where member_id=$1 and threshold_crossed_at is null',
      [memberId],
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
