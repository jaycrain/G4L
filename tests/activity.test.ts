import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { normalizeStravaActivity } from '../lib/activity/strava.ts';
import { saveActivities, listRecentActivities, setConnection, getActivityPanel } from '../lib/activity/store.ts';
import { framingLine, formatDistance, typeLabel, relativeDay, weekTrend } from '../lib/activity/summary.ts';
import { computeNudges, topNudge } from '../lib/agent/nudge.ts';
import type { Activity } from '../lib/activity/types.ts';

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun) values ('Tom Miller','t@x.com','cyclist') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

const daysAgoISO = (d: number) => new Date(Date.now() - d * 86400 * 1000).toISOString();
const ride = (id: string, daysAgo: number, km: number): Activity => ({
  provider: 'strava',
  externalId: id,
  type: 'ride',
  name: 'Ride',
  startedAt: daysAgoISO(daysAgo),
  distanceM: km * 1000,
  movingTimeS: 3600,
});

test('normalizeStravaActivity maps sport_type and fields', () => {
  const a = normalizeStravaActivity({ id: 99, sport_type: 'MountainBikeRide', name: 'Trail', start_date: '2026-06-01T12:00:00Z', distance: 24000, moving_time: 5400 });
  assert.equal(a.provider, 'strava');
  assert.equal(a.externalId, '99');
  assert.equal(a.type, 'ride');
  assert.equal(a.distanceM, 24000);
  assert.equal(a.movingTimeS, 5400);
  assert.equal(normalizeStravaActivity({ id: 1, type: 'Kitesurf' }).type, 'other');
});

test('saving is idempotent on (provider, external_id)', async () => {
  const { db, memberId } = await dbWithMember();
  await saveActivities(db, memberId, [ride('a1', 1, 30)]);
  await saveActivities(db, memberId, [{ ...ride('a1', 1, 30), distanceM: 40000 }]); // same id, new distance
  const recent = await listRecentActivities(db, memberId, 14);
  assert.equal(recent.length, 1);
  assert.equal(recent[0]!.distanceM, 40000);
});

test('listRecentActivities respects the window and computes daysAgo', async () => {
  const { db, memberId } = await dbWithMember();
  await saveActivities(db, memberId, [ride('r1', 3, 20), ride('r2', 20, 50)]);
  const recent = await listRecentActivities(db, memberId, 14);
  assert.equal(recent.length, 1); // the 20-day-old one is outside the window
  assert.equal(recent[0]!.externalId, 'r1');
  assert.equal(recent[0]!.daysAgo, 3);
});

test('panel buckets this week vs last (calendar Mon–Sun) and frames by identity', async () => {
  const { db, memberId } = await dbWithMember();
  await saveActivities(db, memberId, [ride('t1', 1, 32), ride('t2', 5, 20), ride('l1', 10, 40)]);
  const panel = await getActivityPanel(db, memberId, 'Cyclist');
  assert.equal(panel.connected, false); // no connection row yet
  await setConnection(db, memberId, 'strava', 'Strava');
  // Pin each ride to a precise position relative to the query's OWN week boundary (date_trunc('week', now())),
  // so the buckets are deterministic regardless of what day the test runs. Mon–Sun weeks.
  const at = (offset: string, distanceM: number) =>
    db.query(`update activity_event set started_at = date_trunc('week', now()) ${offset} where member_id=$1 and distance_m=$2`, [memberId, distanceM]);
  await at("+ interval '1 hour'", 32000); // this week (Monday)
  await at("+ interval '2 days'", 20000); // this week (Wednesday)
  await at("- interval '2 days'", 40000); // last week (Saturday)
  const p2 = await getActivityPanel(db, memberId, 'Cyclist');
  assert.equal(p2.connected, true);
  assert.equal(p2.thisWeek.count, 2, 'two rides fall in this Mon–Sun week');
  assert.equal(p2.lastWeek.count, 1, 'the Saturday ride is last week');
  assert.equal(p2.thisWeek.distanceM, 52000);
  assert.equal(p2.line, 'The Cyclist has been showing up.'); // natural case
});

test('framing + format helpers', () => {
  assert.equal(framingLine('cyclist', { count: 0, distanceM: 0, movingTimeS: 0 }), 'A quiet week — that is part of it too.');
  assert.equal(framingLine(null, { count: 2, distanceM: 1, movingTimeS: 1 }), 'You has been showing up.');
  assert.equal(formatDistance(47200), '29.3 mi'); // imperial (US)
  assert.equal(formatDistance(800), '0.5 mi');
  assert.equal(formatDistance(120), '394 ft'); // under a tenth of a mile → feet
  assert.equal(formatDistance(null), null);
  // weekTrend — reflective direction on distance (miles), Mon–Sun vs prior week
  const wk = (mi: number) => ({ count: 1, distanceM: mi * 1609.344, movingTimeS: 1 });
  assert.equal(weekTrend(wk(131), wk(90)), '41 mi more than last week.');
  assert.equal(weekTrend(wk(90), wk(131)), '41 mi less than last week.');
  assert.equal(weekTrend(wk(100), wk(100)), 'About the same as last week.');
  assert.equal(weekTrend(wk(50), { count: 0, distanceM: 0, movingTimeS: 0 }), null, 'no prior week → no trend');
  assert.equal(typeLabel('ride'), 'Ride');
  assert.equal(relativeDay(0), 'today');
  assert.equal(relativeDay(1), 'yesterday');
  assert.equal(relativeDay(4), '4d ago');
});

test('a recent workout becomes an activity-witness nudge, below a fresh asset', () => {
  const base = {
    hasIdq: true, daysSinceLastIdq: 5, recentAssetName: null, daysSinceRecentAsset: null,
    daysSinceActivity: 1, direction: null, delta: null, nextAssetName: null,
  };
  const n = topNudge({ ...base, recentWorkoutType: 'ride', daysSinceWorkout: 1 });
  assert.equal(n.kind, 'activity_witness');
  assert.match(n.text, /got out for a ride/);
  // a fresh asset completion still outranks it
  const withAsset = topNudge({ ...base, recentWorkoutType: 'ride', daysSinceWorkout: 1, recentAssetName: 'Window Exercise', daysSinceRecentAsset: 1 });
  assert.equal(withAsset.kind, 'asset_reflect');
  // an old workout (>3d) does not fire
  assert.ok(!computeNudges({ ...base, recentWorkoutType: 'ride', daysSinceWorkout: 9 }).some((x) => x.kind === 'activity_witness'));
});
