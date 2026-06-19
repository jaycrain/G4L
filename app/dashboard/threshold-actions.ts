'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { writeAsActor } from '../../lib/db/actor.ts';

/** Stamp the once-per-member Threshold flag when the member clips in (completes the ceremony). */
export async function markThresholdCrossedAction(memberId: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await writeAsActor(db, 'member', (tx) =>
      tx.query(
        'update member_profile set threshold_crossed_at = now() where member_id=$1 and threshold_crossed_at is null',
        [memberId],
      ),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Stamp the once-per-member Post-Ceremony Tour flag when the member finishes or skips the tour. */
export async function completeTourAction(memberId: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await writeAsActor(db, 'member', (tx) =>
      tx.query(
        'update member_profile set tour_completed_at = now() where member_id=$1 and tour_completed_at is null',
        [memberId],
      ),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
