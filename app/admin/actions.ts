'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import { generateDraft, type FounderContext, type OperatingMoment } from '../../lib/founder/draft.ts';
import { createDraft, approveSend, rejectDraft } from '../../lib/founder/store.ts';
import type { Db } from '../../lib/db/schema.ts';

async function founderContext(db: Db, memberId: string): Promise<FounderContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  const prof = (
    await db.query<{ intake_right_now: string | null }>('select intake_right_now from member_profile where member_id = $1', [memberId])
  ).rows[0];
  return {
    firstName: (dash.displayName || '').split(/\s+/)[0] ?? '',
    identityNoun: dash.identityNoun,
    doorDisplayName: dash.door?.displayName ?? null,
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null,
    intakeQuote: prof?.intake_right_now ?? null,
  };
}

export async function generateDraftAction(memberId: string, moment: OperatingMoment): Promise<void> {
  const db = (await getDb()) as unknown as Db;
  const ctx = await founderContext(db, memberId);
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
