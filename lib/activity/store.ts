// Activity store + the dashboard panel read. Framework-free (takes a Db).

import type { Db } from '../db/schema.ts';
import type { Activity, RecentActivity, ActivityPanel, WeekStats, ActivityType } from './types.ts';
import { framingLine } from './summary.ts';

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
