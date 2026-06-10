'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Mark the Field Guide as seen (once-per-member, across devices). Idempotent. */
export async function markFieldGuideSeenAction(memberId: string): Promise<void> {
  if (!(await authorizeMember(memberId))) return;
  const db = (await getDb()) as unknown as Db;
  await db.query(
    'update member_profile set field_guide_seen_at = now() where member_id=$1 and field_guide_seen_at is null',
    [memberId],
  );
}
