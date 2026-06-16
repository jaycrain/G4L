import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  getRoster,
  summarizeRoster,
  relativeTime,
  activityCount,
  newestIso,
  isDemoEmail,
  type RosterRow,
} from '../lib/admin/roster.ts';

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0); // 2026-06-09T12:00:00Z
const daysAgoISO = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

async function seed(): Promise<{ db: Db; alice: string; demo: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);

  const a = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Alice Active','alice@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  const d = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Demo Persona','demo-x@grintaforlife.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  // An inactive member must never appear.
  await db.query(`insert into member_profile (display_name, email, active) values ('Gone Away','gone@x.com', false)`);

  // Alice is a real signup: credential + sign-in 2 days ago.
  await db.query(`insert into member_credential (member_id, email, password_hash) values ($1,'alice@x.com','x')`, [a]);
  await db.query(`insert into member_session (token, member_id, created_at, expires_at) values ('tok-a',$1,$2,$3)`, [
    a,
    daysAgoISO(2),
    daysAgoISO(-30),
  ]);
  // Messages on two distinct days (one is the most recent activity, 1h ago).
  await db.query(`insert into agent_message (member_id, role, text, created_at) values ($1,'member','hi',$2)`, [a, daysAgoISO(3)]);
  await db.query(`insert into agent_message (member_id, role, text, created_at) values ($1,'member','again',$2)`, [
    a,
    new Date(NOW - 3_600_000).toISOString(),
  ]);
  await db.query(`insert into agent_message (member_id, role, text, created_at) values ($1,'agent','reply',$2)`, [a, daysAgoISO(3)]);
  await db.query(
    `insert into activity_event (member_id, external_id, activity_type, started_at) values ($1,'s1','run',$2)`,
    [a, daysAgoISO(5)],
  );
  // PROGRESS — the live curriculum engine: one Session closed, one still in progress.
  await db.query(
    `insert into session_progress (member_id, session_id, current_step, status, updated_at, closed_at)
     values ($1,'RCN-EXC',5,'closed',$2,$2)`,
    [a, daysAgoISO(6)],
  );
  await db.query(
    `insert into session_progress (member_id, session_id, current_step, status, updated_at)
     values ($1,'RCN-VAL',2,'in_progress',$2)`,
    [a, daysAgoISO(4)],
  );
  await db.query(`insert into badge_earned (member_id, badge_id, earned_at) values ($1,'onboarding',$2)`, [a, daysAgoISO(6)]);
  await db.query(`insert into facet (member_id, text, sort_order) values ($1,'the Athlete',0)`, [a]);
  await db.query(`insert into phase_gate (member_id, gate, set_at) values ($1,'reconnect_checkpoint_passed',$2)`, [a, daysAgoISO(6)]);
  // ACTIVITY — Beats closed + Daily Beat days.
  await db.query(
    `insert into beat_completion (member_id, beat_id, close_type, completed_at) values ($1,'BT-1','reflect',$2)`,
    [a, daysAgoISO(4)],
  );
  await db.query(`insert into daily_beat_log (member_id, shown_on, reflection_id, created_at) values ($1,$2,'RCN-EXC-01',$3)`, [
    a,
    daysAgoISO(5).slice(0, 10),
    daysAgoISO(5),
  ]);
  await db.query(`insert into daily_beat_log (member_id, shown_on, reflection_id, created_at) values ($1,$2,'RCN-EXC-02',$3)`, [
    a,
    daysAgoISO(4).slice(0, 10),
    daysAgoISO(4),
  ]);
  // Baseline + a later retake (latest ID Score = 71, up from 60). Pin taken_at in the
  // past — the column defaults to now(), which would otherwise win "last active".
  await db.query(
    `insert into idq_retake (member_id, cycle_indicator, sequence_no, taken_at, responses, physical_score, self_score, social_score, outlook_score, id_score_raw, id_score, direction)
     values ($1,1,0,$2,'{}'::jsonb,15,15,15,15,60,60,'flat')`,
    [a, daysAgoISO(10)],
  );
  await db.query(
    `insert into idq_retake (member_id, cycle_indicator, sequence_no, taken_at, responses, physical_score, self_score, social_score, outlook_score, id_score_raw, id_score, direction)
     values ($1,1,1,$2,'{}'::jsonb,18,18,18,18,72,71,'up')`,
    [a, daysAgoISO(6)],
  );

  return { db, alice: a, demo: d };
}

test('getRoster lists every active member, liveliest first, excluding inactive', async () => {
  const { db } = await seed();
  const rows = await getRoster(db);
  assert.equal(rows.length, 2, 'inactive member excluded');
  assert.equal(rows[0]!.displayName, 'Alice Active', 'most-recently-active sorts first');
  assert.equal(rows[1]!.displayName, 'Demo Persona');
});

test('getRoster distinguishes real accounts from demo personas', async () => {
  const { db } = await seed();
  const rows = await getRoster(db);
  const alice = rows.find((r) => r.email === 'alice@x.com')!;
  const demo = rows.find((r) => r.email === 'demo-x@grintaforlife.test')!;
  assert.equal(alice.isDemo, false);
  assert.equal(demo.isDemo, true);
});

test('getRoster aggregates live progress, activity, and ID Score correctly', async () => {
  const { db } = await seed();
  const alice = (await getRoster(db)).find((r) => r.email === 'alice@x.com')!;
  // Progress — the live curriculum engine.
  assert.equal(alice.sessionsOpened, 2, 'two Sessions touched (one closed, one in progress)');
  assert.equal(alice.sessionsClosed, 1, 'one Session closed = one completed asset');
  assert.equal(alice.badges, 1);
  assert.equal(alice.facets, 1);
  assert.equal(alice.gates, 1);
  // Activity — showing-up signals.
  assert.equal(alice.beats, 1);
  assert.equal(alice.dailyBeatDays, 2, 'two distinct Daily Beat days');
  assert.equal(alice.workouts, 1);
  assert.equal(alice.checkinDays, 2, 'two distinct days with member messages');
  assert.equal(activityCount(alice), 6, '1 beat + 2 daily-beat days + 1 workout + 2 check-in days');
  assert.equal(alice.idScore, 71);
  assert.equal(alice.idBaseline, 60);
  assert.equal(alice.idDirection, 'up');
});

test('getRoster picks newest action (incl. sign-in) as last active; sign-in tracked separately', async () => {
  const { db } = await seed();
  const alice = (await getRoster(db)).find((r) => r.email === 'alice@x.com')!;
  // Most recent action is the 1h-ago message, not the 2-day-ago sign-in.
  assert.equal(relativeTime(alice.lastActiveAt, NOW), '1h ago');
  assert.equal(relativeTime(alice.lastSignInAt, NOW), '2d ago');
});

test('demo member with no activity has null timestamps and zero counts', async () => {
  const { db } = await seed();
  const demo = (await getRoster(db)).find((r) => r.email === 'demo-x@grintaforlife.test')!;
  assert.equal(demo.lastActiveAt, null);
  assert.equal(demo.lastSignInAt, null);
  assert.equal(demo.idScore, null);
  assert.equal(activityCount(demo), 0);
});

test('summarizeRoster counts totals, recent joins, 7-day actives, and Sessions closed', () => {
  const rows: RosterRow[] = [
    { joinedAt: daysAgoISO(2), lastActiveAt: daysAgoISO(1), sessionsClosed: 3 } as RosterRow,
    { joinedAt: daysAgoISO(40), lastActiveAt: daysAgoISO(20), sessionsClosed: 1 } as RosterRow,
    { joinedAt: daysAgoISO(5), lastActiveAt: null, sessionsClosed: 0 } as RosterRow,
  ];
  const s = summarizeRoster(rows, NOW);
  assert.equal(s.total, 3);
  assert.equal(s.joinedLast30, 2, 'two joined within 30 days');
  assert.equal(s.activeLast7, 1, 'only one active within 7 days');
  assert.equal(s.sessionsClosedTotal, 4);
});

test('relativeTime renders compact buckets and handles null/future', () => {
  assert.equal(relativeTime(null, NOW), '—');
  assert.equal(relativeTime(new Date(NOW + 5000).toISOString(), NOW), 'just now');
  assert.equal(relativeTime(new Date(NOW - 30_000).toISOString(), NOW), 'just now');
  assert.equal(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW), '5m ago');
  assert.equal(relativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW), '3h ago');
  assert.equal(relativeTime(daysAgoISO(4), NOW), '4d ago');
  assert.equal(relativeTime(daysAgoISO(16), NOW), '2w ago');
  assert.equal(relativeTime(daysAgoISO(60), NOW), '2mo ago');
});

test('newestIso ignores nulls and returns the latest', () => {
  assert.equal(newestIso(null, null), null);
  assert.equal(newestIso(daysAgoISO(5), null, daysAgoISO(1), daysAgoISO(9)), daysAgoISO(1));
});

test('isDemoEmail flags reserved .test addresses only', () => {
  assert.equal(isDemoEmail('demo-tom@grintaforlife.test'), true);
  assert.equal(isDemoEmail('demo-maria@grintaforlife.TEST'), true);
  assert.equal(isDemoEmail('jay@adjacentlabmedia.com'), false);
  assert.equal(isDemoEmail('jennifer@jckpublishing.com'), false);
  assert.equal(isDemoEmail('someone@test.com'), false); // .test must be the TLD
});
