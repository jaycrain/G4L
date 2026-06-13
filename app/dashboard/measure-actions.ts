'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { logReadingById, createMeasure, type MeasureDirection } from '../../lib/measure/store.ts';
import type { Db } from '../../lib/db/schema.ts';

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
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save that just now.' };
  }
}

/** Create a tracker from the dashboard "Track this" affordance, linked to a Reclaim goal. */
export async function createMeasureForItemAction(
  memberId: string,
  reclaimItemId: string,
  input: { label: string; unit: string; direction: MeasureDirection; startValue: number | null; targetValue: number | null },
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
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not set that up just now.' };
  }
}
