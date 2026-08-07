// Authorization: member ownership + an admin override. App-layer isolation (the chosen Path-B
// model): every member-scoped page/action checks the caller owns that member, or is an admin.
import { cookies } from 'next/headers';
import { currentMemberId } from './auth.ts';
import { signAdminToken, readAdminToken } from '../lib/auth/admin-token.ts';
import { operatorIsLive, operatorLabel, verifyOperator, type Operator } from '../lib/auth/operator.ts';
import { getDb } from '../lib/db/index.ts';
import type { Db } from '../lib/db/schema.ts';

const ADMIN_COOKIE = 'g4l_admin';
// Sliding 30-day session: renewed on every active console visit (see renewAdminSession), so it only
// lapses after ~a month of NOT opening /admin. httpOnly+secure cookie, now carrying WHICH operator.
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const adminSecret = () => process.env.ADMIN_PASSWORD ?? '';

/** Issue/refresh the signed admin cookie with a fresh full-length expiry, bound to an operator (null = root). */
async function setAdminCookie(secret: string, operatorId: string | null): Promise<void> {
  const token = signAdminToken(secret, Date.now() + ADMIN_TTL_MS, operatorId);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_MS / 1000,
  });
}

/**
 * The current admin claim, or null.
 *
 * PERFORMANCE IS A CORRECTNESS CONCERN HERE, which is why the ordering is deliberate. `isAdmin()` is called by
 * `authorizeMember()`, and `authorizeMember()` runs on essentially every member request in the product. So a
 * naive "look the operator up to see if they're still enabled" would add a database round-trip to every dashboard
 * load for people who are not admins and never will be.
 *
 * The absent cookie is therefore checked FIRST and returns immediately. A member carries no admin cookie, so a
 * member's request does zero extra work — it doesn't even open a connection. Only a request that actually
 * presents an admin token pays for the lookup, and that population is a handful of people.
 */
async function adminClaim(): Promise<{ operatorId: string | null } | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null; // ← the hot path for every member in the product
  return readAdminToken(adminSecret(), token, Date.now());
}

export async function isAdmin(): Promise<boolean> {
  const claim = await adminClaim();
  if (!claim) return false;
  if (!claim.operatorId) return true; // bootstrap root: no row to check
  // A disabled operator loses access NOW, not whenever their 30-day cookie happens to lapse. Revocation that
  // takes a month is not revocation.
  try {
    return (await operatorIsLive((await getDb()) as unknown as Db, claim.operatorId)) !== null;
  } catch (e) {
    // FAIL CLOSED. Everywhere else in this codebase a read failure degrades to "carry on" so a member never loses
    // their dashboard to a hiccup. Not here: the question is "may this person read everyone's private story", and
    // the safe answer to "I don't know" is no.
    console.error('admin check could not verify the operator — denying:', (e as Error).message);
    return false;
  }
}

/** WHO the current admin is — the thing that did not exist before, and the reason the access log can name anyone. */
export async function currentOperator(): Promise<{ id: string | null; label: string }> {
  const claim = await adminClaim();
  if (!claim) return { id: null, label: 'not an operator' };
  if (!claim.operatorId) return { id: null, label: operatorLabel(null) };
  let op: Operator | null = null;
  try {
    op = await operatorIsLive((await getDb()) as unknown as Db, claim.operatorId);
  } catch {
    /* labelled as unknown below rather than crashing an audit write */
  }
  return op ? { id: op.id, label: operatorLabel(op) } : { id: claim.operatorId, label: `operator ${claim.operatorId}` };
}

/** Length-safe constant-time string compare (admin password / tokens). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Sign in to the console.
 *
 * TWO WAYS IN, and which one you use depends on whether you give an email:
 *   · email + password → a named operator (verifyOperator). This is the one that makes the audit log mean
 *     something, and the one to use from here on.
 *   · password alone   → the ADMIN_PASSWORD bootstrap, logged as `root (shared password)`. It exists so that the
 *     migration adding operators cannot lock everyone out before a single operator row exists, and so Jay's
 *     current muscle memory keeps working. It is meant to be retired once real operators exist.
 *
 * The bootstrap keeps its constant-time compare: a plain !== short-circuits on the first differing byte, which is
 * measurable (SEC-02). The named path gets scrypt plus a timing burn on unknown addresses (lib/auth/operator.ts).
 */
export async function adminLogin(password: string, email?: string): Promise<boolean> {
  const secret = adminSecret();
  const addr = (email ?? '').trim();

  if (addr) {
    try {
      const op = await verifyOperator((await getDb()) as unknown as Db, addr, password ?? '');
      if (!op) return false;
      await setAdminCookie(secret, op.id);
      return true;
    } catch (e) {
      console.error('operator login failed to reach the database:', (e as Error).message);
      return false; // fail closed
    }
  }

  if (!secret || !constantTimeEqual(password ?? '', secret)) return false;
  await setAdminCookie(secret, null);
  return true;
}

/** Slide the session forward: re-issue a full-length cookie if the caller is already an admin.
 *  Called on the console's auto-refresh tick so an active operator effectively stays signed in.
 *  Re-signs with the SAME operator — sliding a session must never quietly change who you are. */
export async function renewAdminSession(): Promise<void> {
  const claim = await adminClaim();
  if (!claim) return;
  if (!(await isAdmin())) return; // re-checks that a named operator is still enabled
  await setAdminCookie(adminSecret(), claim.operatorId);
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** True if the current session owns this member, or the caller is an admin. */
export async function authorizeMember(memberId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return (await currentMemberId()) === memberId;
}
