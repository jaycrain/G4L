import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  logEvent,
  getMemberEvents,
  deriveSessionTelemetry,
  deriveCheckpointTelemetry,
  deriveBeatActivity,
  deriveDailyBeatActivity,
  deriveIdqActivity,
  deriveSurfaceUsage,
  experienceSummary,
  getMemberExperience,
  type MemberEvent,
} from '../lib/telemetry/store.ts';

const NOW = Date.UTC(2026, 5, 16, 12, 0, 0);
const ev = (kind: string, opts: Partial<MemberEvent> & { minsAgo?: number } = {}): MemberEvent => ({
  kind: kind as MemberEvent['kind'],
  surface: opts.surface ?? null,
  ref: opts.ref ?? null,
  step: opts.step ?? null,
  meta: opts.meta ?? {},
  createdAt: new Date(NOW - (opts.minsAgo ?? 0) * 60000).toISOString(),
});

test('deriveSessionTelemetry: closed Session yields time-on-asset, opens, no drop-off', () => {
  // Opened 30m ago, stepped, opened again 20m ago (re-engagement), closed 10m ago.
  const events: MemberEvent[] = [
    ev('session_open', { ref: 'RCN-EXC', step: 1, minsAgo: 30 }),
    ev('session_step', { ref: 'RCN-EXC', step: 2, minsAgo: 28 }),
    ev('session_open', { ref: 'RCN-EXC', step: 2, minsAgo: 20 }),
    ev('session_step', { ref: 'RCN-EXC', step: 3, minsAgo: 18 }),
    ev('session_close', { ref: 'RCN-EXC', minsAgo: 10 }),
  ];
  const [t] = deriveSessionTelemetry(events);
  assert.equal(t!.sessionId, 'RCN-EXC');
  assert.equal(t!.opens, 2, 'two opens = re-engagement');
  assert.equal(t!.furthestStep, 3);
  assert.equal(t!.closed, true);
  assert.equal(t!.dropOffStep, null, 'no drop-off once closed');
  assert.equal(t!.durationMs, 20 * 60000, 'first open → close = 20 min');
});

test('deriveSessionTelemetry: open Session reports the drop-off step', () => {
  const events: MemberEvent[] = [
    ev('session_open', { ref: 'RWR-VIS', step: 1, minsAgo: 60 }),
    ev('session_step', { ref: 'RWR-VIS', step: 2, minsAgo: 58 }),
  ];
  const [t] = deriveSessionTelemetry(events);
  assert.equal(t!.closed, false);
  assert.equal(t!.dropOffStep, 2, 'furthest step reached, never closed = where they stalled');
  assert.equal(t!.durationMs, null, 'no duration without a close');
});

test('deriveCheckpointTelemetry: arrival → crossing yields time-at-the-gate', () => {
  const t = deriveCheckpointTelemetry([
    ev('checkpoint_open', { ref: 'RCN-CHK', minsAgo: 25 }),
    ev('checkpoint_open', { ref: 'RCN-CHK', minsAgo: 12 }), // came back to the gate
    ev('checkpoint_cross', { ref: 'RCN-CHK', minsAgo: 10 }),
  ]);
  assert.equal(t[0]!.checkpointId, 'RCN-CHK');
  assert.equal(t[0]!.opens, 2);
  assert.equal(t[0]!.crossed, true);
  assert.equal(t[0]!.timeToCrossMs, 15 * 60000, 'first arrival → crossing');
});

test('deriveCheckpointTelemetry: arrived but not crossed', () => {
  const t = deriveCheckpointTelemetry([ev('checkpoint_open', { ref: 'RWR-CHK', minsAgo: 5 })]);
  assert.equal(t[0]!.crossed, false);
  assert.equal(t[0]!.timeToCrossMs, null);
});

test('deriveBeatActivity counts closes and surfaces recent (newest first)', () => {
  const b = deriveBeatActivity([
    ev('beat_close', { ref: 'BT-1', meta: { response: 'closer' }, minsAgo: 30 }),
    ev('beat_close', { ref: 'BT-2', meta: { response: 'yes' }, minsAgo: 5 }),
    ev('page_view', { surface: 'dashboard', minsAgo: 4 }), // ignored
  ]);
  assert.equal(b.total, 2);
  assert.equal(b.recent[0]!.beatId, 'BT-2', 'newest first');
  assert.equal(b.recent[0]!.response, 'yes');
});

test('deriveDailyBeatActivity and deriveIdqActivity read their own events', () => {
  const d = deriveDailyBeatActivity([
    ev('daily_beat_view', { ref: 'RCN-EXC-01', minsAgo: 1440 }),
    ev('daily_beat_view', { ref: 'RCN-EXC-02', minsAgo: 10 }),
  ]);
  assert.equal(d.days, 2);
  assert.equal(d.recent[0]!.reflectionId, 'RCN-EXC-02');

  const i = deriveIdqActivity([
    ev('idq_complete', { step: 0, meta: { idScore: 60 }, minsAgo: 5000 }),
    ev('idq_complete', { step: 1, meta: { idScore: 71 }, minsAgo: 10 }),
  ]);
  assert.equal(i.count, 2);
  assert.equal(i.latestScore, 71, 'most recent retake score');
});

test('deriveSurfaceUsage counts page views per surface, most-used first', () => {
  const events: MemberEvent[] = [
    ev('page_view', { surface: 'dashboard', minsAgo: 50 }),
    ev('page_view', { surface: 'playbook', minsAgo: 40 }),
    ev('page_view', { surface: 'dashboard', minsAgo: 5 }),
    ev('session_open', { ref: 'X', minsAgo: 3 }), // not a page_view — ignored
  ];
  const usage = deriveSurfaceUsage(events);
  assert.equal(usage[0]!.surface, 'dashboard');
  assert.equal(usage[0]!.views, 2);
  assert.equal(usage[1]!.surface, 'playbook');
  assert.equal(usage[1]!.views, 1);
});

test('experienceSummary is governance-safe prose the agents can read', () => {
  const sessions = deriveSessionTelemetry([
    ev('session_open', { ref: 'RCN-EXC', step: 1, minsAgo: 30 }),
    ev('session_close', { ref: 'RCN-EXC', minsAgo: 20 }),
    ev('session_open', { ref: 'RWR-VIS', step: 1, minsAgo: 15 }),
    ev('session_open', { ref: 'RWR-VIS', step: 2, minsAgo: 10 }),
    ev('session_step', { ref: 'RWR-VIS', step: 2, minsAgo: 9 }),
  ]);
  const surfaces = deriveSurfaceUsage([ev('page_view', { surface: 'playbook' })]);
  const title = (id: string) => (id === 'RCN-EXC' ? 'Identity Excavation' : 'Visualization');
  const s = experienceSummary(sessions, surfaces, title);
  assert.match(s, /Closed Identity Excavation/);
  assert.match(s, /Started Visualization/);
  assert.match(s, /opened 2×/);
  assert.match(s, /stalled at step 2/);
  assert.match(s, /Most-used surfaces: playbook/);
});

test('logEvent + getMemberExperience round-trip through the DB (RLS-bypassing owner)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Tele Tester','t@x.test') returning member_id`,
    )
  ).rows[0]!.member_id;

  await logEvent(db, memberId, 'session_open', { surface: 'session', ref: 'RCN-EXC', step: 1 });
  await logEvent(db, memberId, 'session_step', { surface: 'session', ref: 'RCN-EXC', step: 2 });
  await logEvent(db, memberId, 'session_close', { surface: 'session', ref: 'RCN-EXC' });
  await logEvent(db, memberId, 'page_view', { surface: 'dashboard' });

  const events = await getMemberEvents(db, memberId);
  assert.equal(events.length, 4);

  const exp = await getMemberExperience(db, memberId, (id) => (id === 'RCN-EXC' ? 'Identity Excavation' : id));
  assert.equal(exp.sessions.length, 1);
  assert.equal(exp.sessions[0]!.closed, true);
  assert.equal(exp.sessions[0]!.furthestStep, 2);
  assert.equal(exp.surfaces[0]!.surface, 'dashboard');
  assert.match(exp.summary, /Closed Identity Excavation/);
});

test('logEvent never throws on a bad write (telemetry must not break the app)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  // No such member → FK violation. logEvent swallows it rather than bubbling to the caller.
  await assert.doesNotReject(
    logEvent(db, '00000000-0000-0000-0000-000000000000', 'page_view', { surface: 'dashboard' }),
  );
});
