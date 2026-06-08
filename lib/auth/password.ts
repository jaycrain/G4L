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
