'use server';

// The mobile HOME cover's server actions. One call today: retire a milestone celebration once the member has engaged
// with it (dismiss or tap-through) so it never re-greets. Gated by authorizeMember; degrades to a no-op, never throws
// to the UI (a failed marker just means the celebration greets once more).

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { markMilestoneSeen } from '../../lib/dashboard/home-state.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function markMilestoneSeenAction(memberId: string, badgeId: string): Promise<void> {
  if (!badgeId || !(await authorizeMember(memberId))) return;
  try {
    const db = (await getDb()) as unknown as Db;
    await markMilestoneSeen(db, memberId, badgeId);
  } catch (e) {
    console.error('markMilestoneSeenAction failed:', (e as Error).message);
  }
}
