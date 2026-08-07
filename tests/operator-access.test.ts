// Operators, and the record of who opened whose story.
//
// The property under test is not "does the code run" — it's the three things the design exists to give us:
// attribution (the log names a human), revocation (disabling takes effect NOW), and non-forgeability (the
// identity is inside the signature, so holding the cookie doesn't let you rename yourself).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { signAdminToken, readAdminToken, verifyAdminToken } from '../lib/auth/admin-token.ts';
import { createOperator, verifyOperator, disableOperator, enableOperator, operatorIsLive, listOperators, operatorLabel, ROOT_LABEL } from '../lib/auth/operator.ts';
import { recordMemberAccess, accessesForMember, accessesByOperator } from '../lib/admin/access-log.ts';

const SECRET = 'test-admin-secret';
const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  return d;
}

// ── the token carries an identity, and that identity cannot be edited ──────────────────────────────────────────

test('the token round-trips WHICH operator', () => {
  const t = signAdminToken(SECRET, NOW + HOUR, 'op-123');
  assert.deepEqual(readAdminToken(SECRET, t, NOW), { operatorId: 'op-123', expiresAtMs: NOW + HOUR });
});

test('you cannot rename yourself by editing the cookie', () => {
  // The whole point of putting the id inside the signed payload. Whoever holds the cookie holds a claim they
  // cannot alter — otherwise the audit log records whatever the reader felt like typing.
  const t = signAdminToken(SECRET, NOW + HOUR, 'op-123');
  const [, exp, sig] = t.split('.');
  const forged = `op-999.${exp}.${sig}`;
  assert.equal(readAdminToken(SECRET, forged, NOW), null, 'a swapped operator id must fail the HMAC');
});

test('a v1 token (no identity) still works, as root', () => {
  // Back-compat matters here for a non-obvious reason: without it, deploying this signs out whoever holds a live
  // session, and they'd have to work out why with no console access. A v1 token already proved knowledge of
  // ADMIN_PASSWORD, so honouring it as root gives up nothing.
  const payload = String(NOW + HOUR);
  const v1 = signAdminToken(SECRET, NOW + HOUR); // no operator → still emits the v2 shape…
  assert.equal(v1.split('.').length, 3, 'new tokens are always v2, even for root');
  // …so build a genuine v1 the way the OLD code did, and prove the reader still accepts it.
  const legacy = `${payload}.${createHmac('sha256', SECRET).update(payload).digest('hex')}`;
  assert.deepEqual(readAdminToken(SECRET, legacy, NOW), { operatorId: null, expiresAtMs: NOW + HOUR });
});

test('expired and wrong-secret tokens are refused', () => {
  const t = signAdminToken(SECRET, NOW - 1, 'op-123');
  assert.equal(readAdminToken(SECRET, t, NOW), null, 'expired');
  const good = signAdminToken(SECRET, NOW + HOUR, 'op-123');
  assert.equal(readAdminToken('other-secret', good, NOW), null, 'wrong signing key');
  assert.equal(verifyAdminToken(SECRET, 'garbage', NOW), false);
  assert.equal(verifyAdminToken(SECRET, undefined, NOW), false);
});

// ── operators ─────────────────────────────────────────────────────────────────────────────────────────────────

test('an operator signs in with their own password, and a wrong one fails', async () => {
  const d = await db();
  const op = await createOperator(d, 'Donna', 'donna@example.test', 'correct horse battery');
  assert.ok(await verifyOperator(d, 'donna@example.test', 'correct horse battery'));
  assert.equal(await verifyOperator(d, 'donna@example.test', 'wrong'), null);
  assert.equal(await verifyOperator(d, 'DONNA@EXAMPLE.TEST', 'correct horse battery') !== null, true, 'email match is case-insensitive');
  assert.equal(await verifyOperator(d, 'nobody@example.test', 'anything'), null, 'unknown address');
  assert.equal(operatorLabel(op), 'Donna <donna@example.test>');
});

test('DISABLING TAKES EFFECT IMMEDIATELY — the point of the whole design', async () => {
  // Revocation that waits for a 30-day cookie to lapse is not revocation. A disabled operator must fail both the
  // login door and the already-holding-a-valid-cookie door.
  const d = await db();
  const op = await createOperator(d, 'Contractor', 'temp@example.test', 'pw');
  assert.ok(await operatorIsLive(d, op.id), 'live before');

  await disableOperator(d, op.id);

  assert.equal(await operatorIsLive(d, op.id), null, 'a valid cookie no longer resolves to a live operator');
  assert.equal(await verifyOperator(d, 'temp@example.test', 'pw'), null, 'and they cannot sign in again');

  // Reversible, because offboarding is sometimes a mistake.
  await enableOperator(d, op.id);
  assert.ok(await operatorIsLive(d, op.id), 'and it can be undone');
});

test('operators are never deleted, so the log keeps its actor', async () => {
  const d = await db();
  const op = await createOperator(d, 'Gone', 'gone@example.test', 'pw');
  await disableOperator(d, op.id);
  const all = await listOperators(d);
  assert.equal(all.length, 1, 'disabling removes access, not history');
  assert.ok(all[0]!.disabledAt instanceof Date);
});

test('a disabled address can be reissued without rewriting history', async () => {
  // The partial unique index is on LIVE rows only. A person leaves, someone else inherits the address; the old
  // row and every log line naming it stay exactly as they were.
  const d = await db();
  const first = await createOperator(d, 'First', 'ops@example.test', 'pw1');
  await disableOperator(d, first.id);
  const second = await createOperator(d, 'Second', 'ops@example.test', 'pw2');
  assert.notEqual(second.id, first.id);
  assert.equal((await verifyOperator(d, 'ops@example.test', 'pw2'))?.id, second.id, 'the live one answers');
  assert.equal(await verifyOperator(d, 'ops@example.test', 'pw1'), null, 'the retired one does not');
});

test('two live operators cannot share an address', async () => {
  const d = await db();
  await createOperator(d, 'A', 'dup@example.test', 'pw');
  await assert.rejects(() => createOperator(d, 'B', 'dup@example.test', 'pw'), 'the unique index must hold');
});

// ── the access log ────────────────────────────────────────────────────────────────────────────────────────────

test('the log answers BOTH questions: who read this member, and what did this operator read', async () => {
  const d = await db();
  const op = await createOperator(d, 'Jay', 'jay@example.test', 'pw');
  const m1 = '11111111-1111-1111-1111-111111111111';
  const m2 = '22222222-2222-2222-2222-222222222222';

  await recordMemberAccess(d, { operatorId: op.id, operatorLabel: operatorLabel(op), memberId: m1, surface: 'admin_member_page' });
  await recordMemberAccess(d, { operatorId: op.id, operatorLabel: operatorLabel(op), memberId: m2, surface: 'founder_companion', note: 'attention sweep' });
  await recordMemberAccess(d, { operatorId: null, operatorLabel: ROOT_LABEL, memberId: m1, surface: 'diagnostic_api' });

  const forM1 = await accessesForMember(d, m1);
  assert.equal(forM1.length, 2, 'a member can be told everyone who opened their record');
  assert.deepEqual(forM1.map((e) => e.surface).sort(), ['admin_member_page', 'diagnostic_api']);
  assert.ok(forM1.some((e) => e.operatorLabel === ROOT_LABEL), 'a bootstrap login is still attributed to something');

  const byJay = await accessesByOperator(d, op.id);
  assert.equal(byJay.length, 2, 'and an operator can be reviewed on offboarding');
  assert.equal(byJay.find((e) => e.memberId === m2)?.note, 'attention sweep');
});

test('a logging failure never takes down the surface it observes — but it is LOUD', async () => {
  // Best-effort by design: an audit write that can break the console gets ripped out the first time it fires.
  // What it must never do is fail silently, because an empty log reads as "nobody looked" — the most dangerous
  // possible lie from this table.
  const broken = { query: async () => { throw new Error('table missing'); } } as unknown as Db;
  const errs: unknown[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errs.push(a); };
  try {
    await recordMemberAccess(broken, { operatorId: null, operatorLabel: ROOT_LABEL, memberId: 'm', surface: 'admin_member_page' });
  } finally {
    console.error = original;
  }
  assert.equal(errs.length, 1, 'the failure must be reported, not swallowed');
  assert.match(String(errs[0]), /NOT RECORDED/, 'and it must say what was lost');
});
