// THE SELF-MANAGEMENT MAP — B2's reading, shaped for a member to read.
//
// WHY THIS EXISTS. B2 computes a full profile — twelve skills, scored separately for movement and eating, grouped
// into Greg's three families — and until now a member saw NONE of it. Two strings reached the Companion
// (`strongest`, `growthEdge`); no surface rendered anything. Greg named this on 2026-08-08: "profile displayed as a
// development map, not a score", and his B2 Science Check says the family grouping is the valuable part precisely
// because it "can help clarify whether a person mainly needs help getting ready, taking action, or sustaining."
//
// ── THE DESIGN CONSTRAINT, AND HOW IT IS MET ──────────────────────────────────────────────────────────────────
// Nothing here emits a number, a percentage or a rank position. What it emits is a SHAPE: which family is thinnest,
// and which skills within each are steady. Two things make that safe to show:
//
//   1. EVERY JUDGEMENT IS RELATIVE TO THE MEMBER'S OWN PROFILE, never to a scale or to other members. "Steady" means
//      "high for you"; the same raw answer can be steady in one profile and a growing edge in another. That is what
//      makes it a map rather than a mark — there is no line to fall below.
//   2. THE COPY DECLARES (Jay, 2026-08-17). It says what the map shows, never that it "isn't a score". Telling an
//      accomplished adult they are not being graded implies they feared it. See the VOICE block in system-prompt.ts.
//
// The per-domain split is surfaced ONLY where movement and eating genuinely diverge. Greg calls that distinction a
// distinctive strength of B2 ("good at planning movement but poor at managing eating cues"), but printing it on all
// twelve rows would bury the one or two places it means something.

import { META_BY_SKILL, SKILL_LABEL, type SkillMeta, type SkillScore } from './skills-instrument.ts';

/** The three families in Greg's order — getting ready → taking action → staying with it. */
export const FAMILY_ORDER: SkillMeta[] = ['predisposing', 'enabling', 'reinforcing'];

/**
 * HIS TERM, OUR GLOSS (Jay, 2026-08-26).
 *
 * These read "Getting ready / Taking action / Staying with it" and dropped Greg's names entirely. He asked for
 * the opposite, in writing: *"I would prefer to retain the labels PreDisposing, Enabling and Reinforcing as they
 * are more accurate and also more descriptive."*
 *
 * IT WAS NEVER EITHER/OR, WHICH IS WHY THE DISAGREEMENT LASTED. His own teaching copy uses both — "The
 * Predisposing skills are about getting ready to change. Things like your confidence, your motivation, and how
 * you think about barriers." He wants the construct named AND explained; we had kept only the explanation, which
 * reads as plain language but quietly withholds the vocabulary a member needs to follow the science, join the
 * Community conversation, or recognise the term anywhere else in the program.
 *
 * So the name is his and the gloss is ours, in that order, and neither is doing the other's job. This also
 * unblocks his refinement to B2's "Why it Matters", which is identical to ours in every clause but this one.
 */
export const FAMILY_LABEL: Record<SkillMeta, { name: string; gloss: string }> = {
  predisposing: { name: 'Predisposing', gloss: 'what gets you to the starting line' },
  enabling: { name: 'Enabling', gloss: 'what turns intention into a week' },
  reinforcing: { name: 'Reinforcing', gloss: 'what keeps it going after the first miss' },
};

// SKILL_LABEL lives in skills-instrument.ts now — one list, so the assessment, the close, the Companion and
// this map cannot drift into calling the same skill different things.

export type MapRow = {
  no: number;
  label: string;
  /** Steady = in the stronger half of THEIR OWN profile. Never a threshold on the scale. */
  steady: boolean;
  /** Set only where the two domains genuinely diverge — "eating more than movement", or the reverse. */
  divergence: string | null;
};

export type MapFamily = { key: SkillMeta; name: string; gloss: string; rows: MapRow[] };

export type SkillsMap = {
  families: MapFamily[];
  /** The family with the most growing edges — what the lead line names. Null when the profile is flat. */
  thinnest: SkillMeta | null;
  /** The family with the fewest — the one they lead with. Null when flat. */
  steadiest: SkillMeta | null;
  /**
   * Their single highest-scoring skill, by label.
   *
   * WHY THIS SURVIVED THE REWRITE. The read used to name the strongest SKILL; the map rewrite replaced that with
   * the family shape, because Greg's B2 Science Check says the grouping is the valuable part. It is — but the two
   * are not substitutes, and dropping the skill quietly took away the one specific, personal thing the read said
   * about them. "Getting ready is the thinnest of the three" is a shape; "Monitoring is your strongest" is a fact
   * about a person. The lead now carries both, and a test asserts the skill is named.
   */
  strongest: string | null;
  /**
   * THE PROFILE, AS NUMBERS — Greg's normalization, shown to the member (Jay, 2026-08-26).
   *
   * He asked for it twice: "show a summary of the scores and how to interpret them", and "a report with plots
   * that summarize Enabling, Predisposing and Reinforcing so that they can see their profile." We computed every
   * figure and displayed none of them, on a blanket reading of never-a-bare-number.
   *
   * JAY'S CORRECTION, which is why this exists: *"You might be taking the grade/score thing too far. If Greg is
   * asking for it there must be a reason… On a macro level, we don't do it. On a micro level, I think it's ok to
   * pick our spots. This is one."* The rule protects a member from being GRADED — a score against a target, a
   * percentage of compliance, a number they can fail. Their own three categories measured against each other is
   * a different object: it is the shape of them, and that shape is what B2 exists to hand over.
   *
   * `meta` is per category against its own maximum; `movement`/`eating` are the two domain totals — the only
   * place a member meets the activity/diet split at all, since it left the Checkpoint with Greg's V5.
   */
  profile: {
    meta: Record<SkillMeta, number>;
    movement: number;
    eating: number;
  } | null;
};

/**
 * A gap worth mentioning between movement and eating on one skill. The instrument is 1–5 per domain, so a
 * difference of 2+ is a real split rather than a rounding wobble; below that, saying it would manufacture a
 * distinction the member did not make.
 */
const DIVERGENCE_MIN = 2;

/** Every figure the profile needs, present and numeric — see the note on SkillsMap.profile. */
function hasProfile(score: SkillScore): boolean {
  const m = score.meta as Partial<Record<SkillMeta, { pct?: number }>> | undefined;
  const domainsOk = typeof score.activity?.pct === 'number' && typeof score.diet?.pct === 'number';
  return domainsOk && FAMILY_ORDER.every((k) => typeof m?.[k]?.pct === 'number');
}

export function buildSkillsMap(score: SkillScore): SkillsMap {
  // The median of THEIR twelve means is the divide. A fixed cutoff (say 3.5) would import an external standard,
  // which is the one thing this read must not do — and would also render a uniformly modest profile as twelve
  // failures, or a uniformly confident one as nothing to work on. Split relative, always.
  const means = score.perSkill.map((s) => s.mean).sort((a, b) => a - b);
  const mid = (means[5]! + means[6]!) / 2;

  const families = FAMILY_ORDER.map((key) => {
    const rows: MapRow[] = score.perSkill
      .filter((s) => META_BY_SKILL[s.no] === key)
      .map((s) => {
        const gap = s.activity - s.diet;
        return {
          no: s.no,
          label: SKILL_LABEL[s.no] ?? s.skill,
          steady: s.mean >= mid,
          divergence:
            Math.abs(gap) >= DIVERGENCE_MIN ? (gap > 0 ? 'movement more than eating' : 'eating more than movement') : null,
        };
      })
      // ORDER INSIDE A FAMILY, and both halves were learned from walking it:
      //   1. A row carrying a movement/eating SPLIT leads. That note is the most specific thing the instrument
      //      produces about a member — "you plan movement well and eating badly" is actionable in a way a family
      //      shape is not — and the first build buried the only one behind the collapsed tail, where its text did
      //      not even render. Rare by construction (a 2+ point gap), so promoting it costs nothing.
      //   2. Then growing edges: the read exists to say what to practice, so it must not sit below the fold.
      .sort((a, b) =>
        Number(!!b.divergence) - Number(!!a.divergence) || Number(a.steady) - Number(b.steady) || a.no - b.no);
    return { key, name: FAMILY_LABEL[key].name, gloss: FAMILY_LABEL[key].gloss, rows };
  });

  // Share-of-family, not a count: the families have 3, 6 and 3 skills, so raw counts would name Taking action the
  // thinnest almost every time simply for being twice the size.
  const share = (f: MapFamily) => f.rows.filter((r) => !r.steady).length / f.rows.length;
  const ranked = [...families].sort((a, b) => share(b) - share(a));
  const flat = share(ranked[0]!) === share(ranked[ranked.length - 1]!);

  // Their best single skill. Ties break on the lower skill number so the same profile always names the same skill
  // — a lead line that changed wording between two identical reads would read as the product being unsure.
  const best = [...score.perSkill].sort((a, b) => b.mean - a.mean || a.no - b.no)[0];

  return {
    families,
    thinnest: flat ? null : ranked[0]!.key,
    steadiest: flat ? null : ranked[ranked.length - 1]!.key,
    strongest: best ? (SKILL_LABEL[best.no] ?? best.skill) : null,
    // Greg's own normalization, straight off the score — no second arithmetic here, so the number a member reads
    // is the number the instrument computed.
    //
    // NULL WHEN THE STORED READING PREDATES IT, and that is not defensiveness for its own sake: `meta` was added
    // to the score after the first readings were written, so a member scored before it exists has a row with no
    // meta block. Reading it blind threw and took the WHOLE read card down — the map, the lead line, the twelve
    // rows — for a member whose only fault was being early. Same degrade posture as the rest of this file: a
    // missing part costs that part, never the surface.
    profile: hasProfile(score)
      ? {
          meta: {
            predisposing: score.meta.predisposing.pct,
            enabling: score.meta.enabling.pct,
            reinforcing: score.meta.reinforcing.pct,
          },
          movement: score.activity.pct,
          eating: score.diet.pct,
        }
      : null,
  };
}

/**
 * The lead line — the one sentence that makes the map worth opening. It names the shape, which is exactly what Greg
 * says the family grouping is for. Declarative: it says where practice pays, and does not tell the member how not
 * to read it.
 */
export function mapLead(map: SkillsMap): string {
  // The strongest SKILL leads when we have it — it is the most specific thing the instrument knows about them, and
  // the family shape is the frame around it rather than a replacement for it.
  const best = map.strongest ? `${map.strongest} is your strongest single skill. ` : '';
  if (!map.thinnest || !map.steadiest) {
    return `${best}Your three families read evenly. The skills below are the ones with the most room.`;
  }
  // THE PROSE USES THE GLOSS; THE HEADINGS USE GREG'S TERM. Swapping the labels to his constructs produced "You
  // are steadiest at predisposing", which is not a sentence anyone says — the construct is a noun phrase ("the
  // Predisposing skills"), not something you can be steadiest AT. Greg's own teaching copy never does it either:
  // he writes "The Predisposing skills are about getting ready to change." The b2-map walk caught this the minute
  // the names changed, which is what that walk is for.
  const steady = FAMILY_LABEL[map.steadiest].gloss;
  const thin = FAMILY_LABEL[map.thinnest];
  // Name the thin family ONCE. The first version interpolated it twice and read "Staying with it is the thinnest
  // of the three — staying with it is where practice would pay most" — which no test caught and the screenshot did.
  return `${best}You are steadiest at ${steady}. The ${thin.name} skills — ${thin.gloss} — are the thinnest of the three, and where practice would pay most.`;
}
