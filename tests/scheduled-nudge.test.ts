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

// ---------------------------------------------------------------------------
// SEC-06 — the scheduled push must honour the member's OWN dial. It never read outreach_pref at all: it had its
// own private restraint rules, which meant a member who set "only when I ask" was still pushed, and a push could
// land at 3am inside their own stated quiet hours. We ask them to set a rhythm and then ignored the answer.
// `now` is injected so quiet hours are testable without depending on when the suite runs.
// ---------------------------------------------------------------------------
import { setPref } from '../lib/outreach/store.ts';

// Fix the clock at 03:00 UTC (inside the default 21→7 quiet window) or 12:00 UTC (outside it).
const AT_3AM = new Date(Date.UTC(2026, 6, 30, 3, 0, 0));
const AT_NOON = new Date(Date.UTC(2026, 6, 30, 12, 0, 0));

test('SEC-06 · "only when I ask" is honoured — no proactive push, ever', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await driftedMember(db, 'onask@x.com');
  await setPref(db, m, { rhythm: 'on_ask' });

  const res = await runScheduledNudges(db, { sender: okSender, now: AT_NOON });
  assert.equal(res.pushed, 0, 'they told us not to reach out');
  assert.equal(res.held, 1, 'and it is recorded as HELD, not silently skipped');
  const log = await db.query<{ n: string }>(`select count(*)::text n from nudge_log where member_id=$1`, [m]);
  assert.equal(Number(log.rows[0]!.n), 0);
});

test('SEC-06 · quiet hours are honoured — nothing lands at 3am', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await driftedMember(db, 'quiet@x.com');

  assert.equal((await runScheduledNudges(db, { sender: okSender, now: AT_3AM })).pushed, 0, 'inside quiet hours');
});

test('SEC-06 · the same member IS reached at a reasonable hour (the gate is not a blanket off-switch)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await driftedMember(db, 'awake@x.com');

  const res = await runScheduledNudges(db, { sender: okSender, now: AT_NOON });
  assert.equal(res.pushed, 1, 'a drifted member on the default rhythm still hears from us');
});

test('SEC-06 · an explicit channel opt-out is absolute', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await driftedMember(db, 'nopush@x.com');
  await setPref(db, m, { channels: { in_app: true, push: false } });

  const res = await runScheduledNudges(db, { sender: okSender, now: AT_NOON });
  assert.equal(res.pushed, 0);
  assert.equal(res.held, 1);
});

test('SEC-06 · quiet hours follow the MEMBER’s timezone, not the server’s', async () => {
  // 12:00 UTC is the middle of the day in London and 04:00 in Los Angeles. The member in LA must be left alone.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const la = await driftedMember(db, 'la@x.com');
  await setPref(db, la, { timezone: 'America/Los_Angeles' });

  assert.equal((await runScheduledNudges(db, { sender: okSender, now: AT_NOON })).pushed, 0, '04:00 for them');
});
