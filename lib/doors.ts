// The Doors — canonical set, locked to the pitch deck (docs/CONTRACTS.md §3) + the Jun 2026 taxonomy
// spec (G4L_Doors_Taxonomy_Spec_v1.0): The Grind and The Load-Bearer added; The Vanishing tightened.
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
  { slug: 'marriage',      displayName: 'The Marriage',      descriptor: 'The drift from partnership into just coexisting.' },
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
  ],
  // Career Cliff = the role ENDED or shrank (subtraction). The role that GREW over you is The Grind.
  career_cliff: ['laid off', 'lost my job', 'got let go', 'forced out', 'stepped down', 'the role ended', 'plateaued', 'retirement', 'restructure', 'pushed out'],
  empty_nest: ['empty nest', 'kids moved out', 'kids left home', 'kids are grown', 'last one left', 'off to college', 'house got quiet'],
  loss: ['passed away', 'lost my husband', 'lost my wife', 'lost my partner', 'death of', 'when he died', 'when she died'],
  diagnosis: ['diagnosed', 'the diagnosis', 'my diagnosis'],
  marriage: ['divorce', 'divorced', 'separated', 'my marriage ended'],
  vanishing: ['friends drifted', 'lost touch', 'friendships faded', 'friends slipped away', 'no close friends', 'stopped being known'],
  // The Grind = work/ambition that GREW until it crowded out the self (addition: took over, consumed).
  grind: ['work took over', 'took over my life', 'crazy hours', 'longer hours', 'bigger job', 'more responsibility', 'grew bigger', 'global team', 'consumed me', 'all-consuming', 'work became everything', 'no room left for', 'ate everything', 'the grind'],
  // The Load-Bearer = carrying everyone's load (household/money/needs), outside parent-care or the
  // active-family season — incl. a partner's abdicated share.
  load_bearer: ['carrying everyone', 'carry everyone', 'carry the load', 'carrying the load', 'held the financial', 'hold everything together', 'holding everything together', 'everyone leans on me', 'everyone needs me', 'on my shoulders', 'fell on me', 'more than my fair share', 'carry more than', 'left me holding', 'the one holding everything', 'carrying the household', 'do it all'],
};

// Map a member's free-text answer to one or more Doors (voice rewrite v1: members answer in their
// own words; the agent maps silently). Matches by slug, full/short display name, or a 1–8 number;
// returns canonical-ordered, de-duplicated slugs. Empty array means nothing recognized → re-ask.
export function matchDoors(message: string): DoorSlug[] {
  const m = (message || '').toLowerCase();
  const found = new Set<DoorSlug>();
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
    const short = shortName(d.displayName);
    const aliases = DOOR_ALIASES[d.slug] ?? [];
    if (m.includes(d.slug.replace(/_/g, ' ')) || m.includes(short) || m.includes(d.displayName.toLowerCase()) || aliases.some((a) => m.includes(a))) {
      found.add(d.slug);
    }
  }
  // Precedence among LOAD doors (taxonomy spec §4): Aging Parents (parent care) and Full House
  // (active-family season) own their load; The Load-Bearer is the catch-all for OTHER load, so it
  // yields to them — it never redundantly re-tags a load a specific Door already owns. (Genuine
  // multi-load is the model's call via record_progress; this is only the gap-only backstop matcher.)
  if (found.has('load_bearer') && (found.has('aging_parents') || found.has('full_house'))) {
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
  const fullHouseSignal =
    matchDoors(m).includes('full_house') ||
    /\b(had kids|having kids|when we had|after (we )?had kids|after kids|young kids|small kids|little kids|new baby|babies|a toddler|raising (the |our )?kids)\b/.test(m);
  const agingParentsSignal = /\b(aging parent|elderly|my (mom|dad|mother|father|parents)|caring for (my|a|an|his|her|aging) ?(mom|dad|mother|father|parent|parents)?)\b/.test(m);
  const emptyNestSignal = /\b(empty nest|moved out|left (home|the house|the nest)|kids? (are )?(grown|gone|all gone|all left|out of the house)|off to college|last one (gone|left))\b/.test(m);

  const set = new Set<DoorSlug>(doors);
  if (fullHouseSignal) {
    if (!agingParentsSignal) set.delete('aging_parents');
    if (!emptyNestSignal) set.delete('empty_nest');
    set.add('full_house');
  }
  return DOORS.filter((d) => set.has(d.slug)).map((d) => d.slug);
}
