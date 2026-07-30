// Password hashing with Node's built-in scrypt (no dependency). Stored as scrypt$salt$hash.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Node's scrypt defaults are N=16384, r=8, p=1 — solid, and they keep the promisified
// signature clean. KEYLEN 64 bytes.
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const dk = (await scryptAsync(plain, salt, expected.length)) as Buffer;
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

// SEC-13 — CLOSE THE TIMING ORACLE ON LOGIN.
// scrypt is deliberately expensive (~50-150ms). That means "no such email" (skip the hash, answer in ~1ms) and
// "wrong password" (pay the hash) are trivially distinguishable by a stopwatch, no matter how carefully the two
// paths word their error message. For most products that leaks an email address. Here it leaks MEMBERSHIP of a
// midlife-identity-loss program — the fact people are most afraid of — and it does it to an unauthenticated
// caller, at scale, without tripping the rate limiter's ceiling on any single address.
//
// So the no-such-member path does the same work: hash the supplied password against a throwaway salt and throw
// the result away. Computed once and cached, so we pay for the dummy hash rather than a real member's.
let dummyHash: Promise<string> | null = null;
export function burnPasswordTime(plain: string): Promise<boolean> {
  dummyHash ??= hashPassword('timing-equalizer-not-a-credential');
  return dummyHash.then((h) => verifyPassword(plain ?? '', h)).catch(() => false);
}
