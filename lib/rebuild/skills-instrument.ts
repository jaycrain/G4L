// B2 · "Appreciating Your Strengths and Weaknesses" — the Rebuild Structure asset (Greg's Gated Assets V4). A
// 12-skill self-management assessment, each skill rated SEPARATELY for physical activity and diet → 24 items on a
// 4-point scale (1 = strongly disagree → 4 = strongly agree). Item stems are Greg's VERBATIM science — frozen, never
// reworded EXCEPT bare transcription grammar typos, corrected member-facing (Jay's proof pass 2026-07-23, meaning
// unchanged — Jay confirmed these ride without Greg sign-off): #5 "perform a physical activities" → "perform physical activities"; #6 activity
// "efforts to being active" → "efforts to be active"; #11 diet "buy prepare nutritious food" → "buy and prepare …".
//
// Stored as a self-management skill profile (its own register, self_management_reading / 0051) — used later by the
// B4 Structure check and by future cycles. Unlike B1 (RB-1 no-display), B2's profile is reflective material the
// member can see; we reflect it back in PLAIN LANGUAGE at the close (strongest skill + growth edge, per domain),
// never a table of 24 bare numbers (governance: never a bare number, used to help them understand themselves).

export type SkillDomain = 'activity' | 'diet';
// The 3 meta-categories Greg groups the 12 skills into (by skill number, 1-based).
export type SkillMeta = 'predisposing' | 'enabling' | 'reinforcing';

export type SkillItem = { code: string; skillNo: number; skill: string; domain: SkillDomain; meta: SkillMeta; stem: string };

// THREE STEMS DIFFER FROM GREG'S GATED ASSETS V4, AND ALL THREE ARE GRAMMAR REPAIRS. Recorded because a silent
// correction to an expert's instrument is indistinguishable from a transcription error, and the next person to
// diff this against his document should not have to work out which it was (Jay, 2026-08-26 — he asked, and it
// cost an hour to answer):
//
//   B2-PA5   his: "I possess skills needed to perform a physical activities I enjoy"   ← stray article
//   B2-PA6   his: "I can stay positive about my efforts to being active"               ← verb form
//   B2-DI11  his: "I can manage time needed to buy prepare nutritious food"            ← missing conjunction
//
// Same construct, same domain, same direction in every case; nothing here moves what is measured. The other 21
// are verbatim. Same hand that wrote "dietarty" in the V5 canvas — these are working-document typos, not wording
// we disagreed with, and if he ever wants them back the originals are right here.

export const SKILLS_SCALE_MAX = 4; // 1 = strongly disagree → 4 = strongly agree
export const SKILLS_SCALE_ANCHORS = '1 (strongly disagree) to 4 (strongly agree)';

// Greg's meta-category grouping (skill numbers): Predisposing 6,7,12 · Enabling 1,3,4,5,8,11 · Reinforcing 2,9,10.
// Exported since 2026-08-17 for the member-facing map (skills-map.ts) — the grouping IS the read Greg asks for,
// so it has to be readable outside the scorer. Still the single source; nothing re-declares it.
export const META_BY_SKILL: Record<number, SkillMeta> = {
  1: 'enabling', 2: 'reinforcing', 3: 'enabling', 4: 'enabling', 5: 'enabling', 6: 'predisposing',
  7: 'predisposing', 8: 'enabling', 9: 'reinforcing', 10: 'reinforcing', 11: 'enabling', 12: 'predisposing',
};

// The 12 skills with their two verbatim sub-item stems (activity, then diet). Skill names from Greg's numbered list.
const SKILLS: { no: number; skill: string; activity: string; diet: string }[] = [
  { no: 1, skill: 'Self-assessment', activity: 'I can evaluate my needs related to fitness', diet: 'I can evaluate my needs related to nutrition' },
  { no: 2, skill: 'Self-monitoring', activity: 'I can self-monitor physical activity behavior', diet: 'I can self-monitor dietary behavior' },
  { no: 3, skill: 'Goal setting', activity: 'I can set goals for physical activity behaviors', diet: 'I can set goals for dietary behaviors' },
  { no: 4, skill: 'Self-planning', activity: 'I can create a physical activity plan to address my needs.', diet: 'I can create a dietary plan to address my needs.' },
  { no: 5, skill: 'Performance skills', activity: 'I possess skills needed to perform physical activities I enjoy', diet: 'I possess skills needed to select and prepare healthy foods' },
  { no: 6, skill: 'Balancing attitudes', activity: 'I can stay positive about my efforts to be active', diet: 'I can stay positive about my ability to eat healthy' },
  { no: 7, skill: 'Overcoming barriers', activity: 'I can overcome barriers to being physically active', diet: 'I can overcome barriers to following a healthy diet' },
  { no: 8, skill: 'Consumer skills', activity: 'I know how to find and interpret information related to physical activity and fitness', diet: 'I know how to find and interpret information related to nutrition and health' },
  { no: 9, skill: 'Social support', activity: 'I can obtain social support to help me be physically active', diet: 'I can obtain social support to help me maintain a healthy diet' },
  { no: 10, skill: 'Relapse prevention', activity: 'I can regain my commitment to regular physical activity', diet: 'I can regain my commitment to healthy eating practices' },
  { no: 11, skill: 'Time management', activity: 'I can manage time needed to stick with my physical activity plan', diet: 'I can manage time needed to buy and prepare nutritious food' },
  { no: 12, skill: 'Building confidence and motivation', activity: 'I have the discipline to stick with my physical activity plans', diet: 'I have the discipline to stick with my healthy eating plans' },
];

// 24 items in administration order: all 12 ACTIVITY skills (1–12), then all 12 DIET skills (1–12). Domain-chunked
// (RB-7 lean: "chunk activity/diet into two passes") — one clean transition, matches B1's activity→eating rhythm.
export const SKILL_ITEMS: SkillItem[] = [
  ...SKILLS.map((s): SkillItem => ({ code: `B2-PA${s.no}`, skillNo: s.no, skill: s.skill, domain: 'activity', meta: META_BY_SKILL[s.no]!, stem: s.activity })),
  ...SKILLS.map((s): SkillItem => ({ code: `B2-DI${s.no}`, skillNo: s.no, skill: s.skill, domain: 'diet', meta: META_BY_SKILL[s.no]!, stem: s.diet })),
];

export const SKILLS_ITEM_COUNT = SKILL_ITEMS.length; // 24
export const SKILLS_DOMAIN_SPLIT = 12; // 0-based index where the diet pass begins (the domain-transition frame)

export type SkillDomainScore = { sum: number; max: number; pct: number }; // sum of the 12 items, out of 48
export type SkillMetaScore = { sum: number; max: number; pct: number }; // across both domains
export type SkillScore = {
  activity: SkillDomainScore;
  diet: SkillDomainScore;
  perSkill: { no: number; skill: string; activity: number; diet: number; mean: number }[];
  meta: Record<SkillMeta, SkillMetaScore>;
};

/**
 * A share of the maximum, and it CANNOT leave 0-100.
 *
 * It used to be the bare arithmetic, and a dev fixture carrying 5s on this four-point instrument produced a
 * category reading 125% (2026-08-26). Nothing caught it for weeks because no surface displayed the figure — the
 * fault was invisible until Greg's profile block put the number in front of a member.
 *
 * Clamped rather than thrown: this runs inside a member's Session close, and an impossible percentage is a bad
 * number on a screen while an exception is a lost B2. Logged, though — a clamp that fires is always a fault
 * upstream, and a silent clamp would just move the invisibility one layer down.
 */
const pct = (sum: number, max: number): number => {
  const raw = Math.round((sum / max) * 100);
  if (raw < 0 || raw > 100) {
    console.error(`skills pct out of range (${sum}/${max} → ${raw}%) — responses outside the 1–${SKILLS_SCALE_MAX} scale`);
    return Math.max(0, Math.min(100, raw));
  }
  return raw;
};

// Score the 24 responses (administration order) into per-domain totals (%), a per-skill profile (activity + diet +
// their mean), and the 3 meta-category totals. Greg's math: 4-point items, per-domain sum out of 48, normalized to a
// percentage; meta-categories aggregate their member skills across both domains.
export function scoreSkills(responses: number[]): SkillScore {
  if (responses.length !== SKILLS_ITEM_COUNT) {
    throw new Error(`scoreSkills expects ${SKILLS_ITEM_COUNT} responses, got ${responses.length}`);
  }
  const val = (code: string): number => responses[SKILL_ITEMS.findIndex((it) => it.code === code)]!;
  const domainSum = (domain: SkillDomain): number =>
    SKILL_ITEMS.reduce((acc, it, i) => (it.domain === domain ? acc + responses[i]! : acc), 0);

  const perSkill = SKILLS.map((s) => {
    const a = val(`B2-PA${s.no}`);
    const d = val(`B2-DI${s.no}`);
    return { no: s.no, skill: s.skill, activity: a, diet: d, mean: Math.round(((a + d) / 2) * 100) / 100 };
  });

  const metaSums: Record<SkillMeta, { sum: number; n: number }> = {
    predisposing: { sum: 0, n: 0 }, enabling: { sum: 0, n: 0 }, reinforcing: { sum: 0, n: 0 },
  };
  SKILL_ITEMS.forEach((it, i) => {
    metaSums[it.meta].sum += responses[i]!;
    metaSums[it.meta].n += 1;
  });
  const meta = Object.fromEntries(
    (Object.keys(metaSums) as SkillMeta[]).map((k) => {
      const max = metaSums[k].n * SKILLS_SCALE_MAX;
      return [k, { sum: metaSums[k].sum, max, pct: pct(metaSums[k].sum, max) }];
    }),
  ) as Record<SkillMeta, SkillMetaScore>;

  const domainScore = (domain: SkillDomain): SkillDomainScore => {
    const sum = domainSum(domain);
    const max = 12 * SKILLS_SCALE_MAX; // 48
    return { sum, max, pct: pct(sum, max) };
  };

  return { activity: domainScore('activity'), diet: domainScore('diet'), perSkill, meta };
}

// The strongest skill + the growth edge (lowest), by the two-domain mean — the plain-language reflection at the close
// (never a table of numbers). Ties break to the lower skill number (stable). Returns the skill NAMES.
/**
 * THE MEMBER'S WORDS FOR EACH SKILL. Greg's names are the CONSTRUCT ("Consumer skills", "Relapse prevention");
 * these are what a person would call the same thing.
 *
 * MOVED HERE 2026-08-23, from skills-map.ts, because the product was speaking two languages about one thing. The
 * member RATED "Consumer skills", the Session close told her "consumer skills is a strength of yours", the
 * Companion said the same — and then her Playbook map called it "Finding good information". Same skill, three
 * surfaces in Greg's construct language and one in hers, with nothing anywhere connecting them.
 *
 * The construct names are untouched: they stay on SkillItem.skill, in the codes, and in every stored score, which
 * is what Greg reads. Only what a MEMBER hears changes. The rated stems are verbatim either way, so nothing about
 * the instrument or its scoring moves.
 */
export const SKILL_LABEL: Record<number, string> = {
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

/** What a member should hear this skill called. Falls back to the construct name rather than rendering nothing. */
export function skillLabel(no: number, fallback: string): string {
  return SKILL_LABEL[no] ?? fallback;
}

/**
 * THE ONE PLACE THAT DECIDES WHICH SKILL IS THE STRONGEST. Returns the row, not just its label.
 *
 * Extracted 2026-08-26 for a reason worth keeping. B2's close named a strength and told the member to "notice
 * when a strong skill carries you"; the practice grid then rendered only growth edges, so half of what she was
 * told to watch had nowhere to be recorded. Adding a strength row to the grid meant a SECOND piece of code
 * deciding "strongest" — and two selectors for one fact is precisely the shape that produced the mismatch. The
 * close and the grid now read the same function, so they cannot disagree about the member.
 */
export function strongestSkill(score: SkillScore): SkillScore['perSkill'][number] {
  // Highest mean wins; ties break by item number so the answer is stable across re-scores of identical data.
  return [...score.perSkill].sort((a, b) => b.mean - a.mean || a.no - b.no)[0]!;
}

/**
 * THE MEMBER'S OWN MIDPOINT — the median of THEIR twelve means, which is what divides steady from growing.
 *
 * Hoisted here 2026-08-27 so the skills map and the growing-edge ranking cannot drift apart on the definition of
 * "below your own middle". A fixed cutoff would import an external standard, which is the one thing this read must
 * not do; see the fuller note in skills-map.ts, which now reads this.
 */
export function steadyMidpoint(score: SkillScore): number {
  const means = score.perSkill.map((s) => s.mean).sort((a, b) => a - b);
  return (means[5]! + means[6]!) / 2;
}

/**
 * THE ONE GROWING-EDGE RANKING — thinnest first. The B2 close names `growingEdges(score)[0]`; the practice grid
 * tracks the whole set. Same function, so they cannot disagree about the member.
 *
 * WHY IT EXISTS (Q23, found 2026-08-27 by a property test over 5,000 profiles). The close and the grid each ranked
 * the skills themselves, and they broke TIES in opposite directions: the close sorted DESCENDING and took the last
 * element, the grid sorted ASCENDING and took the first three. Identical data, opposite answers.
 *
 * On a 1–4 scale with two items per skill there are only seven possible means, so ties at the bottom are the norm
 * rather than an edge case — four skills tied at 2.00 in the first failing profile. The member was told "the skill
 * with the most room to grow is asking people for support" and handed a week tracking the other three. It hit
 * **5.6% of profiles**, silently, and no fixture caught it because a fixture picks numbers that do not tie.
 *
 * The lesson is the one this file already records one function up: two selectors for one fact is the shape.
 * `strongestSkill` was hoisted for exactly this reason in August and the growth edge was left behind.
 */
export function growingEdges(score: SkillScore, limit = 3): SkillScore['perSkill'] {
  const mid = steadyMidpoint(score);
  return [...score.perSkill]
    .filter((s) => s.mean < mid)
    .sort((a, b) => a.mean - b.mean || a.no - b.no)
    .slice(0, limit);
}

export function skillHighlights(score: SkillScore): { strongest: string; growthEdge: string } {
  // THE MEMBER'S WORDS, not the construct. This feeds the B2 close ("... is a strength of yours") and the
  // Companion's MEMBER CONTEXT, both of which were saying "consumer skills" to a person.
  const top = strongestSkill(score);
  // A uniformly flat profile has nothing below its own middle, so there is no edge to name and the grid degrades
  // to its generic row. Fall back to the plain lowest so the close still says something true.
  const ranked = [...score.perSkill].sort((a, b) => b.mean - a.mean || a.no - b.no);
  const bottom = growingEdges(score, 1)[0] ?? ranked[ranked.length - 1]!;
  return { strongest: skillLabel(top.no, top.skill), growthEdge: skillLabel(bottom.no, bottom.skill) };
}

// The per-item response map (code → value) stored alongside the computed scores, so a re-score from raw is always
// possible (same posture as grinta_reading / motivation_reading).
export function skillResponsesMap(responses: number[]): Record<string, number> {
  const map: Record<string, number> = {};
  SKILL_ITEMS.forEach((it, i) => {
    if (responses[i] != null) map[it.code] = responses[i]!;
  });
  return map;
}
