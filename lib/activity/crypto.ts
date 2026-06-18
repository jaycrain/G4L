// Encryption at rest for OAuth tokens (Path B health-data connections). AES-256-GCM via Node's
// built-in crypto — no dependency, mirroring the dependency-free scrypt in lib/auth/password.ts.
//
// The key is ACTIVITY_TOKEN_KEY: 32 bytes, base64-encoded (generate with
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// and set it in .env.local / Vercel — NEVER commit it). Format: "v1$ivB64$tagB64$ctB64".
import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

const SCHEME = 'v1';
const IV_LEN = 12; // GCM standard nonce length

function key(): Buffer {
  const raw = process.env.ACTIVITY_TOKEN_KEY;
  if (!raw) throw new Error('ACTIVITY_TOKEN_KEY is not set — cannot encrypt/decrypt activity tokens.');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('ACTIVITY_TOKEN_KEY must decode to 32 bytes (base64-encoded).');
  return k;
}

/** Encrypt a token string. Returns "v1$iv$tag$ciphertext" (all base64). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SCHEME}$${iv.toString('base64')}$${tag.toString('base64')}$${ct.toString('base64')}`;
}

/** Decrypt a value produced by encryptToken. Throws if tampered or malformed. */
export function decryptToken(stored: string): string {
  const [scheme, ivB64, tagB64, ctB64] = stored.split('$');
  if (scheme !== SCHEME || !ivB64 || !tagB64 || !ctB64) throw new Error('Malformed encrypted token.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** True if a 32-byte base64 key is configured — lets routes degrade gracefully when it isn't. */
export function hasTokenKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

// Stable, signed state for the OAuth round-trip (CSRF + member binding). Reuses the HMAC pattern
// from lib/auth/admin-token.ts. state = "<memberId>.<expiresAtMs>.<hmac>", keyed by ACTIVITY_TOKEN_KEY.
import { createHmac } from 'node:crypto';

function stateSecret(): string {
  // Reuse the token key material as the HMAC secret (already a required, high-entropy server secret).
  return process.env.ACTIVITY_TOKEN_KEY ?? '';
}

export function signState(memberId: string, expiresAtMs: number): string {
  const payload = `${memberId}.${expiresAtMs}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Verify a state value; returns the bound memberId if valid and unexpired, else null. */
export function verifyState(state: string | undefined | null, nowMs: number): string | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [memberId, expStr, sig] = parts;
  const expected = createHmac('sha256', stateSecret()).update(`${memberId}.${expStr}`).digest('hex');
  const a = Buffer.from(sig!, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= nowMs) return null;
  return memberId!;
}
