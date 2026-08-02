import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cohortView, rosterAttention, STALLED_AFTER_HOURS, QUIET_AFTER_DAYS } from '../lib/admin/console.ts';
import type { RosterRow, RosterSummary } from '../lib/admin/roster.ts';

// The console answers ONE question — "who needs me this morning?" — so these tests pin the judgement calls,
// not the arithmetic. Thresholds and denominators are what regress silently and mislead an operator.

const NOW = Date.parse('2026-08-01T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000, DAY = 24 * HOUR;

function member(over: Partial<RosterRow> = {}): RosterRow {
  return {
    memberId: over.memberId ?? 'm1', displayName: 'Donna Crain', email: 'd@x.com', avatarUrl: null,
    namedDoor: null, isDemo: false, joinedAt: ago(30 * DAY), lastSignInAt: ago(HOUR), lastActiveAt: ago(HOUR),
    idScore: 55, idBaseline: 50, idDirection: 'up', sessionsOpened: 2, sessionsClosed: 2,
    badges: 4, facets: 1, phase: 'Rewire', checkinDays: 3, engagedMinutes: null, hasSessionTelemetry: true,
    stalledSessions: 0, lastMessageAt: null, ...over,
  } as RosterRow;
}
const summary: RosterSummary = {
  total: 0, joinedLast30: 0, activeLast7: 3, sessionsClosedTotal: 12,
  engagedMinutesTotal: 0, membersMissingTelemetry: 0,
} as RosterSummary;

test('a demo persona never inflates the cohort — it is not a member', () => {
  const v = cohortView([member(), member({ memberId: 'demo', isDemo: true, idScore: 99 })], summary, NOW);
  assert.equal(v.members, 1, 'the seeded .test account is excluded from the count');
  assert.equal(v.avgIdScore, 55, 'and from the average — a 99 would have skewed the whole cohort read');
});

test('members and active-7d are counted from the SAME population', () => {
  // Caught by looking at the rendered page: it showed "0 members · 2 active" because `members` filtered demo
  // personas and `activeLast7` came from the roster summary, which does not. Two numbers on one card must
  // never be built from different populations — the card contradicts itself and neither can be trusted.
  const rows = [member({ memberId: 'demo1', isDemo: true }), member({ memberId: 'demo2', isDemo: true })];
  const v = cohortView(rows, { ...summary, activeLast7: 2 }, NOW);
  assert.equal(v.members, 0);
  assert.equal(v.activeLast7, 0, 'no real members means nobody active — not "2"');
});

test('active-7d counts only members active INSIDE the window', () => {
  const v = cohortView(
    [member({ memberId: 'a', lastActiveAt: ago(2 * DAY) }), member({ memberId: 'b', lastActiveAt: ago(20 * DAY) })],
    summary, NOW,
  );
  assert.equal(v.members, 2);
  assert.equal(v.activeLast7, 1);
});

test('an average over nobody is NOTHING, not zero', () => {
  // "0" reads as "the cohort is failing". The honest answer to "what is the average of no scores" is none.
  const v = cohortView([member({ idScore: null })], summary, NOW);
  assert.equal(v.avgIdScore, null);
  assert.equal(v.scoredMembers, 0, 'and the denominator is stated, so the number can be trusted');
});

test('the average says how many it is built from', () => {
  const v = cohortView([member({ idScore: 80 }), member({ memberId: 'b', idScore: 40 }), member({ memberId: 'c', idScore: null })], summary, NOW);
  assert.equal(v.avgIdScore, 60);
  assert.equal(v.scoredMembers, 2, '2 of 3 — an operator must be able to see the average is partial');
});

test('phase distribution counts real members by where they actually are', () => {
  const v = cohortView([member({ phase: 'Rewire' }), member({ memberId: 'b', phase: 'Rewire' }), member({ memberId: 'c', phase: 'Reclaim' })], summary, NOW);
  assert.deepEqual(v.byPhase, [
    { phase: 'Reconnect', count: 0 }, { phase: 'Rewire', count: 2 },
    { phase: 'Rebuild', count: 0 }, { phase: 'Reclaim', count: 1 },
  ]);
});

test('STALLED means mid-Session and paused — not merely mid-Session', () => {
  // Someone two hours into a hard beat looks identical to someone who walked away. Only time separates them,
  // so the threshold IS the definition. Flagging the first would train the operator to ignore the queue.
  const busy = rosterAttention([member({ sessionsOpened: 3, sessionsClosed: 2, lastActiveAt: ago(2 * HOUR) })], NOW);
  assert.equal(busy.find((a) => a.kind === 'stalled')!.count, 0, 'still working — not stalled');

  const paused = rosterAttention([member({ sessionsOpened: 3, sessionsClosed: 2, lastActiveAt: ago(STALLED_AFTER_HOURS * HOUR + 1) })], NOW);
  assert.equal(paused.find((a) => a.kind === 'stalled')!.count, 1);
  assert.match(paused.find((a) => a.kind === 'stalled')!.label, /Donna Crain/, 'names the person when it is one person');
});

test('a member with nothing open is never "stalled", however long they have been away', () => {
  const a = rosterAttention([member({ sessionsOpened: 2, sessionsClosed: 2, lastActiveAt: ago(30 * DAY) })], NOW);
  assert.equal(a.find((x) => x.kind === 'stalled')!.count, 0, 'no open Session — that is quiet, not stalled');
  assert.equal(a.find((x) => x.kind === 'quiet')!.count, 1);
});

test('STALLED and GONE QUIET are different signals and call for different messages', () => {
  // One is about a piece of work, the other about a person. Collapsing them would make the queue lie about
  // what kind of help is needed.
  const rows = [
    member({ memberId: 'stalled', displayName: 'Mid Work', sessionsOpened: 2, sessionsClosed: 1, lastActiveAt: ago(2 * DAY) }),
    member({ memberId: 'quiet', displayName: 'Long Gone', sessionsOpened: 1, sessionsClosed: 1, lastActiveAt: ago(9 * DAY) }),
  ];
  const a = rosterAttention(rows, NOW);
  // Two different people, two different problems, two different messages. 2 days idle with work open is
  // STALLED; 9 days idle with nothing open is QUIET. Neither shows up in the other's bucket.
  assert.equal(a.find((x) => x.kind === 'stalled')!.count, 1);
  assert.equal(a.find((x) => x.kind === 'quiet')!.count, 1);
  assert.match(a.find((x) => x.kind === 'stalled')!.label, /Mid Work/);
  assert.match(a.find((x) => x.kind === 'quiet')!.label, /Long Gone/);
});

test('a member who has NEVER been active is not reported as having drifted', () => {
  // Never-started and stopped-coming are different problems. Calling the first "gone quiet" would send a
  // come-back-to-us note to somebody who never arrived.
  const a = rosterAttention([member({ lastActiveAt: null })], NOW);
  assert.equal(a.find((x) => x.kind === 'quiet')!.count, 0);
});

test('an empty cohort reads as calm, not as alarming zeros', () => {
  const a = rosterAttention([], NOW);
  assert.equal(a.find((x) => x.kind === 'stalled')!.label, 'nobody mid-Session');
  assert.equal(a.find((x) => x.kind === 'quiet')!.label, 'nobody has drifted');
});

test('QUIET_AFTER_DAYS is 5 — the threshold Jay reads the cohort against', () => {
  assert.equal(QUIET_AFTER_DAYS, 5);
  assert.equal(STALLED_AFTER_HOURS, 24);
});

// ── THE ACTIVITY FEED ────────────────────────────────────────────────────────────────────────────────────
// This needs a real database because the bug it protects against was a WRONG COLUMN NAME, and no amount of
// pure-function testing can catch that. The first cut selected `e.payload` — member_event has no such column
// (`ref` is top-level) — so every call threw, the catch turned it into `[]`, and the panel rendered "nothing
// has happened yet" on a cohort that had been busy. A silent empty is the most dangerous result a feed can
// return, because it is indistinguishable from the truth.
//
// So this test asserts the feed contains ROWS. "It didn't throw" is not the property that matters.

test('activityFeed returns real rows — a wrong column must fail loudly, not render as a quiet cohort', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { applySchema } = await import('../lib/db/schema.ts');
  const { activityFeed } = await import('../lib/admin/console.ts');
  const db = new PGlite() as unknown as import('../lib/db/schema.ts').Db;
  await applySchema(db);

  const id = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Donna Crain','donna@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  const demo = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Demo','demo@grintaforlife.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  await db.query(`insert into member_event (member_id, kind, ref) values ($1,'session_close','RCN-EXC')`, [id]);
  await db.query(`insert into member_event (member_id, kind) values ($1,'idq_complete')`, [id]);
  await db.query(`insert into member_event (member_id, kind, ref) values ($1,'page_view','dashboard')`, [id]);
  await db.query(`insert into member_event (member_id, kind, ref) values ($1,'session_close','RCN-VAL')`, [demo]);

  const feed = await activityFeed(db);
  assert.ok(feed.length > 0, 'the feed came back empty — the read is broken, not the cohort');
  // THREE, not two: the feed became a UNION when Jay asked for new members and Grinta movement alongside the
  // member_event kinds (2026-08-01). Donna's own SIGNUP is now a row, which is the point — a join was the one
  // thing the feed could never show. The exclusions still hold and are what this test is really guarding.
  assert.equal(feed.length, 3, 'session + IDQ + her signup; a page_view is not news and a demo is not a member');
  assert.ok(feed.some((f) => f.text === 'Donna Crain closed RCN-EXC'), 'the ref must reach the label');
  assert.ok(feed.some((f) => f.text === 'Donna Crain completed the IDQ'));
  assert.ok(feed.some((f) => f.text === 'Donna Crain joined'), 'and the signup the union added');
  assert.equal(feed[0]!.initials, 'DC');
});
