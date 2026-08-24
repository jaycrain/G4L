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
  /** People mid-onboarding or stopped in it — NOT members, and deliberately not folded into `members`.
   *  It sits on the cohort card because it is the other half of the same question: how many came, and how
   *  many of them made it. Passed in rather than derived, because the population lives in a different table. */
  prospects: number;
  byPhase: PhaseCount[];
};

const PHASES = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];

/**
 * The cohort at a glance. PURE — takes what getRoster already produced.
 *
 * Demo personas are excluded: a seeded .test account is not a member and would quietly inflate every number
 * on the page, including the average ID Score.
 */
export function cohortView(
  rows: RosterRow[],
  summary: RosterSummary,
  now = Date.now(),
  prospects = 0,
): CohortView {
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
    prospects,
    byPhase,
  };
}

export type AttentionKind = 'crisis' | 'draft' | 'milestone' | 'stalled' | 'quiet' | 'prospect';
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
const ageOf = (iso: string | null, now: number) => (iso ? now - new Date(iso).getTime() : Infinity);

// THE TWO DEFINITIONS, WRITTEN ONCE.
//
// The console tile, the subpage list and the Companion's find_members tool all have to mean the SAME thing by
// "stalled". If each re-expresses the predicate, they drift, and then a count disagrees with the list behind
// it — the exact failure that made the roster and the member subpage untrustworthy. So the predicate is the
// shared thing and everything else is a caller.

/** Mid-work and paused: a Session open, and nothing at all since. NOT abandonment — someone two hours into a
 *  hard beat looks identical to someone who walked away, and the only difference is time. */
export const isStalled = (r: RosterRow, now: number) =>
  r.sessionsOpened > r.sessionsClosed && ageOf(r.lastActiveAt, now) >= STALLED_AFTER_HOURS * 60 * 60 * 1000;

/** Gone quiet: no signal of any kind for a while. Deliberately separate from stalled — one is about a piece
 *  of work, the other about a person, and they call for different messages. Only counts once they've
 *  actually started; never-started and stopped-coming are different problems. */
export const isQuiet = (r: RosterRow, now: number, days = QUIET_AFTER_DAYS) =>
  Boolean(r.lastActiveAt) && ageOf(r.lastActiveAt, now) >= days * DAY;

/** The people behind the counts — for the Attention subpage. Same predicates, so the list can never
 *  contradict the tile that linked to it. */
export function attentionLists(rows: RosterRow[], now: number): { stalled: RosterRow[]; quiet: RosterRow[] } {
  const real = rows.filter((r) => !r.isDemo);
  return {
    stalled: real.filter((r) => isStalled(r, now)).sort((a, b) => ageOf(b.lastActiveAt, now) - ageOf(a.lastActiveAt, now)),
    quiet: real.filter((r) => isQuiet(r, now)).sort((a, b) => ageOf(b.lastActiveAt, now) - ageOf(a.lastActiveAt, now)),
  };
}

export function rosterAttention(rows: RosterRow[], now: number): AttentionRow[] {
  const real = rows.filter((r) => !r.isDemo);
  const age = (iso: string | null) => ageOf(iso, now);
  const stalled = real.filter((r) => isStalled(r, now));
  const quiet = real.filter((r) => isQuiet(r, now));

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

export type FeedItem = {
  initials: string; text: string; at: string; memberId: string;
  tone: 'work' | 'win' | 'join';
  /** Newer than the operator's last visit. Set by markUnseen, not by the query. */
  unseen?: boolean;
};

/**
 * Split a feed against "when did I last look".
 *
 * PURE, because the interesting part is the edge cases, not the SQL: a first-ever visit (null) means
 * EVERYTHING is new, which is true and is the honest thing to show; and an event exactly ON the boundary is
 * treated as seen, so re-opening the page twice in a row can't resurrect the same row.
 */
export function markUnseen(feed: FeedItem[], seenAt: string | null): { feed: FeedItem[]; unseen: number } {
  const cutoff = seenAt ? new Date(seenAt).getTime() : null;
  let unseen = 0;
  const marked = feed.map((f) => {
    const isNew = cutoff === null || new Date(f.at).getTime() > cutoff;
    if (isNew) unseen++;
    return isNew ? { ...f, unseen: true } : f;
  });
  return { feed: marked, unseen };
}

/**
 * What moved, newest first. Reads member_event, which is the honest record of what happened — as opposed to
 * a derived count, which is what kept going wrong on the old page.
 *
 * Only events that mean something to an operator are surfaced. A page_view is not news.
 */
export async function activityFeed(db: Db, limit = 12): Promise<FeedItem[]> {
  try {
    // THREE SOURCES, ONE FEED.
    //
    // member_event only ever carried Sessions, Checkpoints, IDQs and reclaimed goals. Jay's list of what he
    // wants to see on an instant check-in also has NEW MEMBERS and GRINTA SCORES — neither of which emits an
    // event at all. Rather than start logging them (which would only help from today forward), they're read
    // from the tables that already hold them, so the feed has real history the moment this ships.
    //
    // `ref` is a top-level column on member_event, not a key in a payload jsonb — the first cut selected
    // `e.payload`, threw on every call, and the catch below rendered it as "nothing has happened".
    const { rows } = await db.query<{
      member_id: string; display_name: string; kind: string; ref: string | null; created_at: unknown;
    }>(
      `select e.member_id, p.display_name, e.kind, e.ref, e.created_at
         from member_event e
         join member_profile p on p.member_id = e.member_id
        where e.kind in ('session_close','checkpoint_cross','idq_complete','goal_reclaimed')
          and coalesce(p.email,'') not like '%.test'

       union all
       -- NEW MEMBERS. A signup is the single most interesting thing that can happen on a day, and it was the
       -- one event the feed could not show.
       select p.member_id, p.display_name, 'member_joined', null, p.created_at
         from member_profile p
        where coalesce(p.email,'') not like '%.test' and p.active

       union all
       -- GRINTA, with its DIRECTION. A bare "took the Grinta survey" is not the news; whether it moved is.
       -- The prior reading comes from the same table via a window, so "up/down" is computed once here rather
       -- than being re-derived (and re-disagreed-about) by every caller.
       select g.member_id, p.display_name,
              case when g.prev is null then 'grinta_first'
                   when g.composite > g.prev then 'grinta_up'
                   when g.composite < g.prev then 'grinta_down'
                   else 'grinta_flat' end,
              to_char(g.composite, 'FM9.0'), g.taken_at
         from (
           select member_id, composite, taken_at,
                  lag(composite) over (partition by member_id order by sequence_no) as prev
             from grinta_reading
         ) g
         join member_profile p on p.member_id = g.member_id
        where coalesce(p.email,'') not like '%.test'

        order by created_at desc
        limit $1`,
      [limit],
    );
    return rows.map((r) => {
      const ref = r.ref ?? '';
      const text =
        r.kind === 'session_close' ? `closed ${ref || 'a Session'}`
        : r.kind === 'checkpoint_cross' ? `crossed ${ref || 'a Checkpoint'}`
        : r.kind === 'idq_complete' ? 'completed the IDQ'
        : r.kind === 'member_joined' ? 'joined'
        : r.kind === 'grinta_up' ? `Grinta up to ${ref}`
        : r.kind === 'grinta_down' ? `Grinta down to ${ref}`
        : r.kind === 'grinta_flat' ? `Grinta held at ${ref}`
        : r.kind === 'grinta_first' ? `first Grinta reading — ${ref}`
        : 'reclaimed a goal';
      // A DOWNWARD Grinta is not a "loss" tone. Movement is information, never a verdict (Three Feedbacks) —
      // colouring it like a failure would put a judgement on the operator surface that the member never gets.
      const tone: FeedItem['tone'] =
        r.kind === 'member_joined' || r.kind === 'idq_complete' ? 'join'
        : r.kind === 'goal_reclaimed' || r.kind === 'checkpoint_cross' || r.kind === 'grinta_up' ? 'win'
        : 'work';
      return {
        memberId: r.member_id,
        initials: initialsOf(r.display_name),
        text: `${r.display_name} ${text}`,
        at: new Date(r.created_at as string).toISOString(),
        tone,
      } as FeedItem;
    });
  } catch (e) {
    // Degrade to quiet rather than break the page — but SAY SO. A silent [] is indistinguishable from a
    // genuinely quiet cohort, and that is exactly how the broken query above survived a deploy unnoticed.
    console.error('[console] activityFeed read failed — feed rendered empty:', e);
    return [];
  }
}

function initialsOf(name: string): string {
  const w = (name ?? '').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1]![0] : '')).toUpperCase();
}
