// Credential + session store. Framework-free (takes a Db). Sessions are server-side and
// revocable; the app layer maps a session token to an httpOnly cookie.
import { randomBytes } from 'node:crypto';
import type { Db } from '../db/schema.ts';

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
    `insert into member_session (token, member_id, expires_at)
     values ($1, $2, now() + ($3 * interval '1 day'))`,
    [token, memberId, SESSION_TTL_DAYS],
  );
  return token;
}

export async function getSessionMember(db: Db, token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const { rows } = await db.query<{ member_id: string }>(
    `select member_id from member_session where token = $1 and expires_at > now()`,
    [token],
  );
  return rows[0]?.member_id ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query(`delete from member_session where token = $1`, [token]);
}
