// The Founder Console — cohort view, attention queue, activity feed.
//
// WHAT THIS SURFACE IS FOR. The old admin page answered "what has each member done?" — a table you read
// left to right. The console answers the question Jay actually arrives with: **who needs me this morning?**
// Every number here has to earn that. If a value can't change what he does next, it doesn't belong.
//
// DERIVED FROM THE ROSTER, NOT RE-QUERIED. getRoster() already computes phase, ID Score, session counts and
// last-active per member, and those were carefully cleaned (2026-07-31) of metrics that could never be true.
// Recomputing them here would let the two drift apart — which is exactly how the roster and the member
// subpage ended up disagreeing. One source, one truth.

import type { Db } from '../db/schema.ts';
import type { RosterRow, RosterSummary } from './roster.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Mid-work and paused: an open Session with nothing since. Not gone — just waiting. */
export const STALLED_AFTER_HOURS = 24;
/** No signal of any kind. This one is about the PERSON, not a Session. */
export const QUIET_AFTER_DAYS = 5;

export type PhaseCount = { phase: string; count: number };
export type CohortView = {
  members: number;
  activeLast7: number;
  sessionsClosed: number;
  avgIdScore: number | null; // null when nobody has an ID Score yet — never render 0 as if it were a score
  scoredMembers: number; // how many the average is actually built from (honesty about the denominator)
  byPhase: PhaseCount[];
};

const PHASES = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];

/**
 * The cohort at a glance. PURE — takes what getRoster already produced.
 *
 * Demo personas are excluded: a seeded .test account is not a member and would quietly inflate every number
 * on the page, including the average ID Score.
 */
export function cohortView(rows: RosterRow[], summary: RosterSummary, now = Date.now()): CohortView {
  const real = rows.filter((r) => !r.isDemo);
  const scored = real.filter((r) => typeof r.idScore === 'number');
  const byPhase = PHASES.map((phase) => ({ phase, count: real.filter((r) => r.phase === phase).length }));
  return {
    members: real.length,
    // Counted from the SAME filtered rows as `members`, not from the roster summary — which counts demo
    // personas. Taking it from there rendered "0 members · 2 active", a panel disagreeing with itself in
    // adjacent tiles. Two numbers on one card must always be built from one population.
    activeLast7: real.filter((r) => r.lastActiveAt && now - new Date(r.lastActiveAt).getTime() < 7 * DAY).length,
    sessionsClosed: summary.sessionsClosedTotal,
    // An average over nobody is not 0, it is nothing. Saying "0" would read as "the cohort is failing".
    avgIdScore: scored.length ? Math.round(scored.reduce((a, r) => a + (r.idScore ?? 0), 0) / scored.length) : null,
    scoredMembers: scored.length,
    byPhase,
  };
}

export type AttentionKind = 'crisis' | 'draft' | 'milestone' | 'stalled' | 'quiet';
export type AttentionRow = {
  kind: AttentionKind;
  label: string; // what it is, in plain words
  count: number;
  memberId?: string; // present when it points at one person
  href?: string;
};

/**
 * PURE half of the queue — the parts derivable from the roster. Kept separate from the DB half so the
 * definitions of "stalled" and "gone quiet" are testable without a database, because those two thresholds
 * are judgement calls and judgement calls are exactly what regress silently.
 */
export function rosterAttention(rows: RosterRow[], now: number): AttentionRow[] {
  const real = rows.filter((r) => !r.isDemo);
  const age = (iso: string | null) => (iso ? now - new Date(iso).getTime() : Infinity);

  // STALLED — they opened a Session and haven't closed it, and nothing has happened since. This is the
  // "mid-work, paused" signal, NOT abandonment: someone two hours into a hard beat looks identical to
  // someone who walked away, and the difference is only time.
  const stalled = real.filter(
    (r) => r.sessionsOpened > r.sessionsClosed && age(r.lastActiveAt) >= STALLED_AFTER_HOURS * 60 * 60 * 1000,
  );

  // GONE QUIET — no signal at all for a while. Deliberately separate from stalled: one is about a piece of
  // work, the other is about a person. They call for different messages, which is the whole point of the
  // queue. A member is only "quiet" once they've actually started (joined and did something at least once).
  const quiet = real.filter((r) => r.lastActiveAt && age(r.lastActiveAt) >= QUIET_AFTER_DAYS * DAY);

  return [
    {
      kind: 'stalled',
      label: stalled.length
        ? stalled.length === 1
          ? `${stalled[0]!.displayName} — a Session open, nothing since`
          : `${stalled.length} members mid-Session, paused`
        : 'nobody mid-Session',
      count: stalled.length,
      ...(stalled.length === 1 ? { memberId: stalled[0]!.memberId, href: `/admin/member/${stalled[0]!.memberId}` } : {}),
    },
    {
      kind: 'quiet',
      label: quiet.length
        ? quiet.length === 1
          ? `${quiet[0]!.displayName} — nothing for ${Math.floor(age(quiet[0]!.lastActiveAt) / DAY)} days`
          : `${quiet.length} members haven't been back`
        : 'nobody has drifted',
      count: quiet.length,
      ...(quiet.length === 1 ? { memberId: quiet[0]!.memberId, href: `/admin/member/${quiet[0]!.memberId}` } : {}),
    },
  ];
}

export type FeedItem = { initials: string; text: string; at: string; memberId: string; tone: 'work' | 'win' | 'join' };

/**
 * What moved, newest first. Reads member_event, which is the honest record of what happened — as opposed to
 * a derived count, which is what kept going wrong on the old page.
 *
 * Only events that mean something to an operator are surfaced. A page_view is not news.
 */
export async function activityFeed(db: Db, limit = 12): Promise<FeedItem[]> {
  try {
    const { rows } = await db.query<{
      member_id: string; display_name: string; kind: string; ref: string | null; created_at: unknown;
    }>(
      // `ref` is a TOP-LEVEL column on member_event, not a key inside a payload jsonb. The first cut read
      // e.payload — a column that does not exist — so this threw on every call and the catch below turned it
      // into an empty feed. It rendered as "nothing has happened", which is the most misleading possible
      // failure for a panel whose whole job is showing what happened. Hence the log in the catch.
      `select e.member_id, p.display_name, e.kind, e.ref, e.created_at
         from member_event e
         join member_profile p on p.member_id = e.member_id
        where e.kind in ('session_close','checkpoint_cross','idq_complete','goal_reclaimed')
          and coalesce(p.email,'') not like '%.test'
        order by e.created_at desc
        limit $1`,
      [limit],
    );
    return rows.map((r) => {
      const ref = r.ref ?? '';
      const text =
        r.kind === 'session_close' ? `closed ${ref || 'a Session'}`
        : r.kind === 'checkpoint_cross' ? `crossed ${ref || 'a Checkpoint'}`
        : r.kind === 'idq_complete' ? 'completed the IDQ'
        : 'reclaimed a goal';
      return {
        memberId: r.member_id,
        initials: initialsOf(r.display_name),
        text: `${r.display_name} ${text}`,
        at: new Date(r.created_at as string).toISOString(),
        tone: r.kind === 'idq_complete' ? 'join' : r.kind === 'session_close' ? 'work' : 'win',
      } as FeedItem;
    });
  } catch (e) {
    // Degrade to quiet rather than break the page — but SAY SO in the log. A silent [] here is
    // indistinguishable from a genuinely quiet cohort, and that is exactly how the broken query above
    // survived a deploy unnoticed.
    console.error('[console] activityFeed read failed — feed rendered empty:', e);
    return [];
  }
}

function initialsOf(name: string): string {
  const w = (name ?? '').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1]![0] : '')).toUpperCase();
}
