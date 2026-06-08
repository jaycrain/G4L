// Stateless signed admin token (HMAC). Lets the operator console gate itself without an
// admin-accounts table. token = "<expiresAtMs>.<hmac>"; the HMAC is keyed by ADMIN_PASSWORD.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signAdminToken(secret: string, expiresAtMs: number): string {
  const payload = String(expiresAtMs);
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(secret: string, token: string | undefined | null, nowMs: number): boolean {
  if (!secret || !token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  // Compare the hex strings directly (utf8) — avoids Buffer.from(...,'hex') silently
  // truncating malformed input to a matching byte length.
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > nowMs;
}
