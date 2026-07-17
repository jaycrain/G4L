'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { redesignEnabled } from '../../lib/dashboard/redesign.ts';
import { logMovement, isMovementKind } from '../../lib/movement/store.ts';
import type { Db } from '../../lib/db/schema.ts';

// Log a member's own activity from the Movement page (source 'self'). The Companion writes the same store as
// 'companion' via its log_movement tool (checkin-actions). Additive; no scoring.
export async function logMovementAction(
  memberId: string,
  input: { activityType: string; note?: string; occurredOn?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!redesignEnabled()) return { ok: false, error: 'Movement is not available.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!isMovementKind(input.activityType)) return { ok: false, error: 'Pick an activity type.' };
  try {
    const db = (await getDb()) as unknown as Db;
    await logMovement(db, memberId, {
      activityType: input.activityType,
      note: input.note,
      occurredOn: input.occurredOn,
      source: 'self',
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not log that — please try again.' };
  }
}
