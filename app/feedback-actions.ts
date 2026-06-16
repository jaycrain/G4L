'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../lib/db/index.ts';
import { currentMemberId } from './auth.ts';
import { isAdmin } from './authz.ts';
import { logFeedback, setFeedbackStatus, type FeedbackKind, type FeedbackStatus } from '../lib/feedback/store.ts';
import { getMemberEvents } from '../lib/telemetry/store.ts';
import type { Db } from '../lib/db/schema.ts';

// File a piece of feedback. Resolves WHO from the session/admin cookie server-side, so the widget
// never has to know the member id. Auto-attaches the page + the member's recent telemetry trail so a
// one-line report arrives with the context to act on.
export async function submitFeedbackAction(
  kind: FeedbackKind,
  body: string,
  surface: string,
): Promise<{ ok: boolean }> {
  const db = (await getDb()) as unknown as Db;
  const memberId = await currentMemberId();
  const admin = await isAdmin();
  if (!memberId && !admin) return { ok: false }; // only authenticated members/operators

  let author: string | null = null;
  const context: Record<string, unknown> = { path: surface };

  if (memberId) {
    const prof = (
      await db.query<{ display_name: string; email: string }>(
        'select display_name, email from member_profile where member_id=$1',
        [memberId],
      )
    ).rows[0];
    author = prof ? `${prof.display_name} <${prof.email}>` : null;
    const recent = (await getMemberEvents(db, memberId)).slice(-10);
    context.recentEvents = recent.map((e) => ({ kind: e.kind, surface: e.surface, ref: e.ref, step: e.step, at: e.createdAt }));
  } else {
    author = 'Operator';
  }

  const ok = await logFeedback(db, { memberId, author, kind, body, surface, context });
  if (ok) revalidatePath('/admin');
  return { ok };
}

// Operator-only: move a feedback item through new → triaged → resolved.
export async function setFeedbackStatusAction(id: string, status: FeedbackStatus): Promise<void> {
  if (!(await isAdmin())) return;
  const db = (await getDb()) as unknown as Db;
  await setFeedbackStatus(db, id, status);
  revalidatePath('/admin');
}
