import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { issueToken, consumeToken, hashToken } from '../lib/auth/tokens.ts';

// SEC-08 — accounts were provisioned on UNVERIFIED emails with no password reset and no recovery, which also
// made the SEC-01 takeover permanent. These lock the invariants of the token that now underpins both flows:
// it can reset a password, so it must be hashed at rest, single-use, expiring, and superseded on re-request.

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

test('the PLAINTEXT token is never stored — only its hash', async () => {
  const d = await db();
  const tok = await issueToken(d, 'password_reset', 'a@x.com', null);
  const { rows } = await d.query<{ token_hash: string }>('select token_hash from auth_token');
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0]!.token_hash, tok, 'a DB read must not yield a replayable credential');
  assert.equal(rows[0]!.token_hash, hashToken(tok));
});

test('a token redeems exactly ONCE', async () => {
  const d = await db();
  const tok = await issueToken(d, 'password_reset', 'a@x.com', null);
  assert.ok(await consumeToken(d, 'password_reset', tok), 'first use works');
  assert.equal(await consumeToken(d, 'password_reset', tok), null, 'a replay is refused');
});

test('a token cannot be redeemed for a DIFFERENT purpose', async () => {
  const d = await db();
  const tok = await issueToken(d, 'verify_email', 'a@x.com', null);
  assert.equal(await consumeToken(d, 'password_reset', tok), null, 'a verify link must not reset a password');
});

test('re-requesting SUPERSEDES the old link — only the newest email works', async () => {
  const d = await db();
  const first = await issueToken(d, 'password_reset', 'a@x.com', null);
  const second = await issueToken(d, 'password_reset', 'a@x.com', null);
  assert.equal(await consumeToken(d, 'password_reset', first), null, 'the older link is dead');
  assert.ok(await consumeToken(d, 'password_reset', second), 'the newest link works');
});

test('an EXPIRED token is refused', async () => {
  const d = await db();
  const tok = await issueToken(d, 'password_reset', 'a@x.com', null);
  await d.query("update auth_token set expires_at = now() - interval '1 minute'");
  assert.equal(await consumeToken(d, 'password_reset', tok), null);
});

test('an unknown / empty token is refused', async () => {
  const d = await db();
  assert.equal(await consumeToken(d, 'password_reset', 'not-a-real-token'), null);
  assert.equal(await consumeToken(d, 'password_reset', ''), null);
});

test('the subject comes back on redemption so the caller acts on the PROVEN address', async () => {
  const d = await db();
  const tok = await issueToken(d, 'password_reset', 'Mixed@Case.COM', null);
  const got = await consumeToken(d, 'password_reset', tok);
  assert.equal(got?.email, 'mixed@case.com', 'normalised, so it matches the credential lookup');
});
