// The Doors — canonical set, locked to the pitch deck (docs/CONTRACTS.md §3) + the taxonomy spec.
// v1.0 (Jun 2026): The Grind and The Load-Bearer added; The Vanishing tightened.
// v2.0 (Jun 30 2026): The Acceptance added (#12).
// v3.0 (Aug 15 2026): The Acceptance RETIRED as a Door (Decision C, Jay). It was a stance in a taxonomy of
// events, and no matcher can separate striving from surrender when both open with the same words. Its cues
// live on as RESIGNATION_CUES — an intake signal only, never a label. The `door` table keeps its row so
// existing member_door rows stay valid; the code simply never derives it. Do not reintroduce a hardcoded
// Door COUNT anywhere: it has been wrong twice, and the naming guard enforces it.
// Shared source of truth for the app and for validation. Mirrors the DB seed
// (supabase/seed/0001_reference_data.sql); the DB `door` table is the runtime source,
// this constant is for type-safety, validation, and seeding parity.
//
// A Door is the event OR the slow stretch where the Fade opened — descriptors accept both.
export const DOORS = [
  { slug: 'career_cliff',  displayName: 'The Career Cliff',  descriptor: 'The role that ended, plateaued, or hollowed out — a retirement that became a freefall.' },
  { slug: 'aging_parents', displayName: 'The Aging Parents', descriptor: 'The role reversal that made you the one doing the caring — for a parent.' },
  { slug: 'empty_nest',    displayName: 'The Empty Nest',    descriptor: 'The house that got quiet when the kids left.' },
  { slug: 'vanishing',     displayName: 'The Vanishing',     descriptor: 'The relational world that knew you slipping away — friendships, the social self, being known.' },
  { slug: 'body',          displayName: 'The Body',          descriptor: 'The body that started saying no to what it used to do easily.' },
  { slug: 'diagnosis',     displayName: 'The Diagnosis',     descriptor: 'The mirror moment you couldn’t look away from.' },
  // RENAMED 2026-08-18 (Donna, ruled by Jay): 'The Marriage' → 'The Relationship'. This RESTORES Greg's own
  // name — Gated Assets V4 calls it The Relationship Door, and Cowork's crosswalk renamed it while claiming to keep
  // his copy. The card contradicted itself: titled Marriage, opening "A relationship ended". His own examples are
  // broader than marriage ("divorce, estrangement, the slow erosion of a marriage" — estrangement covers an adult
  // child or a sibling), and Marriage left an unmarried partnership of twenty years with nowhere to stand. The
  // SLUG stays `marriage`: display name and slug are separate on purpose, as with connect_* vs "the Community".
  { slug: 'marriage',      displayName: 'The Relationship',  descriptor: 'The drift from partnership into just coexisting.' },
  { slug: 'loss',          displayName: 'The Loss',          descriptor: 'Losing someone close, and everything changing after.' },
  { slug: 'full_house',    displayName: 'The Full House',    descriptor: 'The active-family season — marriage, young kids, everyone needing you — and no space left for yourself.' },
  { slug: 'grind',         displayName: 'The Grind',         descriptor: 'The work or ambition that grew until it crowded out the person underneath.' },
  { slug: 'load_bearer',   displayName: 'The Load-Bearer',   descriptor: 'Becoming the one who carries everyone — the household, the money, the needs — until there’s no room left for you.' },
] as const;

export type DoorSlug = (typeof DOORS)[number]['slug'];

export const DOOR_SLUGS: readonly DoorSlug[] = DOORS.map((d) => d.slug);

export function isDoorSlug(value: unknown): value is DoorSlug {
  return typeof value === 'string' && DOOR_SLUGS.includes(value as DoorSlug);
}

const shortName = (displayName: string) => displayName.toLowerCase().replace(/^the\s+/, ''); // "career cliff"

// Match a Door NAME word-bounded, so a name never fires inside a larger word ("body" in "anybody",
// "loss" in "job loss"). Names contain no regex-special chars in practice, but escape defensively.
const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const wordInText = (needle: string, haystack: string) =>
  new RegExp(`\\b${needle.replace(RE_ESCAPE, '\\$&')}\\b`).test(haystack);

// Plain-language phrases that map to a Door when the member describes it in their own words (the
// safety-net matcher; the live agent maps richer stories itself). Keyed only where the Door's title
// isn't itself likely to appear — e.g. someone says "had kids", never "the full house".
const DOOR_ALIASES: Partial<Record<DoorSlug, string[]>> = {
  full_house: ['young kids', 'had kids', 'having kids', 'new baby', 'raising kids', 'small kids', 'little kids', 'new family', 'providing', 'provider'],
  // Caregiving-for-a-parent, in their own words (kept precise — needs a caregiving verb or an elderly marker,
  // so a passing "my mom" doesn't trip it). This was the missed Door in testing.
  aging_parents: [
    'caring for my mom', 'caring for my mother', 'caring for my dad', 'caring for my father', 'caring for my parent', 'caring for my parents',
    'caring for a parent', 'caring for an aging', 'caring for an elderly', 'taking care of my mom', 'taking care of my mother',
    'taking care of my dad', 'taking care of my father', 'taking care of my parent', 'take care of my mom', 'take care of my mother',
    'look after my mom', 'look after my mother', 'aging parent', 'aging mother', 'aging father', 'elderly parent', 'elderly mother',
    'elderly father', 'my mother took over', 'my mom took over', 'year old mom', 'year old mother', 'year old dad', 'year old father',
    // A parent's health crisis / decline (parent-anchored so a passing "my mom" doesn't trip it).
    'father went into a coma', 'mother went into a coma', 'dad went into a coma', 'mom went into a coma', 'parent went into a coma',
    "father's health", "mother's health", "dad's health", "mom's health", "parent's health", "parents' health",
    'father is declining', 'mother is declining', 'parent is declining', 'parents are declining', "father's decline", "mother's decline",
    'my father got sick', 'my mother got sick', 'my dad got sick', 'my mom got sick', 'father in the hospital', 'mother in the hospital',
  ],
  // Career Cliff = the role ENDED or shrank (subtraction). The role that GREW over you is The Grind.
  career_cliff: ['laid off', 'layoff', 'lay-off', 'lost my job', 'got let go', 'forced out', 'stepped down', 'the role ended', 'plateaued', 'retirement', 'restructure', 'pushed out'],
  empty_nest: ['empty nest', 'kids moved out', 'kids left home', 'kids are grown', 'last one left', 'off to college', 'house got quiet'],
  loss: ['passed away', 'lost my husband', 'lost my wife', 'lost my partner', 'death of', 'when he died', 'when she died'],
  diagnosis: ['diagnosed', 'the diagnosis', 'my diagnosis'],
  marriage: ['divorce', 'divorced', 'separated', 'my marriage ended'],
  vanishing: ['friends drifted', 'lost touch', 'friendships faded', 'friends slipped away', 'no close friends', 'stopped being known'],
  // The Grind = work/ambition that GREW until it crowded out the self (addition: took over, consumed).
  grind: ['work took over', 'took over my life', 'crazy hours', 'longer hours', 'bigger job', 'more responsibility', 'grew bigger', 'global team', 'consumed me', 'all-consuming', 'work became everything', 'no room left for', 'ate everything', 'the grind'],
  // The Load-Bearer = carrying everyone's load (household/money/needs), outside parent-care or the
  // active-family season — incl. a partner's abdicated share.
  load_bearer: ['carrying everyone', 'carry everyone', 'carry the load', 'carrying the load', 'held the financial', 'hold everything together', 'holding everything together', 'everyone leans on me', 'everyone needs me', 'on my shoulders', 'fell on me', 'more than my fair share', 'carry more than', 'left me holding', 'the one holding everything', 'carrying the household', 'do it all', 'sole breadwinner', 'breadwinner', 'sole earner', 'the only earner', 'paying all the bills', 'all the bills fell', 'carried us financially', 'kept us afloat', "didn't step up"],
};

/**
 * RESIGNATION — a real Fade signal, and NOT a Door (Decision C, Jay 2026-08-15).
 *
 * This list used to be `DOOR_CUES.acceptance`. The Acceptance was the only entry in a taxonomy of EVENTS that
 * was a STANCE — the other eleven are things that happened to someone, this was something they concluded — and
 * the category error is why it could never be matched reliably. Striving and surrender open with identical
 * words: "I'm not as young as I used to be" begins both.
 *
 * It fired on Donna's "at my age and in this economy, I was virtually unhireable" — a woman describing being
 * shut out of the job market, told by the product that she had quietly surrendered to aging. Six of seven
 * ordinary midlife sentences tripped it, including "I'm past my prime BUT I REFUSE TO ACCEPT THAT".
 *
 * WHAT IT IS STILL GOOD AT, and why the cues are kept verbatim rather than deleted: recognising that a resigned
 * member has a REAL Fade and must be admitted (the Stage-0 gate, onboarding-staged.ts). That job never needed a
 * Door — it needed a yes/no. Same cues, same admissions, no label. See docs/acceptance-door-retirement.md.
 *
 * Deliberately NOT narrowed to the "surrender only" subset. Narrowing it would tighten intake, which is a
 * separate decision nobody has made, and the quietest members we have are the ones it would turn away.
 */
export const RESIGNATION_CUES: readonly string[] = [
  'getting older', 'at my age', 'just my age', 'past my prime', 'not as young as i used to be',
  'not as capable', 'slowing down', 'downhill from here', 'it is what it is', 'made peace with',
  'accepted that', 'this is just who i am now', 'my best years are behind me',
  'what do you expect at my age', 'these things happen when you get older', 'resigned myself',
  'settled for less', 'settled for this',
];

/** Does this read as resignation to age-decline? The intake signal — never a Door, never shown to a member. */
export function hasResignationLanguage(message: string): boolean {
  const m = (message || '').toLowerCase().replace(/[‘’]/g, "'");
  return RESIGNATION_CUES.some((c) => m.includes(c));
}

// Bereavement pattern for The Loss (used in matchDoors) — losing a parent/family member/loved one, or a
// summary of stacking losses. A loved-one object (not "job"/"weight") keeps it specific enough that "lost my
// job" / "weight loss" never trip it, which is why the bare word "loss" itself stays alias-only. Tested against
// the already-lowercased, apostrophe-normalized message, so no /i needed.
const BEREAVEMENT_LOSS =
  /\blost (my|his|her|their|our) (dad|mom|mum|mother|father|parent|parents|son|daughter|child|children|kid|brother|sister|sibling|husband|wife|partner|spouse|grandmother|grandfather|grandma|grandpa|best friend|friend)\b|\b(my|his|her|their|our) (dad|mom|mum|mother|father|parent|parents|son|daughter|child|brother|sister|sibling|husband|wife|partner|spouse|grandmother|grandfather|grandma|grandpa) (died|passed away|passed)\b|\b(a )?(decade|year|years|lifetime) of (stacking )?loss(es)?\b|\bstacking losses\b/;

// Map a member's free-text answer to one or more Doors (voice rewrite v1: members answer in their
// own words; the agent maps silently). Matches by slug, full/short display name, or a 1–8 number;
// returns canonical-ordered, de-duplicated slugs. Empty array means nothing recognized → re-ask.
export function matchDoors(message: string): DoorSlug[] {
  // Normalize curly apostrophes → straight, so aliases written with ' ("didn't step up") match the model's
  // curly output ("didn’t step up"). This silently dropped load_bearer for rita (her financial-load phrasing
  // never matched, so the precedence rule deleted it alongside aging_parents).
  const m = (message || '').toLowerCase().replace(/[‘’]/g, "'");
  const found = new Set<DoorSlug>();
  // The Body is read from the member's OWN physical language, computed once. A
  // NAMED physical event/change (knees, bad back, an injury, can't do X, "throw my back out", "wear and tear") is
  // The Body; a bare "settled" framing is The Acceptance. Promoting the event language to a PRIMARY signal (not just
  // the old body-vs-acceptance tiebreaker) is what catches The Body when the literal word "body" is absent — milie's
  // walk tagged NO body from "my knee hurts, I can't run anymore, I throw my back out."
  const CONCRETE_PHYSICAL_EVENT =
    /\b(knees?|hips?|shoulders?|joints?|my back|bad (knee|back|hip|shoulder)|injur(y|ed|ies)|blew out|gave out|went out|surgery|torn|tore|sprained|can'?t (run|lift|walk|climb|play|keep up)|quit the sport|throw(s|ing)? my back out|threw my back out|wear and tear)\b/.test(m);
  // Numbered selection ("5", "1 and 3") maps to a Door by position — but ONLY when the whole message
  // IS a numeric pick. Otherwise an incidental number in prose ("3 walks a week", "lose 30 lbs") gets
  // misread as "pick Door 3" — which silently tagged Joanne with The Empty Nest (Door #3) from her
  // workout frequency. The conversational onboarding never shows a numbered menu, so this is rare.
  const isNumericSelection = /^[\s,]*[1-9]([\s,]+(and\s+)?[1-9])*[\s,]*$/.test(m.trim());
  if (isNumericSelection) {
    for (const numMatch of m.matchAll(/\b([1-9])\b/g)) {
      const idx = Number(numMatch[1]) - 1;
      if (DOORS[idx]) found.add(DOORS[idx]!.slug);
    }
  }
  for (const d of DOORS) {
    const aliases = DOOR_ALIASES[d.slug] ?? [];
    if (aliases.some((a) => m.includes(a))) {
      found.add(d.slug);
      continue;
    }
    // The Loss is recognized ONLY by its death-specific aliases + the bereavement pattern below — the bare
    // word "loss" / "the loss" is too ambiguous in English ("job loss", "weight loss", "the loss of…").
    if (d.slug === 'loss') continue;
    // Otherwise match the Door's name (slug / short / full title), WORD-BOUNDED so "body" never fires
    // inside "anybody" and a name never matches mid-word.
    const names = [d.slug.replace(/_/g, ' '), shortName(d.displayName), d.displayName.toLowerCase()];
    if (names.some((n) => wordInText(n, m))) found.add(d.slug);
  }
  // The Loss, recognized from BEREAVEMENT language in the member's own words ("lost my dad", "lost her mom",
  // "a decade of stacking losses") — the death-specific aliases above miss losing a parent/family member, the
  // most common bereavement. Kept SPECIFIC to a loved-one object so it never over-tags "lost my job" / "weight
  // loss" (which is exactly why the bare word "loss" stays alias-only). First- and third-person (a summary of
  // the member's story can read "his"). This closed a real matcher gap (the Blake doorsToConfirm case).
  if (BEREAVEMENT_LOSS.test(m)) found.add('loss');
  // A named physical event is The Body even without the word "body" (see the const above). The Body/Acceptance
  // precedence below resolves the overlap when a "settled" stance ALSO fired.
  // A named physical event is The Body even without the word "body". It used to be suppressed by a settled
  // framing so the story could route to The Acceptance instead — with that Door retired there is nothing to
  // route to, and suppressing it would leave "my knee went out and I've made peace with it" with NO Door at
  // all. Her knee is the Door; what she concluded about it is not.
  if (CONCRETE_PHYSICAL_EVENT) found.add('body');
  // Precedence among LOAD doors (taxonomy spec §4): Aging Parents (parent care) and Full House
  // (active-family season) own their load; The Load-Bearer is the catch-all for OTHER load, so it
  // yields to them — it never redundantly re-tags a load a specific Door already owns. (Genuine
  // multi-load is the model's call via record_progress; this is only the gap-only backstop matcher.)
  // EXCEPTION: an explicit FINANCIAL/breadwinner load is a load those Doors do NOT own — keep it even
  // alongside them (rita: caring for a parent AND being the sole breadwinner are two distinct loads).
  // A financial/spousal load is one Aging Parents / Full House do NOT own. Includes the explicit breadwinner
  // language AND a partner abdicating the share (the load fell to me) — both clearly distinct from parent-care.
  const STRONG_FINANCIAL_LOAD =
    /\b(breadwinner|sole (earner|provider)|the only earner|all the bills|paying all the bills|carried us financially|kept us afloat|held the financial|did(n'?t| not) step up|wouldn'?t step up|savings (are |were |is )?(gone|going|wiped)|house (is |was )?at risk|lose the house|losing the house)\b/.test(m);
  if (found.has('load_bearer') && (found.has('aging_parents') || found.has('full_house')) && !STRONG_FINANCIAL_LOAD) {
    found.delete('load_bearer');
  }
  return DOORS.filter((d) => found.has(d.slug)).map((d) => d.slug);
}

// Guard the model's most common Door mix-up: a marriage + young-kids + load-bearer story is The Full
// House — NOT the later-life Empty Nest (kids grew up and left) or Aging Parents (caring for your own
// parents). When the narrative clearly signals the Full House and those siblings carry no signal of
// their own, correct them. Conservative: it only ever fires on a clear Full House story.
export function correctDoors(doors: DoorSlug[], narrative: string): DoorSlug[] {
  const m = (narrative || '').toLowerCase();
  // Full House is present if it's ALREADY tagged (the model called note_door), or the narrative signals it.
  // Including the already-tagged set is what lets us correct the model's most common mix-up even when the
  // narrative words don't themselves carry a full-house keyword (Jay's walk: kids getting older/busier at home
  // got tagged BOTH full_house AND empty_nest — contradictory; empty_nest is the mis-tag).
  const fullHouseSignal =
    doors.includes('full_house') ||
    matchDoors(m).includes('full_house') ||
    /\b(had kids|having kids|when we had|after (we )?had kids|after kids|young kids|small kids|little kids|new baby|babies|a toddler|raising (the |our )?kids)\b/.test(m);
  const emptyNestSignal = /\b(empty nest|moved out|left (home|the house|the nest)|kids? (are )?(grown|gone|all gone|all left|out of the house)|off to college|last one (gone|left))\b/.test(m);

  const set = new Set<DoorSlug>(doors);
  if (fullHouseSignal) {
    // CAT-07 — SETTLED (Jay, 2026-08-13): "Yes they can coexist, completely different things."
    //
    // Full House used to delete Aging Parents unless parent-care language appeared in the SAME message. The
    // comment here already named the cost — a member who names a parent's decline in one turn and young kids in
    // another loses the Door they named — and then it did exactly that to Jay on his own account: The Marriage ·
    // The Full House · The Grind on his record, and the mother he cares for nowhere.
    //
    // A young family and a declining parent are two different loads, and carrying both at once is the most
    // common midlife shape there is. The rule went in to fix a mis-tag on Scott's walk; a WRONG Aging Parents
    // tag is a mis-tag to fix where it is made, not something to solve by deleting a Door a member named. Losing
    // a Door someone gave you is the worse failure — it is silent, and the member cannot tell it happened.
    //
    // Empty Nest still yields: the house is either full or it is empty, so those two genuinely cannot both hold.
    if (!emptyNestSignal) set.delete('empty_nest');
    set.add('full_house');
  }
  return DOORS.filter((d) => set.has(d.slug)).map((d) => d.slug);
}
