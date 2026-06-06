// The 8 Doors — canonical set, locked to the pitch deck (docs/CONTRACTS.md §3).
// Shared source of truth for the app and for validation. Mirrors the DB seed
// (supabase/seed/0001_reference_data.sql); the DB `door` table is the runtime source,
// this constant is for type-safety, validation, and seeding parity.

export const DOORS = [
  { slug: 'career_cliff',  displayName: 'The Career Cliff',  descriptor: 'The role that ended, plateaued, or a retirement that became a freefall.' },
  { slug: 'aging_parents', displayName: 'The Aging Parents', descriptor: 'The role reversal that makes you a primary caregiver.' },
  { slug: 'empty_nest',    displayName: 'The Empty Nest',    descriptor: 'The house that got quiet when the kids left.' },
  { slug: 'vanishing',     displayName: 'The Vanishing',     descriptor: 'The friendships that quietly disappeared.' },
  { slug: 'body',          displayName: 'The Body',          descriptor: 'The body that started saying no to what it used to do easily.' },
  { slug: 'diagnosis',     displayName: 'The Diagnosis',     descriptor: 'The mirror moment you could not avoid.' },
  { slug: 'marriage',      displayName: 'The Marriage',      descriptor: 'The drift from partnership into coexistence.' },
  { slug: 'loss',          displayName: 'The Loss',          descriptor: 'The death of someone close that changed everything.' },
] as const;

export type DoorSlug = (typeof DOORS)[number]['slug'];

export const DOOR_SLUGS: readonly DoorSlug[] = DOORS.map((d) => d.slug);

export function isDoorSlug(value: unknown): value is DoorSlug {
  return typeof value === 'string' && DOOR_SLUGS.includes(value as DoorSlug);
}
