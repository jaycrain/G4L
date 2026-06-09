// Operator roster: every signed-up member with at-a-glance engagement metrics.
// A lightweight read for the Founder Agent console — shared with a trusted circle
// during the pre-launch window. No new infrastructure; pure reads over existing tables.

import type { Db } from '../db/schema.ts';

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
  assets: number; // program asset completions (true progress)
  bites: number;
  workouts: number;
  checkinDays: number; // distinct days the member sent the agent a message
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
  last_asset_at: unknown;
  last_workout_at: unknown;
  last_bite_at: unknown;
  last_retake_at: unknown;
  assets: unknown;
  bites: unknown;
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

// "Activity" rollup = the companion signals a member generates by showing up.
// Kept separate from `assets` (true program progress) so the meaningful number isn't buried.
export function activityCount(row: Pick<RosterRow, 'bites' | 'workouts' | 'checkinDays'>): number {
  return row.bites + row.workouts + row.checkinDays;
}

export type RosterSummary = {
  total: number;
  joinedLast30: number;
  activeLast7: number;
  assetsTotal: number;
};

export function summarizeRoster(rows: RosterRow[], nowMs: number): RosterSummary {
  const d30 = nowMs - 30 * 86_400_000;
  const d7 = nowMs - 7 * 86_400_000;
  let joinedLast30 = 0;
  let activeLast7 = 0;
  let assetsTotal = 0;
  for (const r of rows) {
    if (new Date(r.joinedAt).getTime() >= d30) joinedLast30++;
    if (r.lastActiveAt && new Date(r.lastActiveAt).getTime() >= d7) activeLast7++;
    assetsTotal += r.assets;
  }
  return { total: rows.length, joinedLast30, activeLast7, assetsTotal };
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
    (select max(s.created_at)   from member_session s   where s.member_id  = p.member_id) as last_sign_in_at,
    (select max(am.created_at)  from agent_message am   where am.member_id = p.member_id) as last_msg_at,
    (select max(ac.completed_at) from asset_completion ac where ac.member_id = p.member_id) as last_asset_at,
    (select max(ae.started_at)  from activity_event ae  where ae.member_id = p.member_id) as last_workout_at,
    (select max(bc.consumed_at) from bite_consumed bc   where bc.member_id = p.member_id) as last_bite_at,
    (select max(r.taken_at)     from idq_retake r       where r.member_id  = p.member_id) as last_retake_at,
    (select count(*) from asset_completion ac where ac.member_id = p.member_id) as assets,
    (select count(*) from bite_consumed bc   where bc.member_id = p.member_id) as bites,
    (select count(*) from activity_event ae  where ae.member_id = p.member_id) as workouts,
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
  const mapped: RosterRow[] = rows.map((r) => {
    const lastSignInAt = toIso(r.last_sign_in_at);
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
        toIso(r.last_asset_at),
        toIso(r.last_workout_at),
        toIso(r.last_bite_at),
        toIso(r.last_retake_at),
      ),
      idScore: toNumOrNull(r.id_score),
      idBaseline: toNumOrNull(r.id_baseline),
      idDirection: r.id_direction,
      assets: toNum(r.assets),
      bites: toNum(r.bites),
      workouts: toNum(r.workouts),
      checkinDays: toNum(r.checkin_days),
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
