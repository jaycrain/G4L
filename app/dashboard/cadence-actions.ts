'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { trackReclaimItem } from '../../lib/practice/mark.ts';
import { classifyGoal, cadenceTarget } from '../../lib/reclaim/goal-kind.ts';
import { appendMessages } from '../../lib/agent/conversation.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import type { Db } from '../../lib/db/schema.ts';

/**
 * Start a weekly practice from a Reclaim List item (#155) — the CADENCE counterpart to "Track this".
 *
 * "Track this" creates a Measure: a number you log and watch trend. That is the wrong instrument for "3 times
 * per week", which is a count of days inside a week — the thing `practice_commitment.target_days` and the week
 * grid already model. This action is the second door, not a second version of the first.
 */

/** The Companion notices, the same way it notices a tracker. Best-effort — a missing note never fails the write. */
async function postCadenceNote(db: Db, memberId: string, text: string, target: number | null): Promise<void> {
  try {
    const { rows } = await db.query<{ one: number }>('select 1 as one from agent_message where member_id=$1 limit 1', [memberId]);
    if (rows.length === 0) return; // never let this be a member's first ever message
    // Reflect the commitment back in their own words. NOT "great goal!" — a receipt, not a verdict, and no
    // number invented where they did not give one.
    const aim = target ? ` ${target} days this week` : '';
    await appendMessages(db, memberId, [
      { role: 'agent', text: `Added to your week — “${text}”.${aim ? ` Aiming for${aim}.` : ''} Tell me when you get one in, or tick it on the grid.` },
    ]);
  } catch {
    /* a missing note must never fail the commitment */
  }
}

export async function trackCadenceAction(
  memberId: string,
  item: { id: string; text: string },
): Promise<{ ok: boolean; message?: string }> {
  const ok = await authorizeMember(memberId);
  if (!ok) return { ok: false, message: 'Not authorized.' };

  const text = (item.text ?? '').trim();
  if (!item.id || !text) return { ok: false, message: 'Nothing to track.' };
  // The server decides, not the caller. A client that offered the wrong control — or a stale render after the
  // member reworded the item — must not be able to open a weekly practice on something that is not a cadence.
  if (classifyGoal(text) !== 'cadence') return { ok: false, message: 'That one is not a weekly commitment.' };

  const db = await getDb();
  await trackReclaimItem(db, memberId, { id: item.id, text });
  // Telemetry is TAGGED AFTER the write and swallowed — a metric must never be able to take down a save.
  try {
    await logEvent(db, memberId, 'cadence_week_started', { ref: item.id, meta: { target: cadenceTarget(text) } });
  } catch {
    /* never block the commitment on a telemetry write */
  }
  await postCadenceNote(db, memberId, text, cadenceTarget(text));
  return { ok: true };
}
