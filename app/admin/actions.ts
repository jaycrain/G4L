'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { generateDraft, type OperatingMoment } from '../../lib/founder/draft.ts';
import { buildFounderContext } from '../../lib/founder/context.ts';
import { createDraft, approveSend, rejectDraft, getDraft } from '../../lib/founder/store.ts';
import { sendEmail } from '../../lib/email/send.ts';
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

export async function approveSendAction(
  id: string,
  memberId: string,
  editedBody: string,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const draft = await getDraft(db, id);
  if (!draft) return { ok: false, message: 'Draft not found.' };
  const member = (
    await db.query<{ email: string }>('select email from member_profile where member_id=$1', [memberId])
  ).rows[0];
  if (!member?.email) return { ok: false, message: 'No email on file for this member.' };

  const body = editedBody?.trim() ? editedBody : draft.draft_body;
  const result = await sendEmail({ to: member.email, subject: draft.draft_subject, text: body });

  // Only mark it sent if an email actually went out — never claim "sent" when it didn't.
  if (result.skipped) {
    return { ok: false, message: 'Email isn’t connected yet — add RESEND_API_KEY + EMAIL_FROM, then send again.' };
  }
  if (!result.ok) {
    return { ok: false, message: `Email failed — ${result.error}. Left as pending so you can retry.` };
  }
  await approveSend(db, id, editedBody);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
  return { ok: true, message: `Sent to ${member.email}.` };
}

/** Push the member's current Member Agent nudge to their devices; report the result to the operator. */
export async function sendNudgePushAction(memberId: string): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const nudge = await buildNudge(db, memberId);
  if (!nudge) return { ok: false, message: 'No member or nudge to send.' };
  const r = await sendPushToMember(db, memberId, buildNudgePayload(nudge, memberId));
  revalidatePath(`/admin/member/${memberId}`);
  if (r.sent > 0) {
    return {
      ok: true,
      message: `Accepted by the push service for ${r.sent} device${r.sent === 1 ? '' : 's'}${r.pruned ? ` (${r.pruned} expired removed)` : ''}. Note: on iPhone/iPad it only appears if they installed the app to their home screen and allowed notifications.`,
    };
  }
  if (r.pruned > 0) return { ok: false, message: `No active devices — ${r.pruned} expired subscription removed. Ask them to turn notifications on again.` };
  if (r.failed > 0) return { ok: false, message: `The push service rejected the send for ${r.failed} device${r.failed === 1 ? '' : 's'}.` };
  return { ok: false, message: 'No subscribed devices for this member.' };
}

export async function rejectAction(id: string, memberId: string): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  await rejectDraft(db, id);
  revalidatePath(`/admin/member/${memberId}`);
  revalidatePath('/admin');
}
