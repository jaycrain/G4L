// B2 · "Appreciating Your Strengths and Weaknesses" — the Rebuild Structure asset (Greg's Gated Assets V4). A
// 12-skill self-management assessment, each skill rated SEPARATELY for physical activity and diet → 24 items on a
// 4-point scale (1 = strongly disagree → 4 = strongly agree). Item stems are Greg's VERBATIM science — frozen, never
// reworded EXCEPT bare transcription grammar typos, corrected member-facing (Jay's proof pass 2026-07-23; meaning
// unchanged, pending Greg confirm): #5 "perform a physical activities" → "perform physical activities"; #6 activity
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

export const SKILLS_SCALE_MAX = 4; // 1 = strongly disagree → 4 = strongly agree
export const SKILLS_SCALE_ANCHORS = '1 (strongly disagree) to 4 (strongly agree)';

// Greg's meta-category grouping (skill numbers): Predisposing 6,7,12 · Enabling 1,3,4,5,8,11 · Reinforcing 2,9,10.
const META_BY_SKILL: Record<number, SkillMeta> = {
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

const pct = (sum: number, max: number): number => Math.round((sum / max) * 100);

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
export function skillHighlights(score: SkillScore): { strongest: string; growthEdge: string } {
  const ranked = [...score.perSkill].sort((a, b) => b.mean - a.mean || a.no - b.no);
  return { strongest: ranked[0]!.skill, growthEdge: ranked[ranked.length - 1]!.skill };
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
