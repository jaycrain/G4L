'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { generateDraft, type OperatingMoment } from '../../lib/founder/draft.ts';
import { buildFounderContext } from '../../lib/founder/context.ts';
import { createDraft, approveSend, rejectDraft } from '../../lib/founder/store.ts';
import { buildNudge } from '../../lib/agent/nudge.ts';
import { sendPushToMember } from '../../lib/push/send.ts';
import { buildNudgePayload } from '../../lib/push/payload.ts';
import { isAdmin } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function generateDraftAction(memberId: string, moment: OperatingMoment): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  const ctx = await buildFounderContext(db, memberId);
  if (!ctx) return;
  const draft = await generateDraft(moment, ctx);
  await createDraft(db, { memberId, moment, draft, inputSnapshot: ctx });
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}

export async function approveSendAction(id: string, memberId: string, editedBody: string): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  await approveSend(db, id, editedBody);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}

/** Push the member's current Member Agent nudge to their devices (proactive companion, live). */
export async function sendNudgePushAction(memberId: string): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  const nudge = await buildNudge(db, memberId);
  if (!nudge) return;
  await sendPushToMember(db, memberId, buildNudgePayload(nudge, memberId));
  revalidatePath(`/admin/member/${memberId}`);
}

export async function rejectAction(id: string, memberId: string): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  await rejectDraft(db, id);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}
