'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { logReadingById } from '../../lib/measure/store.ts';
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
