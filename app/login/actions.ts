'use server';

import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { findCredentialByEmail } from '../../lib/auth/store.ts';
import { verifyPassword } from '../../lib/auth/password.ts';
import { startSession, endSession } from '../auth.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function loginAction(
  email: string,
  password: string,
): Promise<{ ok: boolean; memberId?: string; error?: string }> {
  const db = (await getDb()) as unknown as Db;
  const cred = await findCredentialByEmail(db, (email ?? '').trim());
  // Generic message — don't reveal whether the email exists.
  if (!cred || !(await verifyPassword(password ?? '', cred.password_hash))) {
    return { ok: false, error: 'That email or password is incorrect.' };
  }
  await startSession(cred.member_id);
  return { ok: true, memberId: cred.member_id };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/login?out=1');
}
