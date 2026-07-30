// Failed-authentication throttle (SEC-02). One primitive, used by member login and admin login.
//
// DESIGN NOTES, because both are deliberate and easy to get wrong:
//
// 1. THE CHECK RUNS BEFORE THE KDF. verifyPassword is scrypt (16MB, ~50–150ms). Checking the limit only after
//    hashing would leave the CPU/memory amplification wide open — an attacker gets the expensive work for free
//    on every guess. Cheap DB count first, expensive hash only if allowed.
//
// 2. THROTTLE, NOT LOCKOUT. There is no password-reset flow yet, so a hard lockout would strand a real member
//    with no way back in — the attacker's goal, achieved for them. We slow guessing to uselessness instead, and
//    keep the door open for the person who simply mistyped.
//
// 3. IT FAILS OPEN ON INFRASTRUCTURE ERROR, LOUDLY. Prod migrations are hand-applied and drift has happened
//    (see 0042). If auth_attempt is missing, failing CLOSED would lock every member out of the product — a
//    self-inflicted outage worse than the risk it prevents. So a broken limiter logs an error and permits, and
//    the missing migration is meant to be caught by the deploy check, not by members being unable to log in.

import type { Db } from '../db/schema.ts';

export type AuthScope = 'login_email' | 'login_ip' | 'admin_ip';

/** Window + ceiling per scope. Per-email is tight (a real person rarely misses 5×); per-IP is looser so a
 *  shared office/NAT doesn't punish innocents, but still bounds a spray. */
const LIMITS: Record<AuthScope, { max: number; windowMinutes: number }> = {
  login_email: { max: 5, windowMinutes: 15 },
  login_ip: { max: 20, windowMinutes: 15 },
  admin_ip: { max: 5, windowMinutes: 15 },
};

/** True when this subject has spent its allowance. Fails OPEN (returns false) if the limiter itself breaks. */
export async function isThrottled(db: Db, scope: AuthScope, subject: string): Promise<boolean> {
  const s = (subject ?? '').trim().toLowerCase();
  if (!s) return false;
  const { max, windowMinutes } = LIMITS[scope];
  try {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from auth_attempt
        where scope = $1 and subject = $2 and created_at > now() - ($3 || ' minutes')::interval`,
      [scope, s, String(windowMinutes)],
    );
    return Number(rows[0]?.n ?? 0) >= max;
  } catch (e) {
    console.error('SECURITY: auth throttle unavailable — permitting the attempt. Is migration 0062 applied?', (e as Error).message);
    return false;
  }
}

/** Record one FAILED attempt. Never throws — a telemetry failure must not break the login path. */
export async function recordFailure(db: Db, scope: AuthScope, subject: string): Promise<void> {
  const s = (subject ?? '').trim().toLowerCase();
  if (!s) return;
  try {
    await db.query('insert into auth_attempt (scope, subject) values ($1,$2)', [scope, s]);
  } catch (e) {
    console.error('SECURITY: could not record a failed auth attempt.', (e as Error).message);
  }
}

/** Clear a subject's failures after a SUCCESSFUL auth — so a member who finally remembers isn't still throttled. */
export async function clearFailures(db: Db, scope: AuthScope, subject: string): Promise<void> {
  const s = (subject ?? '').trim().toLowerCase();
  if (!s) return;
  try {
    await db.query('delete from auth_attempt where scope = $1 and subject = $2', [scope, s]);
  } catch {
    /* non-fatal */
  }
}

/** Caller IP from the proxy headers Vercel sets. Null when unknown — never guess, never key on something forgeable-to-empty. */
export async function callerIp(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    const ip = (fwd ? fwd.split(',')[0] : h.get('x-real-ip'))?.trim();
    return ip || null;
  } catch {
    return null;
  }
}
