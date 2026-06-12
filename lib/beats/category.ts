// Reclaim-item category inference (Slice Spec Decision 1: items carry an IDQ-dimension category).
// v1 is a keyword heuristic so the slice has categorized items today; the real version is the
// Member Agent inferring category during the onboarding shaping conversation. Default = 'self'
// (the identity catch-all). Flagged for upgrade.

import type { Category } from './registry.ts';

const PATTERNS: { category: Exclude<Category, 'self'>; re: RegExp }[] = [
  // 'life' first — clear money/venture signals win even if the text also brushes a dimension keyword
  // (e.g. "raise $250k for the Movement" must be life, not physical's "movement"). Agent-inferred is
  // the primary path; this heuristic is the conservative fallback for the dashboard add.
  {
    category: 'life',
    re: /(\$|\b(\d+k|\d{1,3}(,\d{3})+)\b|raise(s|d)? (capital|money|funds|\$)|fundrais|\bsavings?\b|\brevenue\b|\bprofit\b|\binvest(ing|ment)?\b|\bretirement\b|\bmortgage\b|\bnet worth\b|\bincome\b|\bdebt\b|start ?up\b|\blaunch (a|my|the)\b|\bthe round\b|\bcharter member)/i,
  },
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

// A Reclaim item is "vague" when it names a subjective feeling/state rather than something
// observable. Safety net for the close: a goal Beat never binds to a vague item (its close would
// be unanswerable fog — "did this move you toward feeling better about myself?"), so it degrades to
// a rep close until the item is sharpened. Catching the worst offenders is enough — a false positive
// just loses the goal-close (still a valid rep); false negatives are rare. Pairs with the onboarding
// shaping pass (which tries to prevent vague items reaching here in the first place).
const VAGUE = /\b(feel|feeling|feels|felt|happier|happy|better about|good about|confiden|less stress|more myself|at peace|content|fulfilled|whole again|self-?esteem|mindset|love myself)\b/i;
export function isVagueReclaim(text: string): boolean {
  return VAGUE.test((text || '').toLowerCase());
}
