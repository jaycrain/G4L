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
  badges: number; // passport badges earned (of BADGE_TOTAL)
  facets: number; // reclaimed identities named at Session closes
  // WHERE THEY ARE — the phase NAME, not a count. "gates: 2" told an operator nothing; the question this
  // panel answers is "who needs me", and the useful form of that is "she's in Rewire" (Jay, 2026-07-31).
  phase: string; // Reconnect | Rewire | Rebuild | Reclaim — derived from the crossed checkpoint gates
  // ACTIVITY — showing-up signals.
  // RETIRED 2026-07-31 (Jay: "there's no longer such a thing as beat"): `beats`, `dailyBeatDays` and `workouts`
  // are gone. beats counted beat_completion UNFILTERED, so it could only ever contain onboarding artifacts and
  // self-marked markers — the two row types the member's own Past Beats view hides — because no member on
  // production can close a Beat (the v3.0 redesign removed the surface). dailyBeatDays counted days WE surfaced
  // a panel that no longer renders, so it measured our behaviour and froze at the v3.0 flip. workouts reads
  // activity_event, which is structurally 0 while Strava is unset in production. Three columns, none of which
  // could ever be true. Bring `workouts` back the day Strava ships.
  reclaimedGoals: number; // Reclaim List items the member has marked back — the self-marked history, kept on purpose
  checkinDays: number; // distinct days the member sent the agent a message
  // EXPERIENCE TELEMETRY.
  // DROP-OFF now comes from session_progress (DURABLE rows), not the event log. Event-derived, it counted "opened
  // but no close EVENT" as a drop-off — so every missing session_close manufactured a FAKE drop-off, and the column
  // measured our instrumentation gaps rather than member behaviour (Jay 2026-07-29: two accounts with 9 closed
  // Sessions each reported 0 engagement / 0 drop-off).
  stalledSessions: number; // Sessions opened but never closed — from session_progress, always correct
  // TIME ON TASK can only be event-derived (session_progress carries no duration), so it stays that way — but it is
  // NULL, never 0, when there's no event coverage for a member who has demonstrably done Sessions. A false zero
  // reads as "this member did nothing"; an honest "—" reads as "we don't have this yet".
  engagedMinutes: number | null; // summed time-on-asset; null = no telemetry coverage for this member
  hasSessionTelemetry: boolean; // did the event log carry ANY session open/close for them?
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
  last_retake_at: unknown;
  sessions_opened: unknown;
  sessions_closed: unknown;
  badges: unknown;
  g_reconnect: unknown;
  g_rewire: unknown;
  g_rebuild: unknown;
  reclaimed_goals: unknown;
  facets: unknown;

  daily_beat_days: unknown;
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


/** The 16 milestone badges a member can earn — the denominator the MEMBER sees ("0 of 16 earned"), so the
 *  operator panel shows the same fraction rather than a bare count that means nothing on its own. */
export const BADGE_TOTAL = 16;

/** Which of the 4Rs the member is in now, from the crossed checkpoint gates. Pure — mirrors the member-facing
 *  rule in lib/curriculum/view.ts (activePhaseIndex) so the panel and the member can never disagree. */
export function phaseName(reconnectPassed: boolean, rewirePassed: boolean, rebuildPassed: boolean): string {
  if (rebuildPassed) return 'Reclaim';
  if (rewirePassed) return 'Rebuild';
  if (reconnectPassed) return 'Rewire';
  return 'Reconnect';
}

// "Activity" rollup = the showing-up signals a member generates between Sessions.
// Kept separate from Session progress (true program progress) so the meaningful number isn't buried.
// 2026-07-31: beats/dailyBeatDays/workouts dropped from the sum — each was structurally incapable of being
// non-zero on production (see the RosterRow notes), so including them only diluted the one real signal.
export function activityCount(row: Pick<RosterRow, 'checkinDays' | 'reclaimedGoals'>): number {
  return row.checkinDays + row.reclaimedGoals;
}

export type RosterSummary = {
  total: number;
  joinedLast30: number;
  activeLast7: number;
  sessionsClosedTotal: number; // Sessions closed across the roster (true program progress)
  engagedMinutesTotal: number; // time-on-asset summed across members WHO HAVE coverage
  membersMissingTelemetry: number; // members with closed Sessions but no session events — the total understates by these
};

export function summarizeRoster(rows: RosterRow[], nowMs: number): RosterSummary {
  const d30 = nowMs - 30 * 86_400_000;
  const d7 = nowMs - 7 * 86_400_000;
  let joinedLast30 = 0;
  let activeLast7 = 0;
  let sessionsClosedTotal = 0;
  let engagedMinutesTotal = 0;
  let membersMissingTelemetry = 0;
  for (const r of rows) {
    if (new Date(r.joinedAt).getTime() >= d30) joinedLast30++;
    if (r.lastActiveAt && new Date(r.lastActiveAt).getTime() >= d7) activeLast7++;
    sessionsClosedTotal += r.sessionsClosed;
    if (r.engagedMinutes != null) engagedMinutesTotal += r.engagedMinutes;
    else if (r.sessionsClosed > 0) membersMissingTelemetry++;
  }
  return { total: rows.length, joinedLast30, activeLast7, sessionsClosedTotal, engagedMinutesTotal, membersMissingTelemetry };
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
    (select max(r.taken_at)     from idq_retake r        where r.member_id  = p.member_id) as last_retake_at,
    (select count(*) from session_progress sp where sp.member_id = p.member_id) as sessions_opened,
    (select count(*) from session_progress sp where sp.member_id = p.member_id and sp.status = 'closed') as sessions_closed,
    (select count(*) from badge_earned be where be.member_id = p.member_id) as badges,
    (select count(*) from facet f         where f.member_id  = p.member_id) as facets,
    -- The crossed checkpoint gates, resolved to a phase NAME below (mirrors curriculum/view.ts activePhaseIndex).
    (select coalesce(bool_or(pg.gate = 'reconnect_checkpoint_passed'), false) from phase_gate pg where pg.member_id = p.member_id) as g_reconnect,
    (select coalesce(bool_or(pg.gate = 'rewire_checkpoint_passed'),    false) from phase_gate pg where pg.member_id = p.member_id) as g_rewire,
    (select coalesce(bool_or(pg.gate = 'rebuild_checkpoint_passed'),   false) from phase_gate pg where pg.member_id = p.member_id) as g_rebuild,
    (select count(*) from reclaim_item ri
      where ri.member_id = p.member_id and ri.state = 'reclaimed' and ri.removed_at is null) as reclaimed_goals,
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
    // DROP-OFF from the DURABLE rows: opened minus closed. Clamped at 0 — a member can close a Session that was
    // opened before session_progress tracked it, which would otherwise render a negative drop-off.
    const stalledSessions = Math.max(0, Number(r.sessions_opened ?? 0) - Number(r.sessions_closed ?? 0));
    // TIME ON TASK stays event-derived (only the event log carries duration), but report NO COVERAGE as null.
    // `hasSessionTelemetry` is the honest test: did the log carry any session open/close at all for this member?
    const hasSessionTelemetry = sessionTele.length > 0;
    const engagedMinutes = hasSessionTelemetry
      ? Math.round(sessionTele.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / 60000)
      : null;
    return {
      memberId: r.member_id,
      displayName: r.display_name,
      email: r.email,
      avatarUrl: r.avatar_url,
      namedDoor: r.named_door,
      isDemo: isDemoEmail(r.email),
      joinedAt: toIso(r.joined_at) ?? new Date(0).toISOString(),
      lastSignInAt,
      // "Last active" now reads only from signals that can actually happen. It previously folded in
      // last_beat_at, last_daily_beat_at and last_workout_at — so a member who merely SELF-MARKED a Reclaim
      // goal looked like fresh program work, on the exact column you scan to decide who needs you.
      lastActiveAt: newestIso(
        lastSignInAt,
        toIso(r.last_msg_at),
        toIso(r.last_session_at),
        toIso(r.last_retake_at),
      ),
      idScore: toNumOrNull(r.id_score),
      idBaseline: toNumOrNull(r.id_baseline),
      idDirection: r.id_direction,
      sessionsOpened: toNum(r.sessions_opened),
      sessionsClosed: toNum(r.sessions_closed),
      badges: toNum(r.badges),
      facets: toNum(r.facets),
      phase: phaseName(Boolean(r.g_reconnect), Boolean(r.g_rewire), Boolean(r.g_rebuild)),
      reclaimedGoals: toNum(r.reclaimed_goals),
      checkinDays: toNum(r.checkin_days),
      engagedMinutes,
      hasSessionTelemetry,
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
  checkinDays: number;
  gates: number;
  lastMessageAt: string | null;
  lastSessionAt: string | null;
};

// DEAD METRICS REMOVED AT THE SOURCE (2026-07-31). The roster stopped DISPLAYING beats / daily-beat-days /
// workouts, but left these queries feeding the member subpage — so the same untrue numbers simply moved one
// page over. Deleting the columns was a display change presented as a data fix; this is the data fix.
//   · beats        — counted beat_completion UNFILTERED, so it could only ever hold onboarding artifacts and
//                    'self_marked' markers (the two rows the member's own Past Beats view hides). No member on
//                    production can close a Beat: the v3.0 redesign removed the surface.
//   · dailyBeatDays— counted days we SHOWED a panel that no longer renders. Measured us, not them.
//   · workouts     — activity_event, and Strava is unset in production. Structurally always 0.
// Restore them the day their surface returns, with the member-view filter applied.
const MEMBER_USAGE_SQL = `
  select
    (select count(*) from phase_gate pg where pg.member_id = $1) as gates,
    (select count(distinct date_trunc('day', am.created_at)) from agent_message am
       where am.member_id = $1 and am.role = 'member') as checkin_days,
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
    checkinDays: toNum(r.checkin_days),
    gates: toNum(r.gates),
    lastMessageAt: toIso(r.last_message_at),
    lastSessionAt: toIso(r.last_session_at),
  };
}
