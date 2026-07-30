'use server';

import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { findCredentialByEmail } from '../../lib/auth/store.ts';
import { verifyPassword, burnPasswordTime } from '../../lib/auth/password.ts';
import { startSession, endSession } from '../auth.ts';
import { isThrottled, recordFailure, clearFailures, callerIp } from '../../lib/auth/rate-limit.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function loginAction(
  email: string,
  password: string,
): Promise<{ ok: boolean; memberId?: string; error?: string }> {
  const db = (await getDb()) as unknown as Db;
  const addr = (email ?? '').trim();
  const ip = await callerIp();
  // THROTTLE FIRST — before findCredential and before verifyPassword. verifyPassword is scrypt (16MB, ~50–150ms);
  // checking after it would hand an attacker that CPU/memory work for free on every guess. (SEC-02)
  if ((await isThrottled(db, 'login_email', addr)) || (ip && (await isThrottled(db, 'login_ip', ip)))) {
    // Same generic wording as a bad password: never confirm that an address exists, or that it's being targeted.
    return { ok: false, error: 'That email or password is incorrect.' };
  }
  const cred = await findCredentialByEmail(db, addr);
  // SEC-13: when there is no such member we still pay the scrypt cost, against a throwaway hash. Without this the
  // two paths are ~1ms vs ~50-150ms — a stopwatch tells you whether an address is registered, no matter how
  // carefully both branches word their reply. Here that leaks MEMBERSHIP of this program, to anyone, at scale.
  const ok = cred ? await verifyPassword(password ?? '', cred.password_hash) : await burnPasswordTime(password ?? '');
  // Generic message — don't reveal whether the email exists.
  if (!cred || !ok) {
    await recordFailure(db, 'login_email', addr);
    if (ip) await recordFailure(db, 'login_ip', ip);
    return { ok: false, error: 'That email or password is incorrect.' };
  }
  await clearFailures(db, 'login_email', addr); // they got in — don't keep a real member throttled
  await startSession(cred.member_id);
  return { ok: true, memberId: cred.member_id };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/login?out=1');
}
