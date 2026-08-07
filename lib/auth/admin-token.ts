// Stateless signed admin token (HMAC), now carrying WHICH operator.
//
// token = "<operatorId|->.<expiresAtMs>.<hmac>"   — the HMAC covers "<operatorId|->.<expiresAtMs>"
//
// The v1 format was "<expiresAtMs>.<hmac>": an expiry and a signature, no identity. That is precisely why nothing
// in the product could attribute an action to a human — there was no human in the token to attribute it to. The
// operator id now sits INSIDE the signed payload, so whoever holds the cookie cannot edit it: a token claiming to
// be someone else fails the HMAC.
//
// STILL KEYED BY ADMIN_PASSWORD, deliberately. A dedicated signing secret would be tidier, but it means a new
// REQUIRED env var — and a missing one on deploy locks every operator out of the console at exactly the moment
// they'd need it to find out why. ADMIN_PASSWORD stays a legitimate server-side secret once it is no longer *the*
// login, and rotating it invalidating every operator session is a reasonable thing for rotating it to do.
//
// V1 TOKENS STILL VERIFY, as the bootstrap root (operatorId null). Without that, shipping this would sign out
// whoever holds a valid session — a self-inflicted lockout for no security gain, since a v1 token was already
// proof of knowing ADMIN_PASSWORD. They age out on their own within 30 days.
import { createHmac, timingSafeEqual } from 'node:crypto';

const NO_OPERATOR = '-';

export type AdminClaim = { operatorId: string | null; expiresAtMs: number };

const sign = (secret: string, payload: string): string => createHmac('sha256', secret).update(payload).digest('hex');

function signatureMatches(secret: string, payload: string, sig: string): boolean {
  const expected = sign(secret, payload);
  // Compare the hex STRINGS (utf8), not decoded bytes — Buffer.from(x,'hex') silently truncates malformed input,
  // which can give a garbage signature the right byte length and sneak it past timingSafeEqual.
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signAdminToken(secret: string, expiresAtMs: number, operatorId?: string | null): string {
  const payload = `${operatorId ?? NO_OPERATOR}.${expiresAtMs}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** Verify AND unpack. Returns the claim, or null if the token is forged, malformed or expired. */
export function readAdminToken(secret: string, token: string | undefined | null, nowMs: number): AdminClaim | null {
  if (!secret || !token) return null;
  const parts = token.split('.');

  if (parts.length === 3) {
    const [op, expStr, sig] = parts as [string, string, string];
    if (!op || !expStr || !sig) return null;
    if (!signatureMatches(secret, `${op}.${expStr}`, sig)) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= nowMs) return null;
    return { operatorId: op === NO_OPERATOR ? null : op, expiresAtMs: exp };
  }

  if (parts.length === 2) {
    // v1 — a pre-operator session. Honoured as root until it lapses (see header).
    const [expStr, sig] = parts as [string, string];
    if (!expStr || !sig) return null;
    if (!signatureMatches(secret, expStr, sig)) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= nowMs) return null;
    return { operatorId: null, expiresAtMs: exp };
  }

  return null;
}

/** Back-compat boolean, for callers that only need "is this a valid admin token". */
export function verifyAdminToken(secret: string, token: string | undefined | null, nowMs: number): boolean {
  return readAdminToken(secret, token, nowMs) !== null;
}
