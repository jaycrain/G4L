'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { isAdmin } from '../authz.ts';
import { setContentStatus, resolveReport } from '../../lib/connect/moderation.ts';
import type { Db } from '../../lib/db/schema.ts';

async function adminDb(): Promise<Db> {
  if (!(await isAdmin())) redirect('/admin/login');
  return (await getDb()) as unknown as Db;
}

// Hide (soft) or remove (hard) the reported content, and close the report.
export async function moderateAction(
  action: 'hide' | 'remove' | 'dismiss',
  reportId: string,
  kind: 'post' | 'reply' | 'member',
  subjectId: string,
): Promise<void> {
  const db = await adminDb();
  if (action !== 'dismiss' && (kind === 'post' || kind === 'reply')) {
    await setContentStatus(db, kind, subjectId, action === 'remove' ? 'removed' : 'hidden');
  }
  await resolveReport(db, reportId);
  revalidatePath('/admin');
}
