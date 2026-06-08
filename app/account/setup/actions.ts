'use server';

import { getDb } from '../../../lib/db/index.ts';
import { createCredential, hasCredential } from '../../../lib/auth/store.ts';
import { hashPassword } from '../../../lib/auth/password.ts';
import { startSession } from '../../auth.ts';
import type { Db } from '../../../lib/db/schema.ts';

export async function setupAction(memberId: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!password || password.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  const db = (await getDb()) as unknown as Db;
  // First-time setup only — never overwrite an account that already has a password.
  if (await hasCredential(db, memberId)) return { ok: false, error: 'This account already has a password. Please log in.' };
  const m = (await db.query<{ email: string }>('select email from member_profile where member_id = $1', [memberId])).rows[0];
  if (!m) return { ok: false, error: 'We could not find that account.' };
  await createCredential(db, memberId, m.email, await hashPassword(password));
  await startSession(memberId);
  return { ok: true };
}
