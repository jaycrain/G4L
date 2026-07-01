'use server';

import { getDb } from '../../../lib/db/index.ts';
import { createCredential, hasCredential } from '../../../lib/auth/store.ts';
import { hashPassword } from '../../../lib/auth/password.ts';
import { startSession } from '../../auth.ts';
import { stagedEngineEnabled } from '../../../lib/agent/onboarding-staged.ts';
import type { Db } from '../../../lib/db/schema.ts';

export async function setupAction(
  memberId: string,
  password: string,
): Promise<{ ok: boolean; error?: string; code?: 'exists'; next?: string }> {
  if (!password || password.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  const db = (await getDb()) as unknown as Db;
  // First-time setup only — never overwrite an account that already has a password. `code: 'exists'`
  // lets the caller route a returning member to /login instead of stranding them on this error.
  if (await hasCredential(db, memberId)) return { ok: false, code: 'exists', error: 'This account already has a password. Please log in.' };
  const m = (await db.query<{ email: string }>('select email from member_profile where member_id = $1', [memberId])).rows[0];
  if (!m) return { ok: false, error: 'We could not find that account.' };
  await createCredential(db, memberId, m.email, await hashPassword(password));
  await startSession(memberId);
  // v2.1 (flag on) is number-free — hand off STRAIGHT to the dashboard, where the settled Threshold overlay +
  // Post-Ceremony Tour do the honest, personalized handoff (a standalone /onboarding/ceremony page duplicated
  // that and double-ran the whole ceremony — removed). v1 keeps the IDQ hop. Flag-gated so it's safe pre-flip.
  const next = stagedEngineEnabled() ? `/dashboard/${memberId}` : `/idq?member=${memberId}`;
  return { ok: true, next };
}
