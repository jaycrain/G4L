// Operator roster: every signed-up member with at-a-glance engagement metrics.
// A lightweight read for the Founder Agent console — shared with a trusted circle
// during the pre-launch window. No new infrastructure; pure reads over existing tables.

import type { Db } from '../db/schema.ts';
import { getEventsForMembers, deriveSessionTelemetry } from '../telemetry/store.ts';

export type RosterRow = {
  memberId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  namedDoor: string | null;
  isDemo: boolean; // seeded demo persona (reserved .test email) vs. a real signup
  joinedAt: string; // ISO
  lastSignInAt: string | null; // ISO — exact, but only refreshes on login
  lastActiveAt: string | null; // ISO — newest of any tracked action (incl. sign-in)
  idScore: number | null; // latest ID Score (0–100)
  idBaseline: number | null; // baseline ID Score (sequence 0)
  idDirection: string | null; // 'up' | 'down' | 'flat'
  // PROGRESS — the live curriculum/Session engine (lib/curriculum). The member's true progress
  // flows here now; the old asset-delivery engine (asset_completion) is no longer in the live UI.
  sessionsOpened: number; // distinct Sessions started (a Session opened = "asset viewed")
  sessionsClosed: number; // Sessions closed (a Session closed = "asset completed")
  badges: number; // passport badges earned
  facets: number; // reclaimed identities named at Session closes
  gates: number; // phase gates crossed (4Rs / checkpoint progress)
  // ACTIVITY — showing-up signals.
  beats: number; // Beats closed (the daily program work)
  dailyBeatDays: number; // distinct days a Daily Beat was surfaced
  workouts: number; // logged activities (Strava)
  checkinDays: number; // distinct days the member sent the agent a message
  // EXPERIENCE TELEMETRY — derived from member_event (only accrues from events going forward).
  engagedMinutes: number; // summed time-on-asset across closed Sessions
  stalledSessions: number; // Sessions opened but never closed (drop-off)
};

type RawRow = {
  member_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  named_door: string | null;
  joined_at: unknown;
  last_sign_in_at: unknown;
  last_msg_at: unknown;
  last_session_at: unknown;
  last_beat_at: unknown;
  last_daily_beat_at: unknown;
  last_workout_at: unknown;
  last_retake_at: unknown;
  sessions_opened: unknown;
  sessions_closed: unknown;
  badges: unknown;
  facets: unknown;
  gates: unknown;
  beats: unknown;
  daily_beat_days: unknown;
  workouts: unknown;
  checkin_days: unknown;
  id_score: unknown;
  id_direction: string | null;
  id_baseline: unknown;
};

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  const t = d.getTime();
  return Number.isNaN(t) ? null : d.toISOString();
};
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toNumOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Seeded demo personas use the reserved `.test` TLD (RFC 6761) — real members never will.
export function isDemoEmail(email: string): boolean {
  return /\.test$/i.test(email.trim());
}

// Newest of a set of ISO timestamps (nulls ignored). Returns null if all null.
export function newestIso(...isos: (string | null)[]): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const iso of isos) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > bestT) {
      bestT = t;
      best = iso;
    }
  }
  return best;
}

// "Activity" rollup = the showing-up signals a member generates between Sessions.
// Kept separate from Session progress (true program progress) so the meaningful number isn't buried.
export function activityCount(
  row: Pick<RosterRow, 'beats' | 'dailyBeatDays' | 'workouts' | 'checkinDays'>,
): number {
  return row.beats + row.dailyBeatDays + row.workouts + row.checkinDays;
}

export type RosterSummary = {
  total: number;
  joinedLast30: number;
  activeLast7: number;
  sessionsClosedTotal: number; // Sessions closed across the roster (true program progress)
  engagedMinutesTotal: number; // time-on-asset summed across the roster
};

export function summarizeRoster(rows: RosterRow[], nowMs: number): RosterSummary {
  const d30 = nowMs - 30 * 86_400_000;
  const d7 = nowMs - 7 * 86_400_000;
  let joinedLast30 = 0;
  let activeLast7 = 0;
  let sessionsClosedTotal = 0;
  let engagedMinutesTotal = 0;
  for (const r of rows) {
    if (new Date(r.joinedAt).getTime() >= d30) joinedLast30++;
    if (r.lastActiveAt && new Date(r.lastActiveAt).getTime() >= d7) activeLast7++;
    sessionsClosedTotal += r.sessionsClosed;
    engagedMinutesTotal += r.engagedMinutes;
  }
  return { total: rows.length, joinedLast30, activeLast7, sessionsClosedTotal, engagedMinutesTotal };
}

// Compact relative-time label for the operator table ("3d ago", "just now", "—").
export function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.round((nowMs - t) / 1000);
  if (sec < 0) return 'just now';
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

const ROSTER_SQL = `
  select
    p.member_id, p.display_name, p.email, p.avatar_url, p.named_door,
    p.created_at as joined_at,
    (select max(s.created_at)   from member_session s    where s.member_id  = p.member_id) as last_sign_in_at,
    (select max(am.created_at)  from agent_message am    where am.member_id = p.member_id) as last_msg_at,
    (select max(sp.updated_at)  from session_progress sp where sp.member_id = p.member_id) as last_session_at,
    (select max(bc.completed_at) from beat_completion bc where bc.member_id = p.member_id) as last_beat_at,
    (select max(dbl.created_at) from daily_beat_log dbl  where dbl.member_id = p.member_id) as last_daily_beat_at,
    (select max(ae.started_at)  from activity_event ae   where ae.member_id = p.member_id) as last_workout_at,
    (select max(r.taken_at)     from idq_retake r        where r.member_id  = p.member_id) as last_retake_at,
    (select count(*) from session_progress sp where sp.member_id = p.member_id) as sessions_opened,
    (select count(*) from session_progress sp where sp.member_id = p.member_id and sp.status = 'closed') as sessions_closed,
    (select count(*) from badge_earned be where be.member_id = p.member_id) as badges,
    (select count(*) from facet f         where f.member_id  = p.member_id) as facets,
    (select count(*) from phase_gate pg   where pg.member_id = p.member_id) as gates,
    (select count(*) from beat_completion bc where bc.member_id = p.member_id) as beats,
    (select count(distinct dbl.shown_on) from daily_beat_log dbl where dbl.member_id = p.member_id) as daily_beat_days,
    (select count(*) from activity_event ae where ae.member_id = p.member_id) as workouts,
    (select count(distinct date_trunc('day', am.created_at)) from agent_message am
       where am.member_id = p.member_id and am.role = 'member') as checkin_days,
    lr.id_score as id_score, lr.direction as id_direction,
    base.id_score as id_baseline
  from member_profile p
  left join lateral (
    select id_score, direction from idq_retake r
    where r.member_id = p.member_id
    order by cycle_indicator desc, sequence_no desc limit 1
  ) lr on true
  left join lateral (
    select id_score from idq_retake r
    where r.member_id = p.member_id and r.sequence_no = 0
    order by cycle_indicator asc limit 1
  ) base on true
  where p.active
`;

export async function getRoster(db: Db): Promise<RosterRow[]> {
  const { rows } = await db.query<RawRow>(ROSTER_SQL);
  // Experience telemetry, derived from the event log in one bulk read (roster is small pre-launch).
  const events = await getEventsForMembers(db, rows.map((r) => r.member_id));
  const mapped: RosterRow[] = rows.map((r) => {
    const lastSignInAt = toIso(r.last_sign_in_at);
    const sessionTele = deriveSessionTelemetry(events.get(r.member_id) ?? []);
    const engagedMinutes = Math.round(
      sessionTele.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / 60000,
    );
    const stalledSessions = sessionTele.filter((s) => !s.closed).length;
    return {
      memberId: r.member_id,
      displayName: r.display_name,
      email: r.email,
      avatarUrl: r.avatar_url,
      namedDoor: r.named_door,
      isDemo: isDemoEmail(r.email),
      joinedAt: toIso(r.joined_at) ?? new Date(0).toISOString(),
      lastSignInAt,
      lastActiveAt: newestIso(
        lastSignInAt,
        toIso(r.last_msg_at),
        toIso(r.last_session_at),
        toIso(r.last_beat_at),
        toIso(r.last_daily_beat_at),
        toIso(r.last_workout_at),
        toIso(r.last_retake_at),
      ),
      idScore: toNumOrNull(r.id_score),
      idBaseline: toNumOrNull(r.id_baseline),
      idDirection: r.id_direction,
      sessionsOpened: toNum(r.sessions_opened),
      sessionsClosed: toNum(r.sessions_closed),
      badges: toNum(r.badges),
      facets: toNum(r.facets),
      gates: toNum(r.gates),
      beats: toNum(r.beats),
      dailyBeatDays: toNum(r.daily_beat_days),
      workouts: toNum(r.workouts),
      checkinDays: toNum(r.checkin_days),
      engagedMinutes,
      stalledSessions,
    };
  });
  // Liveliest first; never-active members sink to the bottom.
  mapped.sort((a, b) => {
    const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : -Infinity;
    const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : -Infinity;
    if (tb !== ta) return tb - ta;
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  });
  return mapped;
}

// --- Per-member usage detail (the /admin/member drill-down) ---------------------------------
// The raw activity signals for one member, with per-Session state. Pairs with the curriculum
// view helpers (getForecast / getPassport / getFacets) for the progress side.

export type MemberSessionRow = {
  sessionId: string;
  status: string; // 'in_progress' | 'closed' | 'locked'
  currentStep: number;
  updatedAt: string | null;
  closedAt: string | null;
};

export type MemberUsage = {
  sessions: MemberSessionRow[];
  sessionsOpened: number;
  sessionsClosed: number;
  beats: number;
  dailyBeatDays: number;
  workouts: number;
  checkinDays: number;
  gates: number;
  lastBeatAt: string | null;
  lastDailyBeatAt: string | null;
  lastWorkoutAt: string | null;
  lastMessageAt: string | null;
  lastSessionAt: string | null;
};

const MEMBER_USAGE_SQL = `
  select
    (select count(*) from beat_completion bc where bc.member_id = $1) as beats,
    (select count(distinct dbl.shown_on) from daily_beat_log dbl where dbl.member_id = $1) as daily_beat_days,
    (select count(*) from activity_event ae where ae.member_id = $1) as workouts,
    (select count(*) from phase_gate pg where pg.member_id = $1) as gates,
    (select count(distinct date_trunc('day', am.created_at)) from agent_message am
       where am.member_id = $1 and am.role = 'member') as checkin_days,
    (select max(bc.completed_at) from beat_completion bc where bc.member_id = $1) as last_beat_at,
    (select max(dbl.created_at) from daily_beat_log dbl where dbl.member_id = $1) as last_daily_beat_at,
    (select max(ae.started_at) from activity_event ae where ae.member_id = $1) as last_workout_at,
    (select max(am.created_at) from agent_message am where am.member_id = $1) as last_message_at,
    (select max(sp.updated_at) from session_progress sp where sp.member_id = $1) as last_session_at
`;

export async function getMemberUsage(db: Db, memberId: string): Promise<MemberUsage> {
  const { rows: sess } = await db.query<{
    session_id: string;
    status: string;
    current_step: unknown;
    updated_at: unknown;
    closed_at: unknown;
  }>(
    `select session_id, status, current_step, updated_at, closed_at
       from session_progress where member_id = $1
       order by (status = 'closed') desc, updated_at desc`,
    [memberId],
  );
  const sessions: MemberSessionRow[] = sess.map((s) => ({
    sessionId: s.session_id,
    status: s.status,
    currentStep: toNum(s.current_step),
    updatedAt: toIso(s.updated_at),
    closedAt: toIso(s.closed_at),
  }));

  const { rows } = await db.query<Record<string, unknown>>(MEMBER_USAGE_SQL, [memberId]);
  const r = rows[0] ?? {};
  return {
    sessions,
    sessionsOpened: sessions.length,
    sessionsClosed: sessions.filter((s) => s.status === 'closed').length,
    beats: toNum(r.beats),
    dailyBeatDays: toNum(r.daily_beat_days),
    workouts: toNum(r.workouts),
    checkinDays: toNum(r.checkin_days),
    gates: toNum(r.gates),
    lastBeatAt: toIso(r.last_beat_at),
    lastDailyBeatAt: toIso(r.last_daily_beat_at),
    lastWorkoutAt: toIso(r.last_workout_at),
    lastMessageAt: toIso(r.last_message_at),
    lastSessionAt: toIso(r.last_session_at),
  };
}
