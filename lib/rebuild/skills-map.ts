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

import { META_BY_SKILL, type SkillMeta, type SkillScore } from './skills-instrument.ts';

/** The three families in Greg's order — getting ready → taking action → staying with it. */
export const FAMILY_ORDER: SkillMeta[] = ['predisposing', 'enabling', 'reinforcing'];

/** Member-facing family names. Greg's terms are the science; these are what a member reads. */
export const FAMILY_LABEL: Record<SkillMeta, { name: string; gloss: string }> = {
  predisposing: { name: 'Getting ready', gloss: 'what gets you to the starting line' },
  enabling: { name: 'Taking action', gloss: 'what turns intention into a week' },
  reinforcing: { name: 'Staying with it', gloss: 'what keeps it going after the first miss' },
};

/** Plain-language skill names. The instrument's own labels are the construct; these are the member's words. */
const SKILL_LABEL: Record<number, string> = {
  1: 'Sizing up what you need',
  2: 'Watching how it is going',
  3: 'Setting goals',
  4: 'Making a plan',
  5: 'The practical know-how',
  6: 'Staying positive about your efforts',
  7: 'Overcoming barriers',
  8: 'Finding good information',
  9: 'Asking people for support',
  10: 'Getting back on after a slip',
  11: 'Managing your time',
  12: 'Confidence and motivation',
};

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
};

/**
 * A gap worth mentioning between movement and eating on one skill. The instrument is 1–5 per domain, so a
 * difference of 2+ is a real split rather than a rounding wobble; below that, saying it would manufacture a
 * distinction the member did not make.
 */
const DIVERGENCE_MIN = 2;

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
  const steady = FAMILY_LABEL[map.steadiest].name.toLowerCase();
  // Name the thin family ONCE. The first version interpolated it twice and read "Staying with it is the thinnest
  // of the three — staying with it is where practice would pay most" — which no test caught and the screenshot did.
  return `${best}You are steadiest at ${steady}. ${FAMILY_LABEL[map.thinnest].name} is the thinnest of the three, and where practice would pay most.`;
}
