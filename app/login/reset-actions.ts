'use server';

// Password reset (SEC-08). Before this there was NO reset and NO recovery: a member who forgot their password
// was locked out of their own story permanently, and the SEC-01 takeover was irreversible for the same reason.
//
// TWO RULES SHAPE EVERYTHING HERE:
//   * The response NEVER reveals whether an address is registered. Same wording, same shape, whether or not we
//     found a credential — otherwise this becomes a membership oracle for a product whose membership is itself
//     sensitive ("is my colleague in the midlife-identity-loss program?").
//   * Resetting REVOKES every existing session. A reset is what you do when you fear someone else is in your
//     account; leaving their session alive would defeat the point (this also closes SEC-14 for this path).

import { getDb } from '../../lib/db/index.ts';
import {
  findCredentialByEmail,
  updatePasswordHash,
  deleteSessionsForMember,
  markEmailVerified,
} from '../../lib/auth/store.ts';
import { hashPassword } from '../../lib/auth/password.ts';
import { issueToken, consumeToken } from '../../lib/auth/tokens.ts';
import { isThrottled, recordFailure, clearFailures, callerIp } from '../../lib/auth/rate-limit.ts';
import { sendEmail } from '../../lib/email/send.ts';
import type { Db } from '../../lib/db/schema.ts';

const GENERIC = 'If that address has an account, we just sent a link to reset your password. It expires in an hour.';

function resetUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://g4l-ten.vercel.app';
  return `${base}/login/reset?token=${encodeURIComponent(token)}`;
}

/** Step 1 — request a reset. Always returns the same message, whether or not the address exists. */
export async function requestPasswordResetAction(email: string): Promise<{ ok: true; message: string }> {
  const addr = (email ?? '').trim().toLowerCase();
  if (!addr) return { ok: true, message: GENERIC };
  try {
    const db = (await getDb()) as unknown as Db;
    // Rate limited: this endpoint sends mail and is a natural enumeration/harassment vector.
    const ip = await callerIp();
    if ((await isThrottled(db, 'login_email', addr)) || (ip && (await isThrottled(db, 'login_ip', ip)))) {
      return { ok: true, message: GENERIC }; // same message — never confirm they are being throttled
    }
    const cred = await findCredentialByEmail(db, addr);
    if (cred) {
      const token = await issueToken(db, 'password_reset', addr, cred.member_id);
      await sendEmail({
        to: addr,
        subject: 'Reset your Grinta for Life password',
        text:
          `Someone asked to reset the password for your Grinta for Life account.\n\n` +
          `Open this link within the next hour to choose a new one:\n${resetUrl(token)}\n\n` +
          `If that wasn't you, you can ignore this — nothing changes until the link is used, ` +
          `and your account stays as it is.\n`,
      });
    } else {
      // No account: still consume the work + record an attempt so timing and rate behaviour match the real path.
      await recordFailure(db, 'login_email', addr);
    }
  } catch {
    /* never surface infrastructure state to an unauthenticated caller */
  }
  return { ok: true, message: GENERIC };
}

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

/** Redeem a verification link. Returns false for expired/used/unknown — never says why (it is unauthenticated). */
export async function confirmEmailAction(token: string): Promise<{ ok: boolean }> {
  try {
    const db = (await getDb()) as unknown as Db;
    const claim = await consumeToken(db, 'verify_email', token);
    if (!claim) return { ok: false };
    await markEmailVerified(db, claim.email);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Step 2 — redeem the link and set a new password. Single-use; revokes every existing session. */
export async function completePasswordResetAction(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if ((newPassword ?? '').length < 8) return { ok: false, error: 'Please choose a password of at least 8 characters.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const claim = await consumeToken(db, 'password_reset', token);
    if (!claim) return { ok: false, error: 'That link has expired or was already used. Please request a new one.' };
    const cred = await findCredentialByEmail(db, claim.email);
    if (!cred) return { ok: false, error: 'That link is no longer valid.' };
    await updatePasswordHash(db, cred.member_id, await hashPassword(newPassword));
    // A reset is what you do when you think someone else is in your account — so end every session, everywhere.
    await deleteSessionsForMember(db, cred.member_id);
    // Redeeming an emailed link IS proof of control of the address — so it also verifies it.
    await markEmailVerified(db, claim.email);
    // And don't leave them throttled by the failed logins that sent them here in the first place.
    await clearFailures(db, 'login_email', claim.email);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong. Please request a new link.' };
  }
}
