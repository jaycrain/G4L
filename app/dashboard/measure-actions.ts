'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { logReadingById, createMeasure, listMeasures, type MeasureDirection, type MeasureView } from '../../lib/measure/store.ts';
import { appendMessages } from '../../lib/agent/conversation.ts';
import type { Db } from '../../lib/db/schema.ts';

// The companion "notices" a dashboard tracker action by dropping a brief note into the chat thread
// (it surfaces in the open chat on its next poll, or waits there for the member). Plain and warm —
// gives the number context, never grades or praises it. Best-effort: never blocks the core write.
async function postTrackerNote(db: Db, memberId: string, text: string): Promise<void> {
  try {
    // Only chime in if the companion thread already exists — never let a tracker note become the
    // member's very first chat message (that's the warm welcome's job).
    const { rows } = await db.query<{ one: number }>('select 1 as one from agent_message where member_id=$1 limit 1', [memberId]);
    if (rows.length === 0) return;
    await appendMessages(db, memberId, [{ role: 'agent', text }]);
  } catch {
    /* a missing note must never fail the log/create */
  }
}

function logNote(m: MeasureView, value: number): string {
  const u = m.unit ? ` ${m.unit}` : '';
  if (m.atTarget) return `${m.label}: ${value}${u} — that reaches your target. Noted, and noticed.`;
  if (m.startValue != null && m.latestValue != null) {
    const delta = Math.round((m.latestValue - m.startValue) * 10) / 10;
    const towardTarget = m.direction === 'down' ? delta < 0 : delta > 0;
    if (delta !== 0 && towardTarget) {
      const word = m.direction === 'down' ? 'down' : 'up';
      return `${m.label}: ${value}${u} — ${Math.abs(delta)}${u} ${word} from where you started. I'm tracking it with you.`;
    }
  }
  return `${m.label}: ${value}${u} — logged. I've got it.`;
}

/** Manual log from the dashboard card. Value comes from a number input; date defaults to today. */
export async function logMeasureReadingAction(
  memberId: string,
  measureId: string,
  value: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const res = await logReadingById(db, memberId, measureId, value);
    if (!res.ok) return { ok: false, error: res.reason === 'nomatch' ? 'That measure no longer exists.' : 'Enter a number.' };
    const view = (await listMeasures(db, memberId)).find((m) => m.id === measureId);
    if (view) await postTrackerNote(db, memberId, logNote(view, value));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save that just now.' };
  }
}

/** Create a tracker from the dashboard "Track this" affordance, linked to a Reclaim goal. */
export async function createMeasureForItemAction(
  memberId: string,
  reclaimItemId: string,
  input: { label: string; unit: string; direction: MeasureDirection; startValue: number | null; currentValue: number | null; targetValue: number | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const label = (input.label ?? '').trim();
  if (!label) return { ok: false, error: 'Give it a name.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const res = await createMeasure(db, memberId, {
      label,
      unit: input.unit,
      direction: input.direction === 'down' ? 'down' : 'up',
      startValue: Number.isFinite(input.startValue as number) ? input.startValue : null,
      targetValue: Number.isFinite(input.targetValue as number) ? input.targetValue : null,
      reclaimItemId,
    });
    if (!res.ok) return { ok: false, error: res.reason === 'duplicate' ? 'You already have a tracker by that name.' : 'Give it a name.' };
    // Seed the member's current value as the first reading, so the card shows it (and an accumulation
    // goal — baselined at 0 — reads as moving right away).
    if (Number.isFinite(input.currentValue as number)) {
      await logReadingById(db, memberId, res.id, input.currentValue as number);
    }
    await postTrackerNote(db, memberId, `Tracking ${label} now — I'll keep an eye on it with you.`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not set that up just now.' };
  }
}
