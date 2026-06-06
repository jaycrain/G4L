'use server';

import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/pglite.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import type { Db } from '../../lib/db/schema.ts';

export type IdqState = { errors?: string[] } | null;

export async function submitIdqAction(_prev: IdqState, formData: FormData): Promise<IdqState> {
  const memberId = String(formData.get('member') ?? '');
  if (!memberId) return { errors: ['missing member'] };
  const responses = Array.from({ length: 24 }, (_, i) => Number(formData.get(`item_${i}`)));

  const db = (await getDb()) as unknown as Db;
  const res = await submitIdq(db, memberId, responses);
  if (!res.ok) return { errors: res.errors };
  redirect(`/dashboard/${memberId}`); // throws NEXT_REDIRECT
}
