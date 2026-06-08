'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { consumeBite } from '../../lib/bites/store.ts';
import { getBite } from '../../lib/bites/definitions.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function consumeBiteAction(memberId: string, biteCode: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  if (!getBite(biteCode)) return { ok: false }; // only real, registered bites count
  const db = (await getDb()) as unknown as Db;
  await consumeBite(db, memberId, biteCode);
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true };
}
