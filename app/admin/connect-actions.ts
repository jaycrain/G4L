'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { isAdmin } from '../authz.ts';
import { setContentStatus, resolveReport } from '../../lib/connect/moderation.ts';
import { foundersAuthorId } from '../../lib/connect/founders.ts';
import { createPost } from '../../lib/connect/write.ts';
import type { Db } from '../../lib/db/schema.ts';

async function adminDb(): Promise<Db> {
  if (!(await isAdmin())) redirect('/admin/login');
  return (await getDb()) as unknown as Db;
}

// Hide (soft) or remove (hard) the reported content, and close the report.
export async function moderateAction(
  action: 'hide' | 'remove' | 'dismiss',
  reportId: string,
  kind: 'post' | 'reply' | 'member' | 'room_message',
  subjectId: string,
): Promise<void> {
  const db = await adminDb();
  if (action !== 'dismiss' && kind !== 'member') {
    await setContentStatus(db, kind, subjectId, action === 'remove' ? 'removed' : 'hidden');
  }
  await resolveReport(db, reportId);
  revalidatePath('/admin');
}

/**
 * POST TO THE COMMUNITY AS THE FOUNDERS.
 *
 * The seeded discussion topics are the first use, but the reason this is an action rather than a script is that
 * Jay wanted to be able to trigger it himself: "Probably not a bad feature to have, Founder-authored. Just need
 * to know how to trigger it myself."
 *
 * THE NAME IS NOT SOMETHING THE SYSTEM HANDS OUT. The author is resolved server-side from the Founders' own row —
 * it is never taken from the caller — so an operator session cannot author in the Founders' name by passing an
 * id. That is the same posture as the Founder Agent's no-auto-send rule: being able to reach the surface is not
 * the same as being able to speak as someone.
 *
 * `showName: true` because "The Founders" IS the display name and members are meant to see it. It is also the one
 * name our no-real-names ruling permits, precisely because it is not a person.
 */
export async function postAsFoundersAction(
  input: { title: string; body: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;

  const author = await foundersAuthorId(db);
  // TOLD PLAINLY RATHER THAN FAILING QUIETLY. The row is created by hand (scripts/db/founders-account.sql), so
  // "not set up yet" is a real state on a fresh environment and the operator should hear which thing is missing.
  if (!author) {
    return { ok: false, error: 'The Founders account does not exist yet — run scripts/db/founders-account.sql first.' };
  }

  const title = (input.title ?? '').trim();
  if (!title) return { ok: false, error: 'Give the topic a title — it is what members see in the list.' };

  const res = await createPost(db, author, { title, body: input.body, showName: true });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath('/admin/connect');
  return { ok: true };
}
