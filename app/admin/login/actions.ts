'use server';

import { adminLogin } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { isThrottled, recordFailure, clearFailures, callerIp } from '../../../lib/auth/rate-limit.ts';
import type { Db } from '../../../lib/db/schema.ts';

// THROTTLED (SEC-02). This is the highest-value single credential in the product: the admin cookie makes
// authorizeMember return true for EVERY member, so one guessed password reads every member's identity story,
// Playbook and transcripts. It is a single shared human-chosen password with no second factor — unlimited
// guessing against that is the whole attack. Tighter ceiling than member login (5 per IP / 15 min).
export async function adminLoginAction(password: string, email?: string): Promise<{ ok: boolean }> {
  const db = (await getDb()) as unknown as Db;
  const ip = (await callerIp()) ?? 'unknown';
  if (await isThrottled(db, 'admin_ip', ip)) return { ok: false };
  // Per-ADDRESS throttle as well as per-IP. Without it, an attacker rotating IPs gets unlimited guesses against
  // one known operator address — and operator addresses are guessable in a way the shared password never was.
  const addr = (email ?? '').trim().toLowerCase();
  if (addr && (await isThrottled(db, 'login_email', addr))) return { ok: false };
  const ok = await adminLogin(password, email);
  if (ok) {
    await clearFailures(db, 'admin_ip', ip);
    if (addr) await clearFailures(db, 'login_email', addr);
  } else {
    await recordFailure(db, 'admin_ip', ip);
    if (addr) await recordFailure(db, 'login_email', addr);
  }
  return { ok };
}
