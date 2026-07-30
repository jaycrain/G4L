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

// SCHEMA-TOLERANT ON PURPOSE — and this is the lesson, not a nicety.
// Prod migrations here are applied BY HAND, so new code and new schema never land at the same instant. My first
// cut of this read/wrote token_hash unconditionally, which would have broken LOGIN FOR EVERYONE in the window
// between the deploy and the migration — no session could be created OR resolved. A security fix that takes the
// product down is not a security fix.
//
// So the store asks the database what it has and works either way. `true` is cached forever (once hashed, always
// hashed); `false` is deliberately NOT cached, so a running instance picks the column up the moment the migration
// lands, without a redeploy. Delete this shim once 0064 is applied everywhere and `token` is dropped.
let hashedColumnConfirmed = false;
/** Test-only: the confirmation is process-wide, so a test exercising the pre-migration shape must clear it. */
export function __resetSessionSchemaCache(): void {
  hashedColumnConfirmed = false;
}
async function usesHashedTokens(db: Db): Promise<boolean> {
  if (hashedColumnConfirmed) return true;
  try {
    const { rows } = await db.query<{ e: boolean }>(
      `select exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'member_session' and column_name = 'token_hash'
       ) as e`,
    );
    hashedColumnConfirmed = Boolean(rows[0]?.e);
    return hashedColumnConfirmed;
  } catch {
    return false; // never let a catalog hiccup lock members out
  }
}

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
  const hashed = await usesHashedTokens(db);
  await db.query(
    hashed
      ? `insert into member_session (token_hash, member_id, expires_at)
         values ($1, $2, now() + ($3 * interval '1 day'))`
      : `insert into member_session (token, member_id, expires_at)
         values ($1, $2, now() + ($3 * interval '1 day'))`,
    [hashed ? hashSessionToken(token) : token, memberId, SESSION_TTL_DAYS],
  );
  return token; // the PLAINTEXT goes to the cookie and is never stored once 0064 is applied
}

export async function getSessionMember(db: Db, token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const hashed = await usesHashedTokens(db);
  const { rows } = await db.query<{ member_id: string }>(
    hashed
      ? `select member_id from member_session where token_hash = $1 and expires_at > now()`
      : `select member_id from member_session where token = $1 and expires_at > now()`,
    [hashed ? hashSessionToken(token) : token],
  );
  return rows[0]?.member_id ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  const hashed = await usesHashedTokens(db);
  await db.query(
    hashed ? `delete from member_session where token_hash = $1` : `delete from member_session where token = $1`,
    [hashed ? hashSessionToken(token) : token],
  );
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
  const hashed = await usesHashedTokens(db);
  const keep = keepToken ? (hashed ? hashSessionToken(keepToken) : keepToken) : null;
  const { rows } = await db.query<{ member_id: string }>(
    hashed
      ? `delete from member_session
          where member_id = $1 and ($2::text is null or token_hash is distinct from $2)
          returning member_id`
      : `delete from member_session
          where member_id = $1 and ($2::text is null or token is distinct from $2)
          returning member_id`,
    [memberId, keep],
  );
  return rows.length;
}
