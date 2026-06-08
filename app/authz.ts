// Authorization: member ownership + an admin override. App-layer isolation (the chosen Path-B
// model): every member-scoped page/action checks the caller owns that member, or is an admin.
import { cookies } from 'next/headers';
import { currentMemberId } from './auth.ts';
import { signAdminToken, verifyAdminToken } from '../lib/auth/admin-token.ts';

const ADMIN_COOKIE = 'g4l_admin';
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;
const adminSecret = () => process.env.ADMIN_PASSWORD ?? '';

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(adminSecret(), token, Date.now());
}

/** Verify the admin password and, if correct, set the signed admin cookie. */
export async function adminLogin(password: string): Promise<boolean> {
  const secret = adminSecret();
  if (!secret || password !== secret) return false;
  const token = signAdminToken(secret, Date.now() + ADMIN_TTL_MS);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_MS / 1000,
  });
  return true;
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** True if the current session owns this member, or the caller is an admin. */
export async function authorizeMember(memberId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return (await currentMemberId()) === memberId;
}
