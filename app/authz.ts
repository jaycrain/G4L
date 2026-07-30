// Authorization: member ownership + an admin override. App-layer isolation (the chosen Path-B
// model): every member-scoped page/action checks the caller owns that member, or is an admin.
import { cookies } from 'next/headers';
import { currentMemberId } from './auth.ts';
import { signAdminToken, verifyAdminToken } from '../lib/auth/admin-token.ts';

const ADMIN_COOKIE = 'g4l_admin';
// Sliding 30-day session: renewed on every active console visit (see renewAdminSession), so it only
// lapses after ~a month of NOT opening /admin. Single-operator, password-gated, httpOnly+secure cookie.
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const adminSecret = () => process.env.ADMIN_PASSWORD ?? '';

/** Issue/refresh the signed admin cookie with a fresh full-length expiry. */
async function setAdminCookie(secret: string): Promise<void> {
  const token = signAdminToken(secret, Date.now() + ADMIN_TTL_MS);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(adminSecret(), token, Date.now());
}

/** Length-safe constant-time string compare (admin password / tokens). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Verify the admin password and, if correct, set the signed admin cookie. */
export async function adminLogin(password: string): Promise<boolean> {
  const secret = adminSecret();
  // Constant-time compare: a plain !== short-circuits on the first differing byte, which is measurable. (SEC-02)
  if (!secret || !constantTimeEqual(password ?? '', secret)) return false;
  await setAdminCookie(secret);
  return true;
}

/** Slide the session forward: re-issue a full-length cookie if the caller is already an admin.
 *  Called on the console's auto-refresh tick so an active operator effectively stays signed in. */
export async function renewAdminSession(): Promise<void> {
  if (!(await isAdmin())) return;
  await setAdminCookie(adminSecret());
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** True if the current session owns this member, or the caller is an admin. */
export async function authorizeMember(memberId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return (await currentMemberId()) === memberId;
}
