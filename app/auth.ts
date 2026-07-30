// App-side session glue: maps the server-side session to an httpOnly cookie.
// currentMemberId() is safe in server components (read-only); start/end run in actions only.
import { cookies } from 'next/headers';
import { getDb } from '../lib/db/index.ts';
import { createSession, deleteSession, getSessionMember, SESSION_TTL_DAYS } from '../lib/auth/store.ts';
import type { Db } from '../lib/db/schema.ts';

const COOKIE = 'g4l_session';

export async function currentMemberId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = (await getDb()) as unknown as Db;
  return getSessionMember(db, token);
}

export async function startSession(memberId: string): Promise<void> {
  const db = (await getDb()) as unknown as Db;
  const token = await createSession(db, memberId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = (await getDb()) as unknown as Db;
    await deleteSession(db, token);
  }
  jar.delete(COOKIE);
}
