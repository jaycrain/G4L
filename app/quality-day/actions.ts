'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { reclaimEnabled } from '../../lib/agent/reclaim.ts';
import { logQualityDay } from '../../lib/reclaim/quality-day-store.ts';
import { earnBadge } from '../../lib/curriculum/store.ts';
import { memberToday } from '../../lib/time/zone-store.ts';
import { canLogOn } from '../../lib/practice/mark.ts';

// Log today's Quality Day (Reclaim C3, source /quality-day). One entry per day (upsert). Score 1–10; present = the
// element labels that showed up; two short reflections. Manual only (OO). Flag-gated (RECLAIM).
export async function logQualityDayAction(
  memberId: string,
  score: number,
  present: string[],
  mostValuable?: string,
  mostMissing?: string,
  loggedOn?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Not available.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const s = Math.round(Number(score));
  if (!(s >= 1 && s <= 10)) return { ok: false, error: 'Pick a score from 1 to 10.' };
  try {
    const db = (await getDb()) as unknown as Db;
    // THE DATE IS RE-DECIDED HERE, never taken on trust. It reaches this action from a query string the member
    // could edit, and a client that skipped the page's own check would otherwise write any day it liked —
    // rewriting history the grid then reports as fact. Anything that fails canLogOn falls back to today, which is
    // what the form did before this parameter existed.
    const today = await memberToday(db, memberId);
    const on = loggedOn && /^\d{4}-\d{2}-\d{2}$/.test(loggedOn) && canLogOn(loggedOn, today) ? loggedOn : today;
    await logQualityDay(db, memberId, {
      loggedOn: on,
      score: s,
      present: Array.isArray(present) ? present.filter((p) => typeof p === 'string') : [],
      mostValuable: typeof mostValuable === 'string' ? mostValuable : undefined,
      mostMissing: typeof mostMissing === 'string' ? mostMissing : undefined,
    });
    // The "You lived quality days" badge earns HERE — when they actually LOG a quality day (living the tracking week),
    // not when they DEFINE one at the C3 close (Donna: the badge should follow the week of tracking). Idempotent.
    await earnBadge(db, memberId, 'quality-days').catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not log — please try again.' };
  }
}
