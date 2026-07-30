import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { isThrottled, recordFailure, clearFailures } from '../lib/auth/rate-limit.ts';

// SEC-02 — there was NO rate limit, lockout, or backoff on ANY authentication endpoint. Member login could be
// credential-stuffed at will against an 8-char password policy, and the single shared admin password could be
// guessed unlimited times — and the admin cookie makes authorizeMember true for EVERY member, so one guess reads
// every member's identity story. These lock the throttle's contract, including that it never traps a real member.

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

test('member login: throttles a subject after its allowance, and only that subject', async () => {
  const d = await db();
  for (let i = 0; i < 4; i++) await recordFailure(d, 'login_email', 'victim@x.com');
  assert.equal(await isThrottled(d, 'login_email', 'victim@x.com'), false, '4 misses is still a person mistyping');
  await recordFailure(d, 'login_email', 'victim@x.com');
  assert.equal(await isThrottled(d, 'login_email', 'victim@x.com'), true, '5 in the window trips it');
  assert.equal(await isThrottled(d, 'login_email', 'someone@else.com'), false, 'a different member is unaffected');
});

test('email matching is case/whitespace-insensitive — you cannot dodge the throttle by changing case', async () => {
  const d = await db();
  for (let i = 0; i < 5; i++) await recordFailure(d, 'login_email', 'Victim@X.com');
  assert.equal(await isThrottled(d, 'login_email', '  victim@x.COM '), true);
});

test('scopes are independent — an IP ceiling does not throttle an email, or vice versa', async () => {
  const d = await db();
  for (let i = 0; i < 6; i++) await recordFailure(d, 'login_email', 'a@x.com');
  assert.equal(await isThrottled(d, 'login_ip', 'a@x.com'), false, 'different scope, same string, not throttled');
  for (let i = 0; i < 20; i++) await recordFailure(d, 'login_ip', '203.0.113.9');
  assert.equal(await isThrottled(d, 'login_ip', '203.0.113.9'), true, 'the looser per-IP ceiling still bounds a spray');
});

test('admin has the TIGHTEST ceiling — it is the highest-value credential in the product', async () => {
  const d = await db();
  for (let i = 0; i < 5; i++) await recordFailure(d, 'admin_ip', '203.0.113.9');
  assert.equal(await isThrottled(d, 'admin_ip', '203.0.113.9'), true);
});

test('a SUCCESSFUL auth clears the streak — a member who finally remembers is not left locked out', async () => {
  const d = await db();
  for (let i = 0; i < 5; i++) await recordFailure(d, 'login_email', 'real@member.com');
  assert.equal(await isThrottled(d, 'login_email', 'real@member.com'), true);
  await clearFailures(d, 'login_email', 'real@member.com');
  assert.equal(await isThrottled(d, 'login_email', 'real@member.com'), false);
});

test('FAILS OPEN when the table is missing — an unapplied migration must not lock every member out', async () => {
  // Deliberate: prod migrations are hand-applied and drift has happened (0042). Failing closed here would be a
  // self-inflicted outage worse than the risk. The limiter logs loudly instead; the deploy check catches it.
  const bare = new PGlite() as unknown as Db; // no schema applied → auth_attempt does not exist
  assert.equal(await isThrottled(bare, 'login_email', 'a@x.com'), false);
  await recordFailure(bare, 'login_email', 'a@x.com'); // must not throw
});

test('a blank subject is never throttled (nothing to key on)', async () => {
  const d = await db();
  assert.equal(await isThrottled(d, 'login_email', ''), false);
  assert.equal(await isThrottled(d, 'login_email', '   '), false);
});
