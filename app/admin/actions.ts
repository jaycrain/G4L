'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { generateDraft, type OperatingMoment } from '../../lib/founder/draft.ts';
import { buildFounderContext } from '../../lib/founder/context.ts';
import { createDraft, approveSend, rejectDraft } from '../../lib/founder/store.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function generateDraftAction(memberId: string, moment: OperatingMoment): Promise<void> {
  const db = (await getDb()) as unknown as Db;
  const ctx = await buildFounderContext(db, memberId);
  if (!ctx) return;
  const draft = await generateDraft(moment, ctx);
  await createDraft(db, { memberId, moment, draft, inputSnapshot: ctx });
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}

export async function approveSendAction(id: string, memberId: string, editedBody: string): Promise<void> {
  const db = (await getDb()) as unknown as Db;
  await approveSend(db, id, editedBody);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}

export async function rejectAction(id: string, memberId: string): Promise<void> {
  const db = (await getDb()) as unknown as Db;
  await rejectDraft(db, id);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}
