'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { redesignEnabled } from '../../lib/dashboard/redesign.ts';
import { logMovement, isMovementKind } from '../../lib/movement/store.ts';
import { syncMember, markDisconnected } from '../../lib/activity/store.ts';
import { stravaConfigured } from '../../lib/activity/strava.ts';
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

// Manual "Sync now" — a member-triggered provider pull that BYPASSES the on-open 5-min throttle, so a ride they just
// finished (or one held up by upload lag) can be fetched on demand instead of waiting for the next page open or the
// nightly cron. Same failure posture as the cron/on-open path: a revoked/unrefreshable grant marks the member
// disconnected (surfaces a reconnect) rather than throwing. Returns how many activities were written this pull.
export async function syncNowAction(memberId: string): Promise<{ ok: boolean; synced?: number; error?: string }> {
  if (!redesignEnabled()) return { ok: false, error: 'Movement is not available.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!stravaConfigured()) return { ok: false, error: 'Sync is not available right now.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const synced = await syncMember(db, memberId, 'strava', 30);
    revalidatePath(`/movement/${memberId}`);
    return { ok: true, synced };
  } catch {
    // Revoked grant / unrefreshable token — same reconnect behaviour as the cron + on-open sync.
    try {
      const db = (await getDb()) as unknown as Db;
      await markDisconnected(db, memberId, 'strava');
      revalidatePath(`/movement/${memberId}`);
    } catch {
      /* leave it; the next open (or the cron) retries */
    }
    return { ok: false, error: 'Could not reach Strava. If this keeps happening, reconnect from Account.' };
  }
}
