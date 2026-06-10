// Reclaim-item category inference (Slice Spec Decision 1: items carry an IDQ-dimension category).
// v1 is a keyword heuristic so the slice has categorized items today; the real version is the
// Member Agent inferring category during the onboarding shaping conversation. Default = 'self'
// (the identity catch-all). Flagged for upgrade.

import type { Category } from './registry.ts';

const PATTERNS: { category: Exclude<Category, 'self'>; re: RegExp }[] = [
  {
    category: 'physical',
    re: /\b(rid(e|ing)|run|walk|hik|bike|cycl|gym|lift|strength|fit|weight|sleep|eat|food|fuel|nutri|trail|climb|swim|5k|10k|race|mile|stair|energy|strong|movement|workout|body|muscle|breath)\w*/i,
  },
  {
    category: 'social',
    re: /\b(friend|famil|kid|child|partner|wife|husband|spouse|connect|people|call|relationship|belong|together|mom|dad|son|daughter|group|community|neighbor|reach out)\w*/i,
  },
  {
    category: 'outlook',
    re: /\b(hope|future|purpose|goal|dream|adventur|travel|trip|plan|possib|forward|mindset|confiden|believ|optimis|next chapter|look forward)\w*/i,
  },
];

export function inferCategory(text: string): Category {
  const t = (text || '').toLowerCase();
  for (const p of PATTERNS) if (p.re.test(t)) return p.category;
  return 'self';
}
