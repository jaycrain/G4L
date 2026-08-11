'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { logCall, isCallType, isCallDomain, type CallType, type CallDomain } from '../../lib/momentum/store.ts';
import { activePracticeWeek, practiceWeekOfKind, PRACTICE_WINDOW_DAYS, type PracticeKind } from '../../lib/practice/store.ts';
import { toggleMark } from '../../lib/practice/mark.ts';

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

// Tick (or un-tick) one cell of the week grid. The member owns their own record, so this is a TOGGLE, not an
// append — a mis-tap has to be undoable without asking anyone.
//
// The day is addressed by INDEX INTO THE WINDOW, not by a date from the browser: a client clock that is wrong, or
// simply in another timezone, would otherwise write the mark onto the wrong day. The server resolves index → date
// from the week's own started_at, which is the only clock that matters here.
export async function toggleMarkAction(
  memberId: string,
  slot: string,
  dayIndex: number,
  /** WHICH week this tap was made in. Optional only so an older client can't 500; always sent by the grid.
   *  Without it the server fell back to the NEWEST week — fine while one grid rendered, and a cross-write the
   *  moment the Playbook shows several (Jay's four live weeks, 2026-08-11). A tap must land in the grid it was
   *  made in, so the grid names it. */
  kind?: PracticeKind,
): Promise<{ ok: boolean; on?: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= PRACTICE_WINDOW_DAYS) return { ok: false, error: 'Not a day in this week.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const pw = kind ? await practiceWeekOfKind(db, memberId, kind) : await activePracticeWeek(db, memberId);
    if (!pw) return { ok: false, error: 'No practice week is open.' };
    if (dayIndex > pw.day - 1) return { ok: false, error: "That day hasn't happened yet." };
    return await toggleMark(db, memberId, pw, slot, dayIndex, 'grid');
  } catch (e) {
    console.error(`toggleMarkAction failed member=${memberId} slot=${slot} day=${dayIndex}:`, e);
    return { ok: false, error: 'Could not save that — please try again.' };
  }
}
