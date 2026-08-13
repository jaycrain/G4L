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
//     a TRACKED WEEK — what you practice (L3)
//
// So an outcome is BUILT when a member holds all three and has run the week to its end. That is checkable in
// code rather than asserted, which is the whole reason this file exists instead of a decorative strip.
//
// THE HONESTY RULE, and it is the one that will get bent first. Cycle 1 builds the SKILLS; it does not hand
// anyone wellness. Greg's analogy: you practice free throws, you do not practice winning. So every label here
// describes what the member has BUILT TOWARD the outcome — never that they now possess it. `built` means "the
// three components exist", not "you are a mindful person now", and nothing downstream may phrase it that way.
//
// NOT A SCORE. No percentages, no counts out of three, no ranking between phases. Three named things a member
// made, present or not yet — the same posture as the badge grid, where what is ahead reads as road rather than
// debt.

import type { Db } from '../db/schema.ts';

/** The three shapes, in the landed member-facing words (Cowork, 2026-08-08). "A read / a tool / a tracked week" is
 *  the plain-language form of Greg's Levels, and it is the SAME phrasing the Program page uses — the two surfaces
 *  teach one vocabulary or they teach none. */
export type PartKind = 'A read' | 'A tool' | 'A tracked week';

export type OutcomePart = {
  kind: PartKind;
  /** The member-facing name of the thing they made ("your true lines"). Lower-case: it reads as the tail of the
   *  kind, "A read — your true lines", which is how the copy was written. */
  label: string;
  /** What that part actually is, in one line. This is the answer to Jay's "more detailed and understandable in
   *  terms of how they are completed" — a name alone told a member nothing. */
  detail: string;
  done: boolean;
  /** Set only for the tracked week while it is RUNNING — "day 3 of 7". Never shown once closed. */
  running?: string;
};

export type Outcome = {
  phase: 'rewire' | 'rebuild' | 'reclaim';
  /** mindfulness · fitness · wellness — Greg's words, and nouns on purpose. */
  product: string;
  /** What the outcome IS, in the member's terms rather than the construct's. */
  blurb: string;
  parts: OutcomePart[];
  built: boolean;
  /** Shown ONLY once all three are done. The moment a phase completes is a real one and we had nothing for it;
   *  this is that line. It names the three things they did and hands forward — it never says they are now well. */
  builtLine: string;
  /** Reclaim only: the one the other two feed. Rendered differently so the hierarchy reads without a diagram. */
  fedByOthers?: boolean;
};

/** The glosses, kept beside the type they explain so the strip's intro can never drift from the parts. */
export const PART_GLOSS: Record<PartKind, string> = {
  'A read': 'what you know',
  'A tool': 'what you keep',
  'A tracked week': 'what you practice',
};

// Asset ids are the STAGED program's (RWR-W1, RBLD-B1, RCL-C1 …), which is what prod runs. With the phase flags
// off the unflagged registry uses different ids entirely, so nothing matches and every card reads unbuilt — a
// correct degrade rather than a wrong claim, and the reason this is worth stating out loud.
// COPY IS COWORK'S, PLACED VERBATIM (2026-08-08, "Playbook + outcome-card copy for CC"). Under the standing sync
// protocol the app is the source of truth, so a line changed here has to go back to canon — don't edit in passing.
const SHAPE = [
  {
    phase: 'rewire' as const,
    product: 'Mindfulness',
    blurb: 'Mindfulness is catching what your mind is doing before it decides for you.',
    read: { id: 'RWR-W1', label: 'your true lines', detail: 'The stories you tell yourself, caught and answered.' },
    tool: { id: 'RWR-W2', label: 'your picture', detail: 'Who you’re becoming, vivid enough to reach for.' },
    week: { kind: 'w3_logging', label: 'Mindful Monitoring', detail: 'Noticing the slips early and clipping back in.' },
    builtLine: 'You caught the stories, built the picture, practiced the week. That skill is yours now, and it feeds what comes next.',
  },
  {
    phase: 'rebuild' as const,
    product: 'Fitness',
    blurb: 'Fitness is your body doing what you ask of it.',
    read: { id: 'RBLD-B1', label: 'your why', detail: 'The reasons to care for your body that actually last.' },
    tool: { id: 'RBLD-B2', label: 'your map', detail: 'Where your skills are strong, and where they’ll grow.' },
    week: { kind: 'b3_pilot', label: 'the Lifestyle Pilot', detail: 'A week of watching how your choices really play out.' },
    builtLine: 'You found your why, mapped your skills, ran the week. Real ground — and it feeds what comes next.',
  },
  {
    phase: 'reclaim' as const,
    product: 'Wellness',
    blurb: 'Wellness is how your life actually feels — the outcome the other two feed.',
    read: { id: 'RCL-C1', label: 'your list, refined', detail: 'What you’re reclaiming, now that you know yourself better.' },
    tool: { id: 'RCL-C2', label: 'your bigger world', detail: 'Where your life is opening up, and where it’s still narrow.' },
    week: { kind: 'c3_quality', label: 'Quality Days', detail: 'Tracking the days that feel like the life you’re building.' },
    builtLine: 'Mindfulness and fitness brought you here. You’ve walked the whole arc once. You keep it by living it.',
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
        { kind: 'A read', label: s.read.label, detail: s.read.detail, done: done.has(s.read.id) },
        { kind: 'A tool', label: s.tool.label, detail: s.tool.detail, done: done.has(s.tool.id) },
        { kind: 'A tracked week', label: s.week.label, detail: s.week.detail, done: weekDone, running },
      ];
      return {
        phase: s.phase,
        product: s.product,
        blurb: s.blurb,
        parts,
        built: parts.every((p) => p.done),
        builtLine: s.builtLine,
        fedByOthers: s.phase === 'reclaim' || undefined,
      };
    });
  } catch (e) {
    console.error(`outcomes read failed for member=${memberId}:`, e);
    return [];
  }
}
