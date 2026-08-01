// Credential + session store. Framework-free (takes a Db). Sessions are server-side and
// revocable; the app layer maps a session token to an httpOnly cookie.
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/schema.ts';

// SEC-12 — SESSION TOKENS ARE HASHED AT REST.
// member_session.token used to hold the RAW bearer token — the exact string in the member's cookie. Anyone who
// could read that table (a backup, a log, a snapshot, an RLS gap, an ops export) could paste a row straight into
// a cookie and BE that member: their whole story, no password needed. Same reasoning as password hashing, and
// the same reasoning we already applied to auth_token in 0063 — this table was just missed.
//
// sha-256 with no salt is correct here and NOT a shortcut: the input is 256 bits of CSPRNG, so it isn't
// guessable or rainbow-tableable, and lookup must stay a single indexed probe.
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// TOKENS ARE HASHED, FULL STOP (0064).
//
// This carried a schema-tolerance shim that asked the database whether `token_hash` existed and worked either
// way. That was not a nicety — my first cut read/wrote token_hash unconditionally and would have broken LOGIN
// FOR EVERYONE in the window between the deploy and the hand-applied migration. A security fix that takes the
// product down is not a security fix.
//
// The shim has done its job: 0064 is applied everywhere and the plaintext `token` column is dropped, so the
// fallback branches were unreachable and are gone. THE LESSON STAYS EVEN THOUGH THE CODE DIDN'T — prod
// migrations here are applied by hand, so any future schema-dependent change must work on BOTH shapes and be
// tested on both. See docs/security-hardening-ledger.md.


export const SESSION_TTL_DAYS = 30;

export async function createCredential(db: Db, memberId: string, email: string, passwordHash: string): Promise<void> {
  await db.query(
    `insert into member_credential (member_id, email, password_hash) values ($1,$2,$3)
     on conflict (member_id) do update set email = excluded.email, password_hash = excluded.password_hash`,
    [memberId, email, passwordHash],
  );
}

export async function findCredentialByEmail(
  db: Db,
  email: string,
): Promise<{ member_id: string; password_hash: string } | null> {
  const { rows } = await db.query<{ member_id: string; password_hash: string }>(
    `select member_id, password_hash from member_credential where lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function getCredentialByMember(db: Db, memberId: string): Promise<{ password_hash: string } | null> {
  const { rows } = await db.query<{ password_hash: string }>(
    `select password_hash from member_credential where member_id = $1`,
    [memberId],
  );
  return rows[0] ?? null;
}

export async function updatePasswordHash(db: Db, memberId: string, passwordHash: string): Promise<void> {
  await db.query(`update member_credential set password_hash = $2 where member_id = $1`, [memberId, passwordHash]);
}

/** Record that this address has been proven (SEC-08). Idempotent; keeps the FIRST proof, not the latest. */
export async function markEmailVerified(db: Db, email: string): Promise<void> {
  await db.query(
    `update member_credential set email_verified_at = now()
      where lower(email) = lower($1) and email_verified_at is null`,
    [email],
  );
}

export async function isEmailVerified(db: Db, memberId: string): Promise<boolean> {
  const { rows } = await db.query<{ v: Date | null }>(
    `select email_verified_at as v from member_credential where member_id = $1`,
    [memberId],
  );
  return Boolean(rows[0]?.v);
}

export async function hasCredential(db: Db, memberId: string): Promise<boolean> {
  const { rows } = await db.query<{ e: boolean }>(
    `select exists(select 1 from member_credential where member_id = $1) as e`,
    [memberId],
  );
  return Boolean(rows[0]?.e);
}

export async function createSession(db: Db, memberId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.query(
    `insert into member_session (token_hash, member_id, expires_at)
     values ($1, $2, now() + ($3 * interval '1 day'))`,
    [hashSessionToken(token), memberId, SESSION_TTL_DAYS],
  );
  return token; // the PLAINTEXT goes to the cookie and is never stored once 0064 is applied
}

export async function getSessionMember(db: Db, token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const { rows } = await db.query<{ member_id: string }>(
    `select member_id from member_session where token_hash = $1 and expires_at > now()`,
    [hashSessionToken(token)],
  );
  return rows[0]?.member_id ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query(`delete from member_session where token_hash = $1`, [hashSessionToken(token)]);
}

/**
 * Revoke EVERY session for a member (SEC-08/SEC-14). Called on password reset and password change: a member
 * resets precisely when they fear someone else is in their account, so leaving that someone's 30-day session
 * alive would defeat the reset. Returns the number of sessions ended.
 */
export async function deleteSessionsForMember(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.query<{ member_id: string }>(
    `delete from member_session where member_id = $1 returning member_id`,
    [memberId],
  );
  return rows.length;
}

/**
 * Revoke every session EXCEPT the caller's own (SEC-14). This is the change-password case: they are signed in
 * and mid-flow, so signing them out of the device in their hand would be hostile — but every OTHER device has to
 * go, because "change my password" is what you do when you think someone else is in your account. Silently
 * leaving that someone with a 30-day session is the whole failure.
 */
export async function deleteOtherSessionsForMember(db: Db, memberId: string, keepToken: string | null): Promise<number> {
  const keep = keepToken ? hashSessionToken(keepToken) : null;
  const { rows } = await db.query<{ member_id: string }>(
    `delete from member_session
      where member_id = $1 and ($2::text is null or token_hash is distinct from $2)
      returning member_id`,
    [memberId, keep],
  );
  return rows.length;
}
