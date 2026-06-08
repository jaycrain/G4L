import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveSubscription } from '../lib/push/store.ts';
import { saveActivities, setConnection } from '../lib/activity/store.ts';
import { runScheduledNudges } from '../lib/push/cron.ts';
import type { PushSender } from '../lib/push/send.ts';

const okSender: PushSender = async () => ({ ok: true });

// A member with a baseline IDQ (so the top nudge isn't "do your IDQ").
async function member(db: Db, email: string): Promise<string> {
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun) values ('M', $1, 'cyclist') returning member_id`,
    [email],
  );
  const id = r.rows[0]!.member_id;
  await db.query(
    `insert into idq_retake (member_id, cycle_indicator, sequence_no, responses,
       physical_score, self_score, social_score, outlook_score, id_score_raw, id_score, direction)
     values ($1,1,0,'[]'::jsonb,15,15,15,15,60,60,'flat')`,
    [id],
  );
  return id;
}
const sub = (id: string) => ({ endpoint: `https://push.example/${id}`, keys: { p256dh: 'p', auth: 'a' } });
const recentRide = (id: string) => ({
  provider: 'strava',
  externalId: id,
  type: 'ride' as const,
  name: 'Ride',
  startedAt: new Date(Date.now() - 86400 * 1000).toISOString(),
  distanceM: 30000,
  movingTimeS: 3600,
});

async function activeMember(db: Db, email: string): Promise<string> {
  const m = await member(db, email);
  await saveSubscription(db, m, sub(email));
  await setConnection(db, m, 'strava', 'Strava');
  await saveActivities(db, m, [recentRide(`r-${email}`)]); // → activity_witness nudge
  return m;
}

test('pushes a real nudge to a subscribed member, then logs it', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await activeMember(db, 'a@x.com');

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
  await activeMember(db, 'b@x.com');
  assert.equal((await runScheduledNudges(db, { sender: okSender })).pushed, 1);
  const second = await runScheduledNudges(db, { sender: okSender }); // immediately again
  assert.equal(second.eligible, 0);
  assert.equal(second.pushed, 0);
});

test('the same message is never pushed twice in a row (repeat guard)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await activeMember(db, 'c@x.com');
  // cooldown 0 so eligibility is open; the repeat guard is what must stop the second send.
  assert.equal((await runScheduledNudges(db, { sender: okSender, cooldownHours: 0 })).pushed, 1);
  const second = await runScheduledNudges(db, { sender: okSender, cooldownHours: 0 });
  assert.equal(second.eligible, 1);
  assert.equal(second.pushed, 0);
  assert.equal(second.skipped, 1);
});

test('no subscription → nobody is processed', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await member(db, 'd@x.com'); // exists, IDQ done, but never subscribed
  assert.equal((await runScheduledNudges(db, { sender: okSender })).eligible, 0);
});
