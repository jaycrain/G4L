import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signAdminToken, verifyAdminToken } from '../lib/auth/admin-token.ts';

const SECRET = 'super-secret-admin-pw';
const now = 1_000_000_000_000;

test('a freshly signed token verifies', () => {
  const token = signAdminToken(SECRET, now + 60_000);
  assert.equal(verifyAdminToken(SECRET, token, now), true);
});

test('an expired token is rejected', () => {
  const token = signAdminToken(SECRET, now - 1);
  assert.equal(verifyAdminToken(SECRET, token, now), false);
});

test('a tampered token or wrong secret is rejected', () => {
  const token = signAdminToken(SECRET, now + 60_000);
  assert.equal(verifyAdminToken(SECRET, token + 'x', now), false);
  assert.equal(verifyAdminToken('different-secret', token, now), false);
  // payload changed (later expiry) but signature is for the original → must fail
  const [payload, sig] = token.split('.');
  assert.equal(verifyAdminToken(SECRET, `${Number(payload) + 1000}.${sig}`, now), false);
});

test('empty/garbage inputs are rejected (not thrown)', () => {
  assert.equal(verifyAdminToken(SECRET, undefined, now), false);
  assert.equal(verifyAdminToken(SECRET, '', now), false);
  assert.equal(verifyAdminToken(SECRET, 'nodot', now), false);
  assert.equal(verifyAdminToken('', signAdminToken('', now + 1), now), false); // empty secret never authorizes
});
