// GRINTA! Bites — small, non-program content the Member Agent serves day to day. Versioned content
// (a registry, like assets), tagged for relevance. Consuming one is a daily "rep" that feeds the
// GRINTA! Index. Science Checks are DERIVED from the asset registry, so every Science Check Greg
// writes (or edits) flows in as a bite automatically — single-sourced, no duplication.

import { GATES, type RGroup } from '../assets/gating.ts';
import { ASSET_NAMES, getAssetDefinition } from '../assets/definitions.ts';

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

// Hand-authored articles + excerpts (not signed Science Checks — those are derived below).
const HAND_AUTHORED: Bite[] = [
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
];

// Science Checks, derived from the asset registry — Greg's content becomes bites automatically.
function scienceCheckBites(): Bite[] {
  const out: Bite[] = [];
  for (const code of Object.keys(ASSET_NAMES)) {
    const sc = getAssetDefinition(code).scienceCheck;
    if (!sc) continue;
    const group = GATES[code]?.group;
    out.push({
      code: `bite-sc-${code}`,
      title: sc.title,
      kind: 'science_check',
      minutes: 2,
      tags: ['grinta', 'science', ...(group ? [group.toLowerCase()] : [])],
      group,
      attribution: sc.attribution,
      body: sc.body,
    });
  }
  return out;
}

export const BITES: Bite[] = [...HAND_AUTHORED, ...scienceCheckBites()];

const byCode = new Map(BITES.map((b) => [b.code, b]));
export const getBite = (code: string): Bite | undefined => byCode.get(code);

/** The next bite to serve: an un-consumed one, preferring the member's current focus. */
export function pickDailyBite(consumedCodes: ReadonlySet<string>, focusGroup?: RGroup | null): Bite | null {
  const fresh = BITES.filter((b) => !consumedCodes.has(b.code));
  if (fresh.length === 0) return null;
  return (focusGroup && fresh.find((b) => b.group === focusGroup)) || fresh[0]!;
}
