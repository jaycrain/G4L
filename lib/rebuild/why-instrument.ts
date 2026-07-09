// B1 · "What is Your Why?" — the Rebuild Foundation asset (Greg's Gated Assets V4). A 12-item Self-Determination
// (SDT) instrument on a 1–7 scale: six items per domain, physical activity first, then healthy eating. The item
// stems are Greg's VERBATIM science — frozen, never reworded (same discipline as the IDQ / the Grinta Commitment
// items). Only the frames around them (intro, domain transition, close) are ours.
//
// This is a PARALLEL motivation register — like the ID Score is its own register, "your why" is stored and retaken
// quarterly and is NEVER folded into the Grinta 1–5 math. Per RB-1 the numeric profile is stored but NOT displayed
// in v2.4: a lone snapshot has no comparison, and a raw read of "controlled / amotivation" could deflate a member at
// the start of the hardest Phase. The member gets the reflective experience + a forward-looking reflection now; the
// scored profile waits for the quarterly re-read / Cycle 2, when a second snapshot exists to measure against.

export type WhyDomain = 'activity' | 'diet';
export type SdtFacet = 'autonomous' | 'controlled' | 'amotivation';

export type WhyItem = { code: string; domain: WhyDomain; facet: SdtFacet; stem: string };

// The two domain prompts (Greg's, verbatim) — shown once as the header before each domain's six items.
export const WHY_PROMPTS: Record<WhyDomain, string> = {
  activity: 'Why do you want to be physically active regularly?',
  diet: 'Why do you want to eat healthier?',
};

export const WHY_SCALE_MAX = 7; // 1 = Not at all true for me → 7 = Very true for me

// The 12 items, in administration order (activity 1–6, then diet 7–12). facet + domain drive scoring; stems verbatim.
export const WHY_ITEMS: WhyItem[] = [
  { code: 'B1-PA1', domain: 'activity', facet: 'autonomous', stem: 'I want to be physically active because it is personally important to me.' },
  { code: 'B1-PA2', domain: 'activity', facet: 'autonomous', stem: 'I want to be physically active because being active fits the kind of person I want to be.' },
  { code: 'B1-PA3', domain: 'activity', facet: 'autonomous', stem: 'I want to be physically active because I enjoy it or feel good when I do it.' },
  { code: 'B1-PA4', domain: 'activity', facet: 'controlled', stem: 'I want to be physically active because I would feel guilty if I did not.' },
  { code: 'B1-PA5', domain: 'activity', facet: 'controlled', stem: 'I want to be physically active because other people expect me to.' },
  { code: 'B1-PA6', domain: 'activity', facet: 'amotivation', stem: 'I do not really see why I should be physically active regularly.' },
  { code: 'B1-DI1', domain: 'diet', facet: 'autonomous', stem: 'I want to eat healthier because it is personally important to me.' },
  { code: 'B1-DI2', domain: 'diet', facet: 'autonomous', stem: 'I want to eat healthier because it fits the kind of person I want to be.' },
  { code: 'B1-DI3', domain: 'diet', facet: 'autonomous', stem: 'I want to eat healthier because I enjoy taking care of my body.' },
  { code: 'B1-DI4', domain: 'diet', facet: 'controlled', stem: "I want to eat healthier because I would feel guilty if I didn't." },
  { code: 'B1-DI5', domain: 'diet', facet: 'controlled', stem: 'I want to eat healthier because other people expect me to.' },
  { code: 'B1-DI6', domain: 'diet', facet: 'amotivation', stem: "I don't really know why I should eat healthier." },
];

export const WHY_ITEM_COUNT = WHY_ITEMS.length; // 12
export const WHY_DOMAIN_SPLIT = 6; // 0-based index where the diet domain begins (the domain-transition frame)

export type WhyDomainScore = { autonomous: number; controlled: number; amotivation: number };
export type WhyScore = { activity: WhyDomainScore; diet: WhyDomainScore };

const mean = (ns: number[]): number => Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 100) / 100;

// Score the 12 responses (administration order) into the two domain profiles — Greg's scoring, exactly:
//   autonomous  = mean of the 3 autonomous items
//   controlled  = mean of the 2 controlled items
//   amotivation = the single amotivation item
// computed SEPARATELY for activity and diet. (Greg's sheet notes a "Relative" autonomy figure but gives no formula;
// it is deliberately HELD for Greg rather than invented — we store the three canonical subscores, not a guessed RAI.)
export function scoreWhy(responses: number[]): WhyScore {
  if (responses.length !== WHY_ITEM_COUNT) {
    throw new Error(`scoreWhy expects ${WHY_ITEM_COUNT} responses, got ${responses.length}`);
  }
  const facetValues = (domain: WhyDomain, facet: SdtFacet): number[] =>
    WHY_ITEMS.map((it, i) => ({ it, v: responses[i]! }))
      .filter(({ it }) => it.domain === domain && it.facet === facet)
      .map(({ v }) => v);
  const domainScore = (domain: WhyDomain): WhyDomainScore => ({
    autonomous: mean(facetValues(domain, 'autonomous')),
    controlled: mean(facetValues(domain, 'controlled')),
    amotivation: mean(facetValues(domain, 'amotivation')),
  });
  return { activity: domainScore('activity'), diet: domainScore('diet') };
}

// The per-item response map (code → value), stored alongside the computed subscores so a re-score is always possible
// from raw data (same posture as grinta_reading.responses). Order-independent by keying on the item code.
export function whyResponsesMap(responses: number[]): Record<string, number> {
  const map: Record<string, number> = {};
  WHY_ITEMS.forEach((it, i) => {
    if (responses[i] != null) map[it.code] = responses[i]!;
  });
  return map;
}
