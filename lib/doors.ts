// The 8 Doors — canonical set, locked to the pitch deck (docs/CONTRACTS.md §3).
// Shared source of truth for the app and for validation. Mirrors the DB seed
// (supabase/seed/0001_reference_data.sql); the DB `door` table is the runtime source,
// this constant is for type-safety, validation, and seeding parity.

export const DOORS = [
  { slug: 'career_cliff',  displayName: 'The Career Cliff',  descriptor: 'The role that ended, plateaued, or a retirement that became a freefall.' },
  { slug: 'aging_parents', displayName: 'The Aging Parents', descriptor: 'The role reversal that made you the one doing the caring.' },
  { slug: 'empty_nest',    displayName: 'The Empty Nest',    descriptor: 'The house that got quiet when the kids left.' },
  { slug: 'vanishing',     displayName: 'The Vanishing',     descriptor: 'The friendships that slipped away without a goodbye.' },
  { slug: 'body',          displayName: 'The Body',          descriptor: 'The body that started saying no to what it used to do easily.' },
  { slug: 'diagnosis',     displayName: 'The Diagnosis',     descriptor: 'The mirror moment you couldn’t look away from.' },
  { slug: 'marriage',      displayName: 'The Marriage',      descriptor: 'The drift from partnership into just coexisting.' },
  { slug: 'loss',          displayName: 'The Loss',          descriptor: 'Losing someone close, and everything changing after.' },
] as const;

export type DoorSlug = (typeof DOORS)[number]['slug'];

export const DOOR_SLUGS: readonly DoorSlug[] = DOORS.map((d) => d.slug);

export function isDoorSlug(value: unknown): value is DoorSlug {
  return typeof value === 'string' && DOOR_SLUGS.includes(value as DoorSlug);
}

const shortName = (displayName: string) => displayName.toLowerCase().replace(/^the\s+/, ''); // "career cliff"

// Map a member's free-text answer to one or more Doors (voice rewrite v1: members answer in their
// own words; the agent maps silently). Matches by slug, full/short display name, or a 1–8 number;
// returns canonical-ordered, de-duplicated slugs. Empty array means nothing recognized → re-ask.
export function matchDoors(message: string): DoorSlug[] {
  const m = (message || '').toLowerCase();
  const found = new Set<DoorSlug>();
  for (const numMatch of m.matchAll(/\b([1-8])\b/g)) {
    const idx = Number(numMatch[1]) - 1;
    if (DOORS[idx]) found.add(DOORS[idx]!.slug);
  }
  for (const d of DOORS) {
    const short = shortName(d.displayName);
    if (m.includes(d.slug.replace(/_/g, ' ')) || m.includes(short) || m.includes(d.displayName.toLowerCase())) {
      found.add(d.slug);
    }
  }
  return DOORS.filter((d) => found.has(d.slug)).map((d) => d.slug);
}
