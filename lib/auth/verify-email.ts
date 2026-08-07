// THIS LIVES IN lib/ ON PURPOSE, AND THAT IS THE WHOLE POINT OF THE FILE.
//
// It used to live in `app/login/reset-actions.ts`, which begins with `'use server'`. In such a module, `export`
// does not mean "importable by my other server code" — it means **published as an RPC endpoint on the public
// internet**. Next compiles every export into a POST handler that accepts the caller's arguments. Nobody decided
// to expose this function; it was exposed by the file it sat in.
//
// What that made reachable (found 2026-08-07 by the authz enumeration in tests/authz-coverage.test.ts):
// an unauthenticated caller could hand us ANY email address and ANY member id and we would mint a verification
// token and send mail to that address. Concretely:
//
//   1. MAIL RELAY. Our Resend account, our domain, our branding, sending "Welcome to Grinta for Life — confirm
//      this is your address" to anyone. That is a phishing primitive built on our own reputation, and if the
//      provider suspends us for abuse, real members lose password reset.
//   2. VERIFICATION DENIAL. issueToken() first consumes every outstanding token for that address
//      (lib/auth/tokens.ts) — so repeated calls with a known member's email keep invalidating the link they are
//      trying to click, while mailing them each time. Scoped to purpose='verify_email', so it cannot touch a
//      password reset; that limit is real and worth stating.
//   3. No rate limit, on a file where the login path next door is carefully throttled. The asymmetry is the tell:
//      the login path was thought about as a path, and this was not thought of as one at all.
//
// What it did NOT make reachable, stated plainly so the record isn't scarier than the truth: account takeover.
// markEmailVerified() keys on the EMAIL, not the member id (lib/auth/store.ts) — so a token minted with a
// victim's member id and an attacker's address verifies the attacker's own address and updates zero rows. The
// member id rides along and does nothing. Also, no client component ever imported this, so its action id never
// appeared in a shipped bundle. That raises the bar; it is NOT a boundary — action ids are deterministic build
// artifacts, not secrets, and Next does not treat them as authorization.
//
// THE FIX IS THE MOVE, not a guard. A session check would have left an endpoint that has no reason to exist.
// Deleting the endpoint is the smaller and more durable change: this is ordinary server code again, callable by
// our signup path and by nothing else.

import { issueToken } from './tokens.ts';
import { sendEmail } from '../email/send.ts';
import type { Db } from '../db/schema.ts';
import { getDb } from '../db/index.ts';

/**
 * Send the "confirm your email" link. Called best-effort at signup — it must NEVER fail the account creation,
 * because the member has just finished telling us their story and losing that to a mail outage is unthinkable.
 */
export async function sendVerificationEmail(email: string, memberId: string): Promise<void> {
  const addr = (email ?? '').trim().toLowerCase();
  if (!addr) return;
  try {
    const db = (await getDb()) as unknown as Db;
    const token = await issueToken(db, 'verify_email', addr, memberId);
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://g4l-ten.vercel.app';
    await sendEmail({
      to: addr,
      subject: 'Confirm your email — Grinta for Life',
      text:
        `Welcome to Grinta for Life.\n\n` +
        `Confirm this is your address so you can always get back into your account:\n` +
        `${base}/login/verify?token=${encodeURIComponent(token)}\n\n` +
        `You don't need to do this before you start — it just means we can help you if you ever lose your password.\n`,
    });
  } catch (e) {
    console.warn('verification email not sent (non-fatal):', (e as Error).message);
  }
}
