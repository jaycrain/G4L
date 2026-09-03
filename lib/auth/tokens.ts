// Single-use, expiring auth tokens — password reset + email verification (SEC-08).
//
// THE INVARIANTS, all of which exist because this token can reset a password:
//   1. HASHED AT REST. We store sha-256(token); the plaintext lives only in the email. A DB read — backup,
//      log, snapshot, RLS gap — must never yield something replayable.
//   2. SINGLE USE. Consumed atomically, so a leaked-then-used link (forwarded mail, shared screenshot,
//      mail-scanner prefetch) can't be replayed.
//   3. SHORT LIVED. 60 min for a reset, 7 days for a verification (a member may not check mail today).
//   4. SUPERSEDING. Requesting a new reset invalidates the outstanding ones, so an old email in an inbox
//      stops working the moment a newer one is asked for.
//   5. THE CALLER LEARNS NOTHING. Issuing never reveals whether an address is registered — see the actions.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/schema.ts';

export type TokenPurpose = 'password_reset' | 'verify_email';

const TTL_MINUTES: Record<TokenPurpose, number> = {
  password_reset: 60, // short: it is a live credential to change a password
  verify_email: 60 * 24 * 7, // long: people do not always check mail the same day
};

/** 256 bits, URL-safe. Never Math.random, never a timestamp — this is a credential. */
function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a token and return the PLAINTEXT (to email). Supersedes any outstanding tokens of the same purpose
 * for this address, so only the newest link in an inbox works.
 */
export async function issueToken(
  db: Db,
  purpose: TokenPurpose,
  email: string,
  memberId: string | null,
): Promise<string> {
  const addr = email.trim().toLowerCase();
  const token = mintToken();
  await db.query(
    `update auth_token set consumed_at = now()
      where email = $1 and purpose = $2 and consumed_at is null`,
    [addr, purpose],
  );
  await db.query(
    `insert into auth_token (token_hash, purpose, email, member_id, expires_at)
     values ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [hashToken(token), purpose, addr, memberId, String(TTL_MINUTES[purpose])],
  );
  return token;
}

export type ConsumedToken = { email: string; memberId: string | null };

/**
 * Redeem a token ATOMICALLY. Returns the subject on success, null if it is unknown, expired, already used,
 * or of the wrong purpose. The update-returning is what makes it single-use even under concurrent requests —
 * a check-then-update would race, and this is the one place a race hands out a password reset twice.
 */
export async function consumeToken(db: Db, purpose: TokenPurpose, token: string): Promise<ConsumedToken | null> {
  const t = (token ?? '').trim();
  if (!t) return null;
  const { rows } = await db.query<{ email: string; member_id: string | null }>(
    `update auth_token
        set consumed_at = now()
      where token_hash = $1
        and purpose = $2
        and consumed_at is null
        and expires_at > now()
      returning email, member_id`,
    [hashToken(t), purpose],
  );
  const r = rows[0];
  return r ? { email: r.email, memberId: r.member_id } : null;
}

