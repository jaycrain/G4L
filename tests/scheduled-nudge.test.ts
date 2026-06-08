import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveSubscription } from '../lib/push/store.ts';
import { saveActivities, setConnection } from '../lib/activity/store.ts';
import { runScheduledNudges } from '../lib/push/cron.ts';
import type { PushSender } from '../lib/push/send.ts';

const okSender: PushSender = async () => ({ ok: true });

// A member whose baseline IDQ is backdated 5 days, so they don't read as "recently active"
// just from signing up — activity in these tests is controlled by the seeded rides.
async function member(db: Db, email: string): Promise<string> {
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun) values ('M', $1, 'cyclist') returning member_id`,
    [email],
  );
  const id = r.rows[0]!.member_id;
  await db.query(
    `insert into idq_retake (member_id, cycle_indicator, sequence_no, responses,
       physical_score, self_score, social_score, outlook_score, id_score_raw, id_score, direction, taken_at)
     values ($1,1,0,'[]'::jsonb,15,15,15,15,60,60,'flat', now() - interval '5 days')`,
    [id],
  );
  return id;
}
const sub = (id: string) => ({ endpoint: `https://push.example/${id}`, keys: { p256dh: 'p', auth: 'a' } });
const ride = (id: string, daysAgo: number) => ({
  provider: 'strava',
  externalId: id,
  type: 'ride' as const,
  name: 'Ride',
  startedAt: new Date(Date.now() - daysAgo * 86400 * 1000).toISOString(),
  distanceM: 30000,
  movingTimeS: 3600,
});

// "Drifted" member: subscribed, last activity 2 days ago — eligible, and still inside the
// 3-day activity-witness window so the nudge is the ride witness.
async function driftedMember(db: Db, email: string): Promise<string> {
  const m = await member(db, email);
  await saveSubscription(db, m, sub(email));
  await setConnection(db, m, 'strava', 'Strava');
  await saveActivities(db, m, [ride(`r-${email}`, 2)]);
  return m;
}

test('pushes a real nudge to a drifted member, then logs it', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await driftedMember(db, 'a@x.com');

  const res = await runScheduledNudges(db, { sender: okSender });
  assert.equal(res.eligible, 1);
  assert.equal(res.pushed, 1);
  const log = await db.query<{ kind: string }>(`select kind from nudge_log where member_id=$1`, [m]);
  assert.equal(log.rows.length, 1);
  assert.equal(log.rows[0]!.kind, 'activity_witness');
});

test('cooldown: a member pushed recently is not eligible again', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await driftedMember(db, 'b@x.com');
  assert.equal((await runScheduledNudges(db, { sender: okSender })).pushed, 1);
  const second = await runScheduledNudges(db, { sender: okSender });
  assert.equal(second.eligible, 0);
  assert.equal(second.pushed, 0);
});

test('the same message is never pushed twice in a row (repeat guard)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await driftedMember(db, 'c@x.com');
  assert.equal((await runScheduledNudges(db, { sender: okSender, cooldownHours: 0 })).pushed, 1);
  const second = await runScheduledNudges(db, { sender: okSender, cooldownHours: 0 });
  assert.equal(second.eligible, 1);
  assert.equal(second.pushed, 0);
  assert.equal(second.skipped, 1);
});

test('a recently-active member is skipped — no push that just repeats their dashboard', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, 'e@x.com');
  await saveSubscription(db, m, sub('e@x.com'));
  await setConnection(db, m, 'strava', 'Strava');
  await saveActivities(db, m, [ride('r-e', 0.1)]); // active ~2 hours ago
  const res = await runScheduledNudges(db, { sender: okSender });
  assert.equal(res.eligible, 0); // in the app right now → not pushed
  assert.equal(res.pushed, 0);
});

test('no subscription → nobody is processed', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await member(db, 'd@x.com');
  assert.equal((await runScheduledNudges(db, { sender: okSender })).eligible, 0);
});
