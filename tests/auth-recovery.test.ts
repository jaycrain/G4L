import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  createCredential,
  findCredentialByEmail,
  updatePasswordHash,
  createSession,
  getSessionMember,
  deleteSessionsForMember,
  markEmailVerified,
  isEmailVerified,
} from '../lib/auth/store.ts';
import { hashPassword, verifyPassword } from '../lib/auth/password.ts';
import { issueToken, consumeToken } from '../lib/auth/tokens.ts';

// SEC-08 — before this, accounts were created on UNVERIFIED emails with NO reset and NO recovery of any kind.
// A member who forgot their password was locked out of their own identity story permanently, and it made the
// SEC-01 takeover irreversible: the real person had no way to reclaim an account built out of their own words.
// These tests exercise the store-level flow the server actions compose (actions themselves need next/headers).

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

async function member(d: Db, email: string): Promise<string> {
  const { rows } = await d.query<{ member_id: string }>(
    `insert into member_profile (email, display_name) values ($1, $2) returning member_id`,
    [email, email.split('@')[0]],
  );
  return rows[0]!.member_id;
}

test('the whole reset path: emailed token → new password works, old password does not', async () => {
  const d = await db();
  const id = await member(d, 'donna@example.com');
  await createCredential(d, id, 'donna@example.com', await hashPassword('oldpassw0rd'));

  const token = await issueToken(d, 'password_reset', 'donna@example.com', id);
  const claim = await consumeToken(d, 'password_reset', token);
  assert.ok(claim, 'the emailed token redeems');
  const cred = await findCredentialByEmail(d, claim!.email);
  await updatePasswordHash(d, cred!.member_id, await hashPassword('brandnewpassw0rd'));

  const after = await findCredentialByEmail(d, 'donna@example.com');
  assert.equal(await verifyPassword('brandnewpassw0rd', after!.password_hash), true, 'new password works');
  assert.equal(await verifyPassword('oldpassw0rd', after!.password_hash), false, 'old password is dead');
});

test('a reset REVOKES every existing session — including the attacker’s', async () => {
  // The whole point of a reset is "someone else may be in my account". Leaving their 30-day session alive
  // would hand them continued access to the member's story after the member thought they had locked it.
  const d = await db();
  const id = await member(d, 'taken@example.com');
  await createCredential(d, id, 'taken@example.com', await hashPassword('oldpassw0rd'));
  const attacker = await createSession(d, id);
  const ownPhone = await createSession(d, id);
  assert.equal(await getSessionMember(d, attacker), id, 'attacker is logged in before the reset');

  await deleteSessionsForMember(d, id);

  assert.equal(await getSessionMember(d, attacker), null, 'attacker session is gone');
  assert.equal(await getSessionMember(d, ownPhone), null, 'and so is every other device — no exceptions');
});

test('revocation is scoped to the one member — a reset never signs anybody else out', async () => {
  const d = await db();
  const a = await member(d, 'a@example.com');
  const b = await member(d, 'b@example.com');
  const bSession = await createSession(d, b);
  await createSession(d, a);
  const ended = await deleteSessionsForMember(d, a);
  assert.equal(ended, 1);
  assert.equal(await getSessionMember(d, bSession), b, 'the other member is untouched');
});

test('a reset link cannot be replayed to seize the account a second time', async () => {
  const d = await db();
  const id = await member(d, 'replay@example.com');
  await createCredential(d, id, 'replay@example.com', await hashPassword('oldpassw0rd'));
  const token = await issueToken(d, 'password_reset', 'replay@example.com', id);
  assert.ok(await consumeToken(d, 'password_reset', token));
  assert.equal(
    await consumeToken(d, 'password_reset', token),
    null,
    'a forwarded email / shared screenshot / scanned inbox cannot re-reset the password',
  );
});

test('asking for a new link kills the old one — an old email in an inbox stops working', async () => {
  const d = await db();
  const id = await member(d, 'again@example.com');
  const first = await issueToken(d, 'password_reset', 'again@example.com', id);
  const second = await issueToken(d, 'password_reset', 'again@example.com', id);
  assert.equal(await consumeToken(d, 'password_reset', first), null, 'the superseded link is dead');
  assert.ok(await consumeToken(d, 'password_reset', second), 'the newest link is the live one');
});

test('a verification token can never be used to reset a password (purposes do not cross)', async () => {
  const d = await db();
  const id = await member(d, 'cross@example.com');
  const verify = await issueToken(d, 'verify_email', 'cross@example.com', id);
  assert.equal(
    await consumeToken(d, 'password_reset', verify),
    null,
    'the low-stakes, week-long verify link must not be a password-reset credential',
  );
});

test('email verification records proof of control, and is idempotent', async () => {
  const d = await db();
  const id = await member(d, 'proof@example.com');
  await createCredential(d, id, 'proof@example.com', await hashPassword('passw0rd!'));
  assert.equal(await isEmailVerified(d, id), false, 'unverified at signup — we do not assume');

  const token = await issueToken(d, 'verify_email', 'proof@example.com', id);
  const claim = await consumeToken(d, 'verify_email', token);
  await markEmailVerified(d, claim!.email);
  assert.equal(await isEmailVerified(d, id), true);

  const { rows: before } = await d.query<{ v: string }>(
    `select email_verified_at::text as v from member_credential where member_id = $1`,
    [id],
  );
  await markEmailVerified(d, 'PROOF@example.com'); // case-insensitive, and must not move the timestamp
  const { rows: after } = await d.query<{ v: string }>(
    `select email_verified_at::text as v from member_credential where member_id = $1`,
    [id],
  );
  assert.equal(after[0]!.v, before[0]!.v, 'keeps the FIRST proof, not the latest');
});

test('verification is NOT a gate — an unverified member still has a working account', async () => {
  // Deliberate product call: hard-gating would strand real Charter members behind our own email deliverability,
  // and this is a product they have already told their story to. The column is a record, not a lock.
  const d = await db();
  const id = await member(d, 'unverified@example.com');
  await createCredential(d, id, 'unverified@example.com', await hashPassword('passw0rd!'));
  const session = await createSession(d, id);
  assert.equal(await isEmailVerified(d, id), false);
  assert.equal(await getSessionMember(d, session), id, 'still logged in, still theirs');
});

// ---------------------------------------------------------------------------
// SEC-12 / SEC-13 / SEC-14 — the auth hardening batch.
// ---------------------------------------------------------------------------
import {
  hashSessionToken,
  deleteOtherSessionsForMember,
  deleteSession,
  __resetSessionSchemaCache,
} from '../lib/auth/store.ts';
import { burnPasswordTime } from '../lib/auth/password.ts';

test('SEC-12 · the raw session token is NEVER stored — a DB read yields nothing you can paste into a cookie', async () => {
  const d = await db();
  const id = await member(d, 'cookie@example.com');
  const token = await createSession(d, id);

  const { rows } = await d.query<{ token_hash: string }>('select token_hash from member_session');
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0]!.token_hash, token, 'the stored value must not be the bearer token itself');
  assert.equal(rows[0]!.token_hash, hashSessionToken(token));
  // The decisive property: what is at rest cannot be replayed as a session.
  assert.equal(await getSessionMember(d, rows[0]!.token_hash), null, 'the stored value is not itself a key');
  assert.equal(await getSessionMember(d, token), id, 'the real cookie still works');
});

test('SEC-14 · changing your password signs out every OTHER device, keeping the one in your hand', async () => {
  const d = await db();
  const id = await member(d, 'change@example.com');
  const mine = await createSession(d, id);
  const attacker = await createSession(d, id);
  const oldPhone = await createSession(d, id);

  const ended = await deleteOtherSessionsForMember(d, id, mine);

  assert.equal(ended, 2);
  assert.equal(await getSessionMember(d, mine), id, 'the device they are using stays signed in');
  assert.equal(await getSessionMember(d, attacker), null, 'the intruder is gone — the whole point');
  assert.equal(await getSessionMember(d, oldPhone), null);
});

test('SEC-14 · with no current token it falls back to revoking everything (never leaves an intruder behind)', async () => {
  const d = await db();
  const id = await member(d, 'notoken@example.com');
  const a = await createSession(d, id);
  assert.equal(await deleteOtherSessionsForMember(d, id, null), 1);
  assert.equal(await getSessionMember(d, a), null);
});

test('SEC-13 · the no-such-member login path pays the same scrypt cost (no timing oracle)', async () => {
  // Asserting the WORK happens, not a wall-clock threshold — timing assertions are flaky on shared CI. What
  // matters is that the miss path runs a real KDF instead of returning instantly.
  const t0 = process.hrtime.bigint();
  const r = await burnPasswordTime('whatever-they-typed');
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(r, false, 'it never authenticates anyone');
  assert.ok(ms > 5, `expected real KDF work on the miss path, took ${ms.toFixed(1)}ms`);
});

test('SEC-12 · sessions still work on the PRE-MIGRATION schema (a security fix must not take login down)', async () => {
  // This is the test for the mistake I actually made. Prod migrations are applied BY HAND, so the deploy and the
  // schema change never land together. My first cut read/wrote token_hash unconditionally, which would have broken
  // login for EVERYONE in that window — no session could be created or resolved. The store must work either way.
  const d = await db();
  await d.query('alter table member_session drop column if exists token_hash'); // rewind to the 0009 shape
  await d.query('alter table member_session alter column token set not null');
  __resetSessionSchemaCache();

  const id = await member(d, 'premigration@example.com');
  const token = await createSession(d, id);
  assert.equal(await getSessionMember(d, token), id, 'login works before the migration lands');
  assert.equal(await getSessionMember(d, 'wrong-token'), null);
  await deleteSession(d, token);
  assert.equal(await getSessionMember(d, token), null, 'and sign-out works too');
  __resetSessionSchemaCache(); // leave the process clean for the other tests
});
