import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// Set the secrets these modules read at call-time, BEFORE importing them is unnecessary (they read
// process.env lazily), but set them up-front so every test sees them.
process.env.ACTIVITY_TOKEN_KEY = randomBytes(32).toString('base64');
process.env.STRAVA_CLIENT_ID = 'test-client-id';
process.env.STRAVA_CLIENT_SECRET = 'test-client-secret';

const { encryptToken, decryptToken, signState, verifyState } = await import('../lib/activity/crypto.ts');
const strava = await import('../lib/activity/strava.ts');
const store = await import('../lib/activity/store.ts');
const { runActivitySync } = await import('../lib/activity/cron.ts');
const { getActivityPanel, getConnection, connectWithTokens, getConnectionTokens, syncMember, listRecentActivities } = store;

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun) values ('Jay Crain','jay@x.com','cyclist') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

const tokens = (over: Partial<strava.StravaTokens> = {}): strava.StravaTokens => ({
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  scope: 'read,activity:read',
  athleteId: '12345',
  athleteName: 'Jay Crain',
  ...over,
});

// --- crypto ---------------------------------------------------------------------------------

test('encryptToken round-trips and never stores plaintext', () => {
  const ct = encryptToken('refresh-xyz');
  assert.notEqual(ct, 'refresh-xyz');
  assert.ok(ct.startsWith('v1$'));
  assert.equal(decryptToken(ct), 'refresh-xyz');
});

test('decryptToken rejects a tampered ciphertext', () => {
  const ct = encryptToken('secret');
  const parts = ct.split('$');
  parts[3] = Buffer.from('tampered-bytes').toString('base64');
  assert.throws(() => decryptToken(parts.join('$')));
  assert.throws(() => decryptToken('garbage'));
});

// --- state (CSRF + member binding) ----------------------------------------------------------

test('signState/verifyState binds a member and expires', () => {
  const now = Date.now();
  const s = signState('member-1', now + 1000);
  assert.equal(verifyState(s, now), 'member-1');
  assert.equal(verifyState(s, now + 2000), null); // expired
  assert.equal(verifyState(s.slice(0, -2) + 'zz', now), null); // tampered sig
  assert.equal(verifyState(undefined, now), null);
});

// --- provider -------------------------------------------------------------------------------

test('authorizeUrl carries the minimum-necessary scope and the redirect', () => {
  const url = new URL(strava.authorizeUrl('the-state', 'https://app.example.com/api/activity/strava/callback'));
  assert.equal(url.searchParams.get('scope'), 'read,activity:read');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'the-state');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.example.com/api/activity/strava/callback');
  assert.equal(url.searchParams.get('client_id'), 'test-client-id');
});

test('exchangeCode and fetchRecent hit Strava and normalize', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const u = String(input);
    if (u.includes('/oauth/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'AT', refresh_token: 'RT', expires_at: 999, scope: 'read,activity:read',
          athlete: { id: 7, firstname: 'Jay', lastname: 'Crain' },
        }),
        { status: 200 },
      );
    }
    if (u.includes('/athlete/activities')) {
      return new Response(
        JSON.stringify([{ id: 1, sport_type: 'Ride', name: 'Morning', start_date: '2026-06-01T07:00:00Z', distance: 24000, moving_time: 3600 }]),
        { status: 200 },
      );
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  try {
    const t = await strava.exchangeCode('the-code', 'https://x/cb');
    assert.equal(t.accessToken, 'AT');
    assert.equal(t.athleteName, 'Jay Crain');
    assert.equal(t.athleteId, '7');
    const acts = await strava.fetchRecent('AT', 30);
    assert.equal(acts.length, 1);
    assert.equal(acts[0]!.type, 'ride');
    assert.equal(acts[0]!.distanceM, 24000);
  } finally {
    globalThis.fetch = orig;
  }
});

// --- store + sync ---------------------------------------------------------------------------

test('connectWithTokens stores encrypted tokens + consent; getConnectionTokens decrypts', async () => {
  const { db, memberId } = await dbWithMember();
  await connectWithTokens(db, memberId, 'strava', tokens(), '2026-06-17T00:00:00Z');

  const raw = (
    await db.query<{ access_token_enc: string; consent_granted_at: string | null }>(
      `select access_token_enc, consent_granted_at from activity_connection where member_id=$1 and provider='strava'`,
      [memberId],
    )
  ).rows[0]!;
  assert.ok(raw.access_token_enc.startsWith('v1$')); // encrypted at rest
  assert.ok(!raw.access_token_enc.includes('access-abc')); // plaintext never present
  assert.ok(raw.consent_granted_at); // consent recorded

  const dec = await getConnectionTokens(db, memberId, 'strava');
  assert.equal(dec?.accessToken, 'access-abc');
  assert.equal(dec?.refreshToken, 'refresh-xyz');
});

test('syncMember refreshes an expired token, then fetches and saves', async () => {
  const { db, memberId } = await dbWithMember();
  // Connect with an already-expired access token to force the refresh path.
  await connectWithTokens(db, memberId, 'strava', tokens({ expiresAt: Math.floor(Date.now() / 1000) - 100 }), '2026-06-17T00:00:00Z');

  let refreshed = false;
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input);
    if (u.includes('/oauth/token')) {
      refreshed = true;
      assert.match(String(init?.body), /refresh_token/); // it's the refresh grant
      return new Response(JSON.stringify({ access_token: 'AT2', refresh_token: 'RT2', expires_at: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
    }
    if (u.includes('/athlete/activities')) {
      assert.match(init?.headers ? JSON.stringify(init.headers) : '', /AT2/); // used the refreshed token
      // start_date is RELATIVE to now so the activity stays inside the sinceDays window as real time passes
      // (a hardcoded date silently ages out of listRecentActivities and empties the result).
      const startDate = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
      return new Response(JSON.stringify([{ id: 55, sport_type: 'Run', name: 'Evening', start_date: startDate, distance: 5000, moving_time: 1800 }]), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  try {
    const n = await syncMember(db, memberId, 'strava', 14);
    assert.equal(n, 1);
    assert.ok(refreshed);
    const recent = await listRecentActivities(db, memberId, 14);
    assert.equal(recent[0]!.type, 'run');
    // The rotated refresh token is persisted (encrypted).
    const dec = await getConnectionTokens(db, memberId, 'strava');
    assert.equal(dec?.refreshToken, 'RT2');
    assert.equal(dec?.accessToken, 'AT2');
  } finally {
    globalThis.fetch = orig;
  }
});

test('runActivitySync syncs connected members and isolates failures', async () => {
  const { db, memberId } = await dbWithMember();
  await connectWithTokens(db, memberId, 'strava', tokens(), '2026-06-17T00:00:00Z');

  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    if (String(input).includes('/athlete/activities')) {
      return new Response(JSON.stringify([{ id: 9, sport_type: 'Walk', start_date: '2026-06-16T08:00:00Z', distance: 3000, moving_time: 2400 }]), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  try {
    const r = await runActivitySync(db, 'strava', 14);
    assert.equal(r.members, 1);
    assert.equal(r.synced, 1);
    assert.equal(r.failed, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test('disconnect nulls tokens and stops the panel; delete removes events', async () => {
  const { db, memberId } = await dbWithMember();
  await connectWithTokens(db, memberId, 'strava', tokens(), '2026-06-17T00:00:00Z');
  await store.saveActivities(db, memberId, [
    { provider: 'strava', externalId: 'e1', type: 'ride', name: 'r', startedAt: new Date().toISOString(), distanceM: 1000, movingTimeS: 600 },
  ]);

  assert.equal((await getActivityPanel(db, memberId, 'Cyclist')).connected, true);

  await store.markDisconnected(db, memberId, 'strava');
  assert.equal(await getConnectionTokens(db, memberId, 'strava'), null); // tokens gone
  assert.equal((await getConnection(db, memberId, 'strava'))?.status, 'disconnected');
  assert.equal((await getActivityPanel(db, memberId, 'Cyclist')).connected, false);

  const deleted = await store.deleteActivityData(db, memberId, 'strava');
  assert.equal(deleted, 1);
  assert.equal((await listRecentActivities(db, memberId, 14)).length, 0);
});
