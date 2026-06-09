import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { hashPassword, verifyPassword } from '../lib/auth/password.ts';
import {
  createCredential,
  findCredentialByEmail,
  getCredentialByMember,
  updatePasswordHash,
  hasCredential,
  createSession,
  getSessionMember,
  deleteSession,
} from '../lib/auth/store.ts';

async function dbWithMember(email = 'greg@example.com'): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Greg Welk', $1) returning member_id`,
    [email],
  );
  return { db, memberId: r.rows[0]!.member_id };
}

test('password hashing round-trips and rejects wrong passwords', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.ok(stored.startsWith('scrypt$'));
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  assert.equal(await verifyPassword('correct horse battery', 'garbage'), false);
});

test('credential create + lookup by email is case-insensitive', async () => {
  const { db, memberId } = await dbWithMember('Greg@Example.com');
  assert.equal(await hasCredential(db, memberId), false);
  await createCredential(db, memberId, 'Greg@Example.com', await hashPassword('passw0rd!'));
  assert.equal(await hasCredential(db, memberId), true);
  const cred = await findCredentialByEmail(db, 'greg@example.com'); // different case
  assert.equal(cred?.member_id, memberId);
  assert.equal(await verifyPassword('passw0rd!', cred!.password_hash), true);
});

test('changing a password updates the stored hash (old fails, new verifies)', async () => {
  const { db, memberId } = await dbWithMember('change@x.com');
  await createCredential(db, memberId, 'change@x.com', await hashPassword('oldpassw0rd'));
  const cred1 = await getCredentialByMember(db, memberId);
  assert.equal(await verifyPassword('oldpassw0rd', cred1!.password_hash), true);

  await updatePasswordHash(db, memberId, await hashPassword('newpassw0rd!'));
  const cred2 = await getCredentialByMember(db, memberId);
  assert.equal(await verifyPassword('oldpassw0rd', cred2!.password_hash), false);
  assert.equal(await verifyPassword('newpassw0rd!', cred2!.password_hash), true);
});

test('sessions resolve to the member, and revoke on delete', async () => {
  const { db, memberId } = await dbWithMember();
  const token = await createSession(db, memberId);
  assert.equal(await getSessionMember(db, token), memberId);
  assert.equal(await getSessionMember(db, 'nope'), null);
  assert.equal(await getSessionMember(db, null), null);
  await deleteSession(db, token);
  assert.equal(await getSessionMember(db, token), null);
});

test('expired sessions do not resolve', async () => {
  const { db, memberId } = await dbWithMember();
  await db.query(
    `insert into member_session (token, member_id, expires_at) values ('expired', $1, now() - interval '1 hour')`,
    [memberId],
  );
  assert.equal(await getSessionMember(db, 'expired'), null);
});
