// Activity store + the dashboard panel read. Framework-free (takes a Db).

import type { Db } from '../db/schema.ts';
import type { Activity, RecentActivity, ActivityPanel, WeekStats, ActivityType } from './types.ts';
import { framingLine } from './summary.ts';
import { encryptToken, decryptToken } from './crypto.ts';
import { refreshTokens, fetchRecent, type StravaTokens } from './strava.ts';

const expiryISO = (epochSec: number) => new Date(epochSec * 1000).toISOString();
// Refresh a little before the real expiry so an in-flight request never races the boundary.
const EXPIRY_SKEW_MS = 60_000;

export async function setConnection(
  db: Db,
  memberId: string,
  provider: string,
  athleteName: string | null,
): Promise<void> {
  await db.query(
    `insert into activity_connection (member_id, provider, status, athlete_name)
     values ($1,$2,'connected',$3)
     on conflict (member_id, provider) do update set status='connected', athlete_name=excluded.athlete_name`,
    [memberId, provider, athleteName],
  );
}

export async function getConnection(
  db: Db,
  memberId: string,
  provider = 'strava',
): Promise<{ provider: string; status: string; athleteName: string | null } | null> {
  const { rows } = await db.query<{ provider: string; status: string; athlete_name: string | null }>(
    `select provider, status, athlete_name from activity_connection where member_id=$1 and provider=$2`,
    [memberId, provider],
  );
  const r = rows[0];
  return r ? { provider: r.provider, status: r.status, athleteName: r.athlete_name } : null;
}

// --- OAuth connection lifecycle (Path B) ---------------------------------------------------

/** Persist a freshly-connected provider with encrypted tokens + the explicit consent timestamp. */
export async function connectWithTokens(
  db: Db,
  memberId: string,
  provider: string,
  tokens: StravaTokens,
  consentAtISO: string,
): Promise<void> {
  await db.query(
    `insert into activity_connection
       (member_id, provider, status, athlete_name, athlete_id, scope,
        access_token_enc, refresh_token_enc, token_expires_at, consent_granted_at)
     values ($1,$2,'connected',$3,$4,$5,$6,$7,$8,$9)
     on conflict (member_id, provider) do update set
       status='connected',
       athlete_name=excluded.athlete_name,
       athlete_id=excluded.athlete_id,
       scope=excluded.scope,
       access_token_enc=excluded.access_token_enc,
       refresh_token_enc=excluded.refresh_token_enc,
       token_expires_at=excluded.token_expires_at,
       consent_granted_at=coalesce(activity_connection.consent_granted_at, excluded.consent_granted_at)`,
    [
      memberId,
      provider,
      tokens.athleteName,
      tokens.athleteId,
      tokens.scope,
      encryptToken(tokens.accessToken),
      encryptToken(tokens.refreshToken),
      expiryISO(tokens.expiresAt),
      consentAtISO,
    ],
  );
}

type TokenRow = {
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | Date | null;
  scope: string | null;
  status: string;
};

/** Decrypted tokens for a connected provider, or null if not connected / no tokens stored. */
export async function getConnectionTokens(
  db: Db,
  memberId: string,
  provider = 'strava',
): Promise<{ accessToken: string; refreshToken: string; expiresAtMs: number; scope: string | null } | null> {
  const { rows } = await db.query<TokenRow>(
    `select access_token_enc, refresh_token_enc, token_expires_at, scope, status
       from activity_connection where member_id=$1 and provider=$2`,
    [memberId, provider],
  );
  const r = rows[0];
  if (!r || r.status !== 'connected' || !r.access_token_enc || !r.refresh_token_enc) return null;
  return {
    accessToken: decryptToken(r.access_token_enc),
    refreshToken: decryptToken(r.refresh_token_enc),
    expiresAtMs: r.token_expires_at ? new Date(r.token_expires_at).getTime() : 0,
    scope: r.scope,
  };
}

async function persistRefreshed(db: Db, memberId: string, provider: string, t: StravaTokens): Promise<void> {
  await db.query(
    `update activity_connection
        set access_token_enc=$3, refresh_token_enc=$4, token_expires_at=$5, scope=coalesce($6, scope)
      where member_id=$1 and provider=$2`,
    [memberId, provider, encryptToken(t.accessToken), encryptToken(t.refreshToken), expiryISO(t.expiresAt), t.scope],
  );
}

export async function markDisconnected(db: Db, memberId: string, provider = 'strava'): Promise<void> {
  await db.query(
    `update activity_connection
        set status='disconnected', access_token_enc=null, refresh_token_enc=null, token_expires_at=null
      where member_id=$1 and provider=$2`,
    [memberId, provider],
  );
}

/** Right-to-erasure: remove the member's synced activity for a provider (consent withdrawn). */
export async function deleteActivityData(db: Db, memberId: string, provider = 'strava'): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `with d as (delete from activity_event where member_id=$1 and provider=$2 returning 1)
     select count(*)::text as n from d`,
    [memberId, provider],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function touchLastSynced(db: Db, memberId: string, provider = 'strava'): Promise<void> {
  await db.query(`update activity_connection set last_synced_at=now() where member_id=$1 and provider=$2`, [
    memberId,
    provider,
  ]);
}

export async function listConnectedMembers(db: Db, provider = 'strava'): Promise<string[]> {
  const { rows } = await db.query<{ member_id: string }>(
    `select member_id from activity_connection where provider=$1 and status='connected'`,
    [provider],
  );
  return rows.map((r) => r.member_id);
}

/**
 * Pull recent activity for one member: refresh the access token if it's expiring, fetch from the
 * provider, upsert, and stamp last_synced_at. Returns the number of activities written.
 * Throws on a hard failure (e.g. revoked grant) so the caller can decide to mark needs-reconnect.
 */
export async function syncMember(db: Db, memberId: string, provider = 'strava', sinceDays = 30): Promise<number> {
  const conn = await getConnectionTokens(db, memberId, provider);
  if (!conn) return 0;

  let accessToken = conn.accessToken;
  if (Date.now() >= conn.expiresAtMs - EXPIRY_SKEW_MS) {
    const refreshed = await refreshTokens(conn.refreshToken, conn.scope);
    await persistRefreshed(db, memberId, provider, refreshed);
    accessToken = refreshed.accessToken;
  }

  const acts = await fetchRecent(accessToken, sinceDays);
  const n = await saveActivities(db, memberId, acts);
  await touchLastSynced(db, memberId, provider);
  return n;
}

export async function saveActivities(db: Db, memberId: string, acts: Activity[]): Promise<number> {
  for (const a of acts) {
    await db.query(
      `insert into activity_event
         (member_id, provider, external_id, activity_type, name, started_at, distance_m, moving_time_s)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (provider, external_id) do update
         set activity_type=excluded.activity_type, name=excluded.name, started_at=excluded.started_at,
             distance_m=excluded.distance_m, moving_time_s=excluded.moving_time_s`,
      [memberId, a.provider, a.externalId, a.type, a.name, a.startedAt, a.distanceM, a.movingTimeS],
    );
  }
  return acts.length;
}

type Row = {
  provider: string;
  external_id: string;
  activity_type: string;
  name: string | null;
  started_at: string | Date;
  distance_m: number | string | null;
  moving_time_s: number | string | null;
  days_ago: number | string;
};

const mapRow = (r: Row): RecentActivity => ({
  provider: r.provider,
  externalId: r.external_id,
  type: r.activity_type as ActivityType,
  name: r.name,
  startedAt: typeof r.started_at === 'string' ? r.started_at : new Date(r.started_at).toISOString(),
  distanceM: r.distance_m === null ? null : Number(r.distance_m),
  movingTimeS: r.moving_time_s === null ? null : Number(r.moving_time_s),
  daysAgo: Number(r.days_ago),
});

export async function listRecentActivities(db: Db, memberId: string, days = 14): Promise<RecentActivity[]> {
  const { rows } = await db.query<Row>(
    `select provider, external_id, activity_type, name, started_at, distance_m, moving_time_s,
            floor(extract(epoch from (now()-started_at))/86400)::int as days_ago
     from activity_event
     where member_id=$1 and started_at >= now() - ($2 * interval '1 day')
     order by started_at desc`,
    [memberId, days],
  );
  return rows.map(mapRow);
}

const ZERO: WeekStats = { count: 0, distanceM: 0, movingTimeS: 0 };

export async function getActivityPanel(
  db: Db,
  memberId: string,
  identityNoun: string | null,
): Promise<ActivityPanel> {
  const conn = await getConnection(db, memberId);
  if (!conn || conn.status !== 'connected') {
    return { connected: false, recent: [], thisWeek: ZERO, lastWeek: ZERO, line: '' };
  }
  const recent = await listRecentActivities(db, memberId, 14);
  const { rows } = await db.query<Record<string, number | string>>(
    `select
       count(*) filter (where started_at >= now() - interval '7 days') as tw_c,
       coalesce(sum(distance_m) filter (where started_at >= now() - interval '7 days'),0) as tw_d,
       coalesce(sum(moving_time_s) filter (where started_at >= now() - interval '7 days'),0) as tw_t,
       count(*) filter (where started_at >= now() - interval '14 days' and started_at < now() - interval '7 days') as lw_c,
       coalesce(sum(distance_m) filter (where started_at >= now() - interval '14 days' and started_at < now() - interval '7 days'),0) as lw_d,
       coalesce(sum(moving_time_s) filter (where started_at >= now() - interval '14 days' and started_at < now() - interval '7 days'),0) as lw_t
     from activity_event where member_id=$1`,
    [memberId],
  );
  const r = rows[0]!;
  const thisWeek: WeekStats = { count: Number(r.tw_c), distanceM: Number(r.tw_d), movingTimeS: Number(r.tw_t) };
  const lastWeek: WeekStats = { count: Number(r.lw_c), distanceM: Number(r.lw_d), movingTimeS: Number(r.lw_t) };
  return { connected: true, recent, thisWeek, lastWeek, line: framingLine(identityNoun, thisWeek) };
}
