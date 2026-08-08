// THE THREE OUTCOMES — what a member is actually building, and what "built" means.
//
// Greg (2026-08-08): "W builds mindfulness, B builds fitness, and C builds wellness. The three outcomes are all
// 'products' (i.e. nouns - something you have) … Mindfulness and Fitness both directly contribute to Wellness so
// they build hierarchically too."
//
// Jay kept it and asked the question that makes it real: make them "more detailed and understandable in terms of
// how they are 'completed'." The answer is already in Greg's own structure — each phase produces exactly three
// things, his Levels, and they are the SAME three every time:
//
//     a READ     — what you know      (L1)
//     a TOOL     — what you hold      (L2)
//     a TRACKED WEEK — what you practise (L3)
//
// So an outcome is BUILT when a member holds all three and has run the week to its end. That is checkable in
// code rather than asserted, which is the whole reason this file exists instead of a decorative strip.
//
// THE HONESTY RULE, and it is the one that will get bent first. Cycle 1 builds the SKILLS; it does not hand
// anyone wellness. Greg's analogy: you practise free throws, you do not practise winning. So every label here
// describes what the member has BUILT TOWARD the outcome — never that they now possess it. `built` means "the
// three components exist", not "you are a mindful person now", and nothing downstream may phrase it that way.
//
// NOT A SCORE. No percentages, no counts out of three, no ranking between phases. Three named things a member
// made, present or not yet — the same posture as the badge grid, where what is ahead reads as road rather than
// debt.

import type { Db } from '../db/schema.ts';

export type OutcomePart = {
  /** The member-facing name of the thing they made. */
  label: string;
  /** Plain-language Level: what you know / hold / practise. Greg's Levels without shipping his internal words. */
  sub: 'what you know' | 'what you hold' | 'what you practise';
  done: boolean;
  /** Set only for the tracked week while it is RUNNING — "day 3 of 7". Never shown once closed. */
  running?: string;
};

export type Outcome = {
  phase: 'rewire' | 'rebuild' | 'reclaim';
  /** mindfulness · fitness · wellness — Greg's words, and nouns on purpose. */
  product: string;
  /** One line on what the outcome IS, in the member's terms rather than the construct's. */
  blurb: string;
  parts: OutcomePart[];
  built: boolean;
  /** Reclaim only: the one the other two feed. Rendered differently so the hierarchy reads without a diagram. */
  fedByOthers?: boolean;
};

// Asset ids are the STAGED program's (RWR-W1, RBLD-B1, RCL-C1 …), which is what prod runs. With the phase flags
// off the unflagged registry uses different ids entirely, so nothing matches and every card reads unbuilt — a
// correct degrade rather than a wrong claim, and the reason this is worth stating out loud.
const SHAPE = [
  {
    phase: 'rewire' as const,
    product: 'Mindfulness',
    blurb: 'Catching the story before it drives.',
    read: { id: 'RWR-W1', label: 'Your true lines' },
    tool: { id: 'RWR-W2', label: 'Your picture' },
    week: { kind: 'w3_logging', label: 'Mindful Monitoring' },
  },
  {
    phase: 'rebuild' as const,
    product: 'Fitness',
    blurb: 'Moving, eating and sleeping like you mean it.',
    read: { id: 'RBLD-B1', label: 'Your why' },
    tool: { id: 'RBLD-B2', label: 'Your map' },
    week: { kind: 'b3_pilot', label: 'The Lifestyle Pilot' },
  },
  {
    phase: 'reclaim' as const,
    product: 'Wellness',
    blurb: 'The life the other two are for.',
    read: { id: 'RCL-C1', label: 'Your list, refined' },
    tool: { id: 'RCL-C2', label: 'Your bigger world' },
    week: { kind: 'c3_quality', label: 'Quality Days' },
  },
];

/** The three outcome cards. Drift-hardened: any read hiccup yields an empty list (no cards) rather than a wrong
 *  claim about what someone has built — the failure mode to avoid here is confidently showing a member LESS than
 *  they have done, which reads as the program forgetting their work. */
export async function outcomes(db: Db, memberId: string): Promise<Outcome[]> {
  try {
    const [closedSessions, weeks] = await Promise.all([
      db.query<{ session_id: string }>(
        `select session_id from session_progress where member_id = $1 and status = 'closed'`,
        [memberId],
      ),
      db.query<{ kind: string; closed_at: string | null; day: number }>(
        `select kind, closed_at::text as closed_at,
                (date_part('day', now() - started_at))::int + 1 as day
           from practice_week where member_id = $1`,
        [memberId],
      ),
    ]);
    const done = new Set(closedSessions.rows.map((r) => r.session_id));
    const byKind = new Map(weeks.rows.map((r) => [r.kind, r]));

    return SHAPE.map((s) => {
      const w = byKind.get(s.week.kind);
      // A week counts only when it has CLOSED. An open week is in progress, not a thing they hold — the same
      // distinction the hero's accomplishment line makes, and for the same reason.
      const weekDone = !!w?.closed_at;
      const running = w && !w.closed_at && w.day >= 1 && w.day <= 7 ? `day ${w.day} of 7` : undefined;
      const parts: OutcomePart[] = [
        { label: s.read.label, sub: 'what you know', done: done.has(s.read.id) },
        { label: s.tool.label, sub: 'what you hold', done: done.has(s.tool.id) },
        { label: s.week.label, sub: 'what you practise', done: weekDone, running },
      ];
      return {
        phase: s.phase,
        product: s.product,
        blurb: s.blurb,
        parts,
        built: parts.every((p) => p.done),
        fedByOthers: s.phase === 'reclaim' || undefined,
      };
    });
  } catch (e) {
    console.error(`outcomes read failed for member=${memberId}:`, e);
    return [];
  }
}
