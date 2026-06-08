// GRINTA! Bites — small, non-program content the Member Agent serves day to day. Versioned content
// (a registry, like assets), tagged for relevance. Consuming one is a daily "rep" that feeds the
// GRINTA! Index. Science Checks, short articles, and excerpts of bigger assets all live here.

import type { RGroup } from '../assets/gating.ts';

export type BiteKind = 'science_check' | 'article' | 'asset_excerpt';

export type Bite = {
  code: string;
  title: string;
  kind: BiteKind;
  minutes: number; // est. read time
  tags: string[];
  group?: RGroup; // which R it nourishes (for light relevance to current focus)
  attribution?: string; // e.g. signed Science Checks
  body: string;
};

export const KIND_LABEL: Record<BiteKind, string> = {
  science_check: 'Science Check',
  article: 'Quick read',
  asset_excerpt: 'From the Atlas',
};

export const BITES: Bite[] = [
  {
    code: 'bite-hardiness',
    title: 'What “Grinta” actually is',
    kind: 'article',
    minutes: 2,
    tags: ['grinta', 'hardiness', 'identity'],
    group: 'Rewire',
    body: 'Grinta isn’t about being tough. It’s hardiness — and the science says it’s learnable. Three habits build it: commitment (staying engaged with what matters), control (acting on what you can change), and challenge (treating change as the path, not the threat). Every time you show up — a ride, a page, a hard conversation — you’re training it. That’s why no rep in the loop is wasted.',
  },
  {
    code: 'bite-first-step',
    title: 'Why the first step matters',
    kind: 'science_check',
    minutes: 2,
    tags: ['grinta', 'rebuild', 'physical'],
    group: 'Rebuild',
    attribution: 'Dr. Greg Welk',
    body: 'Physical inactivity acts as an accelerant that roughly doubles the rate of physiological decline — and about half of the decline we associate with aging is preventable. A baseline gives you real information to work with: not guesses, not how you feel, but where you actually are. The jump from zero to something is the most important transition there is.',
  },
  {
    code: 'bite-zero-to-something',
    title: 'The jump from zero to something',
    kind: 'article',
    minutes: 1,
    tags: ['grinta', 'rebuild', 'movement'],
    group: 'Rebuild',
    body: 'The single most valuable move isn’t going from good to great — it’s going from zero to something. The first walk. The first ten minutes. Your body responds faster than you’d believe: within two to four weeks, more energy and better sleep, long before the scale moves. Don’t wait to feel ready. Start small enough that you can’t talk yourself out of it.',
  },
  {
    code: 'bite-window',
    title: 'A window back to yourself',
    kind: 'asset_excerpt',
    minutes: 2,
    tags: ['grinta', 'reconnect', 'identity'],
    group: 'Reconnect',
    body: 'Think of a moment — even a small, ordinary one — when you last felt fully like yourself. Not a highlight reel. A morning, a road, a room where you recognized you. That window is still open. The whole work of Reconnect is widening it until you can climb back through.',
  },
  {
    code: 'bite-fuel-to-move',
    title: 'Fuel to move',
    kind: 'science_check',
    minutes: 2,
    tags: ['grinta', 'rebuild', 'nutrition'],
    group: 'Rebuild',
    attribution: 'Dr. Greg Welk',
    body: 'A diet isn’t something you go on — it’s something you have. The evidence for midlife is clear: diet and movement work best linked into one “fuel to move” lifestyle, not managed separately. Favor whole foods, keep moving, and let the two reinforce each other. The body regulates weight like a thermostat — consistent movement is what keeps it honest.',
  },
];

const byCode = new Map(BITES.map((b) => [b.code, b]));
export const getBite = (code: string): Bite | undefined => byCode.get(code);

/** The next bite to serve: an un-consumed one, preferring the member's current focus. */
export function pickDailyBite(consumedCodes: ReadonlySet<string>, focusGroup?: RGroup | null): Bite | null {
  const fresh = BITES.filter((b) => !consumedCodes.has(b.code));
  if (fresh.length === 0) return null;
  return (focusGroup && fresh.find((b) => b.group === focusGroup)) || fresh[0]!;
}
