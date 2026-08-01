// What the Founder Companion can LOOK UP.
//
// ── WHY TOOLS AND NOT A BIGGER PARAGRAPH ────────────────────────────────────────────────────────────────────
// The first cut handed the model a fixed summary, so it could say "1 stalled" but not who. That doesn't scale
// and it isn't useful: Jay's real use is a phone, mid-ride, asking a specific question. At 1,000 members no
// static brief fits in a prompt — and 999 of those members are irrelevant to whatever he just asked. So the
// Companion retrieves. It fetches the answer to the question asked, and nothing else.
//
// ── THE PRIVACY LINE (Jay, 2026-07-31) ──────────────────────────────────────────────────────────────────────
// "I don't want to pry into Member's info any more than I could see before, but make the Companion
// knowledgeable about everything else I could ask."
//
// That is ACCESS PARITY, and it draws a clean line through this file:
//
//   · The SEARCH tools (find_members, cohort_stats, recent_activity, operations_status) return OPERATIONAL
//     fields only — name, phase, score, dates, counts. They CANNOT return a member's gap, their Reclaim List,
//     or anything they told their Companion. Not because Jay may not see it, but because a cohort answer is
//     the wrong place for it: it would surface one person's most vulnerable words as texture in a list, to a
//     question that wasn't about them.
//
//   · member_detail is the ONE tool that returns a member's own words — and it requires Jay to NAME the
//     person. That is exactly parity with opening their page, which he can already do, and it carries the
//     same intent: he is looking at one person because he is trying to help them.
//
// The distinction throughout: HELPING a member, never CHARACTERISING one.

import type { Db } from '../db/schema.ts';
import { getRoster, type RosterRow } from '../admin/roster.ts';
import { QUIET_AFTER_DAYS, isStalled, isQuiet } from '../admin/console.ts';
import { buildFounderContext } from './context.ts';
import { generateDraft, MOMENTS, type OperatingMoment } from './draft.ts';
import { createDraft } from './store.ts';

const DAY = 24 * 60 * 60 * 1000;

// ── THE ONE WRITE, AND WHY IT IS ALLOWED ────────────────────────────────────────────────────────────────────
// This file shipped read-only, enforced by there being nothing to call. That was the right default and it is
// being relaxed by exactly one tool, deliberately, in the open:
//
//   · draft_message writes ONE ROW into the review queue. It touches no member data, and it does not send.
//   · It is the same act as clicking "Generate one" on a member's page — which Jay can already do. Parity
//     again: the Companion may do what he can do, not more.
//   · The governance rule is "no auto-send", not "no drafting". The human review gate is untouched: the
//     draft sits in the queue until Jay reads, edits and approves it. Nothing here can approve or send.
//
// The invariant therefore CHANGES SHAPE rather than disappearing: no tool may write member data, and the set
// of write tools is exactly {draft_message}. That is enumerated in WRITE_TOOLS below and asserted in the
// tests, so the next tool that wants to write has to come and edit this list on purpose.
export const WRITE_TOOLS = ['draft_message'] as const;

export const FOUNDER_TOOLS = [
  {
    name: 'cohort_stats',
    description:
      'Counts across the whole cohort: members, how many active in the last 7 days, Sessions closed, average ID Score (and how many members it is built from), and the phase distribution. Use for "how are we doing" questions.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'find_members',
    description:
      'Find members matching an operational filter, newest-signal first. Returns names and program state ONLY — never their gap, their Reclaim List, or anything they told their Companion. ' +
      'Filters: "stalled" (a Session open and nothing since), "quiet" (no signal for days), "all", "by_phase" (pass phase), "no_idq" (never taken the IDQ), "recent" (most recently active).',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', enum: ['stalled', 'quiet', 'all', 'by_phase', 'no_idq', 'recent'] },
        phase: { type: 'string', description: 'Reconnect | Rewire | Rebuild | Reclaim — with filter=by_phase' },
        days: { type: 'number', description: 'Threshold in days for "quiet". Defaults to 5.' },
        limit: { type: 'number' },
      },
      required: ['filter'],
    },
  },
  {
    name: 'member_detail',
    description:
      "Everything about ONE member, including their Reclaim List and how the distance opened in their own words — the same view as opening their page. Use ONLY when Jay asks about a specific person by name. Never call this to add colour to a cohort answer.",
    input_schema: {
      type: 'object' as const,
      properties: { name: { type: 'string', description: 'Their name or email, as Jay said it' } },
      required: ['name'],
    },
  },
  {
    name: 'recent_activity',
    description: 'What actually happened recently across the cohort — Sessions closed, Checkpoints crossed, IDQs completed, goals reclaimed. Use for "what moved" / "anything overnight".',
    input_schema: {
      type: 'object' as const,
      properties: { hours: { type: 'number', description: 'Look-back window. Defaults to 24.' } },
      required: [],
    },
  },
  {
    name: 'operations_status',
    description: 'The running of the thing, not the members: drafts waiting in the review queue, open moderation/safety reports, and whether the AI surfaces are healthy.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'draft_message',
    description:
      'Write a message to ONE member, in Jay\'s voice, into his review queue. It SENDS NOTHING — Jay reads, edits and approves every message himself, and he may reject it. ' +
      'Use when he asks you to reach out to someone, or when he agrees to a nudge you suggested. Ask him first if he has not asked for it. ' +
      'Moments: "gone_quiet" (been away, no reason given — no guilt, no chasing), "false_start_return" (slipped and came back), ' +
      '"milestone_commentary" (finished something specific), "goal_reclaimed" (marked a Reclaim List item back), ' +
      '"retake_commentary" (just retook the IDQ), "post_idq_welcome" (new member, just finished intake).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'The member, as Jay said it' },
        moment: {
          type: 'string',
          enum: ['gone_quiet', 'false_start_return', 'milestone_commentary', 'goal_reclaimed', 'retake_commentary', 'post_idq_welcome'],
          description: 'Which of the founder moments fits what actually happened. Pick from the DATA, not from a hunch.',
        },
      },
      required: ['name', 'moment'],
    },
  },
];

/** Operational shape — the ONLY member fields a cohort answer may contain. */
function operational(r: RosterRow, now: number) {
  return {
    name: r.displayName,
    memberId: r.memberId,
    phase: r.phase,
    // ROUNDED, like everywhere else. The Companion reported "ID Score is 80.83" (Jay's walk, 2026-08-01)
    // while every other surface — the member's own dashboard, the roster, the member subpage, the cohort
    // average — shows a whole number. The ID Score is a mirror, not a measurement to two decimal places, and
    // a decimal implies a precision the instrument doesn't have. Rounded HERE rather than in the roster,
    // because the raw value is still needed to compute deltas.
    idScore: r.idScore == null ? null : Math.round(r.idScore),
    idDirection: r.idDirection,
    sessionsClosed: r.sessionsClosed,
    sessionsOpen: Math.max(0, r.sessionsOpened - r.sessionsClosed),
    badges: r.badges,
    daysSinceActive: r.lastActiveAt ? Math.floor((now - new Date(r.lastActiveAt).getTime()) / DAY) : null,
    joinedDaysAgo: Math.floor((now - new Date(r.joinedAt).getTime()) / DAY),
  };
}

export type ToolResult = Record<string, unknown>;

/**
 * Per-TURN state, so the fan-out cap below can exist. One of these is created for each question Jay asks.
 */
export type TurnBudget = { openedMembers: Set<string>; drafted: Set<string> };
export const newTurnBudget = (): TurnBudget => ({ openedMembers: new Set(), drafted: new Set() });

/**
 * How many DISTINCT members' private records one question may open.
 *
 * Two, because "compare Donna and Marcus" is a real and legitimate question. Not unbounded, because
 * "give me the full picture on everyone, in depth" is the shape we are stopping — and a live walk showed
 * the model doing exactly that: it fanned member_detail across the whole cohort. It did not repeat anything
 * private into its answer that time, but it had done the prying, and on a previous run it had correctly
 * declined. A rule that holds only sometimes is not a rule, it is a tendency. So the cap is enforced here,
 * where the model cannot talk its way past it, and the prompt's version becomes an explanation rather than
 * the enforcement.
 */
export const MAX_MEMBERS_PER_TURN = 2;

/**
 * How many members one question may DRAFT to.
 *
 * Same reasoning as the read cap, but tighter, because a draft is a thing that appears in Jay's queue with
 * his name on it. "Nudge everyone who's gone quiet" is a request a model would happily satisfy by writing
 * five personal messages in one turn — and Jay would then face five drafts he has to read individually to
 * find out what he just agreed to. One at a time keeps the review gate meaningful instead of a rubber stamp.
 */
export const MAX_DRAFTS_PER_TURN = 1;

export async function runFounderTool(
  db: Db,
  name: string,
  input: Record<string, unknown>,
  now = Date.now(),
  budget?: TurnBudget,
): Promise<ToolResult> {
  const roster = (await getRoster(db)).filter((r) => !r.isDemo);
  const age = (iso: string | null) => (iso ? now - new Date(iso).getTime() : Infinity);

  if (name === 'cohort_stats') {
    const scored = roster.filter((r) => typeof r.idScore === 'number');
    return {
      members: roster.length,
      activeLast7: roster.filter((r) => age(r.lastActiveAt) < 7 * DAY).length,
      sessionsClosed: roster.reduce((a, r) => a + r.sessionsClosed, 0),
      avgIdScore: scored.length ? Math.round(scored.reduce((a, r) => a + (r.idScore ?? 0), 0) / scored.length) : null,
      avgBuiltFrom: scored.length,
      membersWithoutScore: roster.length - scored.length,
      byPhase: ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'].map((p) => ({ phase: p, count: roster.filter((r) => r.phase === p).length })),
    };
  }

  if (name === 'find_members') {
    const filter = String(input.filter ?? 'all');
    const days = typeof input.days === 'number' ? input.days : QUIET_AFTER_DAYS;
    const limit = Math.min(typeof input.limit === 'number' ? input.limit : 25, 100);
    let rows = roster;
    // The SHARED predicates — so the Companion's "who's stalled" and the console tile behind Jay's eyes can
    // never mean two different things. This used to re-express both definitions inline.
    if (filter === 'stalled') rows = roster.filter((r) => isStalled(r, now));
    else if (filter === 'quiet') rows = roster.filter((r) => isQuiet(r, now, days));
    else if (filter === 'by_phase') rows = roster.filter((r) => r.phase === String(input.phase ?? ''));
    else if (filter === 'no_idq') rows = roster.filter((r) => r.idScore == null);
    rows = [...rows].sort((a, b) => age(a.lastActiveAt) - age(b.lastActiveAt));
    return { filter, matched: rows.length, members: rows.slice(0, limit).map((r) => operational(r, now)) };
  }

  /** Resolve a person the way Jay said their name. Shared, so member_detail and draft_message can never
   *  disagree about who "Donna" is — which would mean drafting to one member about another's situation. */
  const resolve = (raw: unknown) => {
    const q = String(raw ?? '').trim().toLowerCase();
    if (!q) return null;
    return roster.find((r) => r.displayName.toLowerCase().includes(q) || r.email.toLowerCase() === q) ?? null;
  };
  const noMatch = (raw: unknown) =>
    ({ found: false, note: `No member matching "${raw}". Names I have: ${roster.map((r) => r.displayName).join(', ')}` });

  if (name === 'member_detail') {
    // Jay named a person. This is parity with opening their page — the one place their own words belong.
    const hit = resolve(input.name);
    if (!hit) return noMatch(input.name);

    // The fan-out cap. Re-opening someone already opened this turn is free — it is the same person, and
    // refusing it would break a natural follow-up.
    if (budget && !budget.openedMembers.has(hit.memberId)) {
      if (budget.openedMembers.size >= MAX_MEMBERS_PER_TURN) {
        return {
          refused: true,
          why: `You have already opened ${budget.openedMembers.size} members' private records for this one question. Opening more is sweeping the cohort's confidences rather than helping one person. Answer from the operational data you have, and ask Jay to name the ONE person he wants to go deep on.`,
        };
      }
      budget.openedMembers.add(hit.memberId);
    }

    // NO SILENT CATCH HERE. A swallowed error would return an EMPTY Reclaim List, and the model would
    // faithfully report "she hasn't listed anything" — a confident false zero about the most important
    // thing in the product. Same failure class as the roster columns that could never be true. If the
    // read breaks, the tool says the read broke.
    let words: { reclaimList: unknown; howTheDistanceOpened: string | null } | { unavailable: string };
    try {
      const [items, prof, doors] = await Promise.all([
        db.query<{ text: string; state: string }>(
          `select text, state from reclaim_item where member_id=$1 and removed_at is null order by sort_order`, [hit.memberId]),
        db.query<{ intake_gap: string | null; identity_noun: string | null }>(
          `select intake_gap, identity_noun from member_profile where member_id=$1`, [hit.memberId]),
        db.query<{ door_slug: string }>(
          `select door_slug from member_door where member_id=$1 and removed_at is null order by is_primary desc, sort_order`, [hit.memberId]),
      ]);
      words = {
        reclaimList: items.rows.map((i) => ({ want: i.text, reclaimed: i.state === 'reclaimed' })),
        howTheDistanceOpened: prof.rows[0]?.intake_gap ?? null,
      };
      return {
        found: true,
        ...operational(hit, now),
        identityWord: prof.rows[0]?.identity_noun ?? null,
        doors: doors.rows.map((d) => d.door_slug),
        ...words,
        handleWithCare: 'These are their own words, told in confidence. Use them to help this person — never repeat them into a cohort answer.',
      };
    } catch {
      return {
        found: true,
        ...operational(hit, now),
        unavailable: "Their Reclaim List and gap could not be read just now — this is a READ FAILURE, not an empty list. Say so; do not report it as nothing.",
      };
    }
  }

  if (name === 'recent_activity') {
    const hours = Math.min(Math.max(typeof input.hours === 'number' ? input.hours : 24, 1), 24 * 90);
    // `ref` is a column on member_event, not a key in a payload jsonb. And NO swallowed catch: an empty
    // window and a failed read are opposite answers, and the model must not report one as the other.
    const { rows } = await db.query<{ display_name: string; kind: string; ref: string | null; created_at: unknown }>(
      `select p.display_name, e.kind, e.ref, e.created_at
         from member_event e join member_profile p on p.member_id = e.member_id
        where e.kind in ('session_close','checkpoint_cross','idq_complete','goal_reclaimed')
          and e.created_at > now() - make_interval(hours => $1)
          and coalesce(p.email,'') not like '%.test'
        order by e.created_at desc limit 50`,
      [Math.round(hours)],
    );
    return {
      windowHours: hours,
      events: rows.map((r) => ({
        who: r.display_name, what: r.kind, ref: r.ref,
        at: new Date(r.created_at as string).toISOString(),
      })),
    };
  }

  if (name === 'operations_status') {
    // NO CATCH-TO-ZERO. I wrote these with `.catch(() => ({ rows: [{ n: 0 }] }))` yesterday and my own sweep
    // caught it: a failed read would have told Jay "no drafts waiting, no open reports" — a confident zero
    // about the two queues where work silently disappearing is the whole risk. An unfiled safety report
    // reading as "nothing flagged" is the worst sentence this tool could say.
    try {
      const [drafts, reports] = await Promise.all([
        db.query<{ n: number }>(`select count(*)::int n from founder_agent_drafts where approval_status='pending'`),
        db.query<{ n: number; safety: number }>(
          `select count(*)::int n, count(*) filter (where concern_for_safety)::int safety from connect_report where status='open'`,
        ),
      ]);
      return {
        draftsAwaitingYourApproval: drafts.rows[0]?.n ?? 0,
        openReports: reports.rows[0]?.n ?? 0,
        safetyReports: reports.rows[0]?.safety ?? 0,
        note: 'Drafts send nothing until you approve them.',
      };
    } catch (e) {
      console.error('[founder] operations_status read failed:', e);
      return {
        unavailable: true,
        error:
          'The queues could not be read just now. Tell Jay the READ FAILED — do not say the queues are empty, ' +
          'because you do not know that. Open drafts and safety reports may be waiting.',
      };
    }
  }

  if (name === 'draft_message') {
    // THE ONE WRITE. It creates a row in the review queue and nothing else. No send path is reachable from
    // here — approving and sending live behind Jay's own hands in the console, and that is the whole point.
    const hit = resolve(input.name);
    if (!hit) return noMatch(input.name);

    const moment = String(input.moment ?? '') as OperatingMoment;
    if (!(moment in MOMENTS)) {
      return { drafted: false, error: `"${input.moment}" is not a founder moment. One of: ${Object.keys(MOMENTS).join(', ')}` };
    }

    if (budget) {
      if (budget.drafted.has(hit.memberId)) {
        return { drafted: false, why: `You already drafted to ${hit.displayName} in this answer. It is in the queue — don't write a second one.` };
      }
      if (budget.drafted.size >= MAX_DRAFTS_PER_TURN) {
        return {
          drafted: false,
          why: `One draft per question. There is already a message waiting for Jay to read from this answer; writing several at once turns his review into a rubber stamp. Tell him who else you'd write to and let him ask.`,
        };
      }
    }

    // The draft is grounded in the member's REAL record, built by the same function the member page uses —
    // never in whatever the model happens to remember from earlier in the conversation. A message going out
    // in Jay's name must be about what actually happened to that person.
    const ctx = await buildFounderContext(db, hit.memberId);
    if (!ctx) return { drafted: false, error: `Could not build ${hit.displayName}'s record, so there is nothing honest to write from. Nothing was drafted.` };

    const draft = await generateDraft(moment, ctx);
    const id = await createDraft(db, { memberId: hit.memberId, moment, draft, inputSnapshot: ctx });
    budget?.drafted.add(hit.memberId);

    return {
      drafted: true,
      draftId: id,
      to: hit.displayName,
      moment: MOMENTS[moment].label,
      subject: draft.subject,
      body: draft.body,
      status: 'Waiting in the review queue. NOTHING HAS BEEN SENT — Jay reads, edits and approves it himself, and can reject it.',
      whereToFind: '/admin/review',
    };
  }

  return { error: `Unknown tool: ${name}` };
}
