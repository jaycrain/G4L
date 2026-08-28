import type { SessionKey } from '../workspace/session-key.ts';

// WHERE WHAT SHE JUST MADE ACTUALLY LIVES — the missing third of the Session close.
//
// Donna's End-of-Session Flow (2026-08-19) asks every summary to carry three things: a recap of what happened,
// WHERE THE RESULTS LIVE, and a clear next step. We had the first and the third. The middle one is why she filed
// two separate reports — "True Lines: no visibility after Session Complete" and "the Reclaim List referenced but
// not shown" — both of which reduce to the same question: I made something, where did it go?
//
// The answer differs by session in a way a generic line cannot cover, and the difference is the point:
//
//  · A session that PRODUCES AN ARTIFACT can name it and say where to find it. That is the strong case, and the
//    one that repays being specific — "your true lines" beats "your work".
//  · A CHECKPOINT produces no artifact at all. She answered a scale and there is nothing to go and look at, which
//    is exactly when a member assumes the answers went nowhere. Naming the reading, and where it surfaces, is the
//    whole fix — and it is the same complaint as the ceremony scores arriving with no prior context.
//
// AUTHORED, NOT GENERATED. The model does not know our navigation and would cheerfully invent a page. These are
// the words a member reads at the end of every Session, so they belong in canon and are quoted verbatim.
//
// The voice rule that applies here: say where it IS. No "don't worry, it's saved" — a reassurance she did not ask
// for implies she was right to doubt us.

export type WhereItLives = {
  /** One sentence, plain. Names the thing and the place. */
  line: string;
  /** Optional destination, when there is a real page to open. Checkpoints have none. */
  href?: (memberId: string) => string;
  cta?: string;
};

const PLAYBOOK = (id: string) => `/playbook/${id}`;
/**
 * A LINK THAT LANDS WHERE THE SENTENCE SAYS IT WILL.
 *
 * The Playbook has read `?tab=` since it got tabs, and none of these links used it — so "It lives in your
 * Playbook, under Who you are" opened on This week and the member had to go find it. Jay, R3: "Closing card and
 * Playbook link didn't take me to the correct tab."
 *
 * The rule these encode is that the copy and the destination are ONE fact. If a line names a tab, its href must
 * open that tab; a test below asserts exactly that, so a future line naming a tab cannot ship pointing at the
 * default.
 */
const PLAYBOOK_TAB = (tab: string) => (id: string) => `/playbook/${id}?tab=${tab}`;
const DASHBOARD = (id: string) => `/dashboard/${id}`;

export const WHERE_IT_LIVES: Record<SessionKey, WhereItLives> = {
  // One entry per Reconnect Session now. Each names what THAT Session produced rather than the whole phase — the
  // single line was written when Reconnect was one arc and had to cover all three at once.
  r1: {
    line: 'Your starting ID Score is on your dashboard. Every later reading is measured against it.',
    href: DASHBOARD,
    cta: 'Open your dashboard',
  },
  // THE DOORS ARE NOT ON THE DASHBOARD, and never were: redesign-dashboard.tsx deliberately keeps them off it
  // ("privacy: sensitive if someone's looking over the member's shoulder"). They live in the Playbook, under
  // "Who you are". This line sent members to look for them somewhere they were designed not to appear.
  r2: {
    line: 'Your Doors are in your Playbook, under Who you are, and you can change them any time.',
    href: PLAYBOOK_TAB('who'),
    cta: 'Open your Playbook',
  },
  r3: {
    line: 'Your Legacy Letter is in your Playbook, under Who you are. Open it a year from now and see how far the distance closed.',
    href: PLAYBOOK_TAB('who'),
    cta: 'Open your Playbook',
  },
  r4: {
    // ONE DESTINATION PER LINE. This named two — the dashboard AND the Playbook's Who you are — behind a single
    // button that opens the dashboard, so half the sentence pointed somewhere the button would not take you.
    // The Doors were already handed over at R2's close, with a link that lands on the right tab; repeating them
    // here under the wrong button is worse than not repeating them.
    line: 'Your Reclaim List and your starting ID Score are on your dashboard — that is the ground everything else builds on.',
    href: DASHBOARD,
    cta: 'Open your dashboard',
  },
  w1: {
    line: 'Your true lines are in your Playbook, under What worked. Reach for them when the old voice starts up.',
    href: PLAYBOOK_TAB('worked'),
    cta: 'Open your Playbook',
  },
  w2: {
    line: 'Your picture is in your Playbook. Five minutes with it each morning this week is the practice.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  w3: {
    line: 'Your False Start Protocol is in your Playbook — the triggers you named and what you do about each one.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  'rewire-checkpoint': {
    line: 'There is nothing to file from this one. Those six answers set your Rewire read, and it shows on your dashboard as part of your Grinta Index.',
  },
  b1: {
    line: 'Your why is in your Playbook, in your own words — the reason that has to hold on the days you do not feel like it.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  b2: {
    line: 'Your development map is in your Playbook: the skills you rated, and which family they fall into.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  b3: {
    line: 'Your Lifestyle Pilot is in your Playbook, and this week you live it — mark the days as you go.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  b4: {
    line: 'There is nothing to file from this one. Those answers set your Rebuild read, and it shows on your dashboard as part of your Grinta Index.',
  },
  c1: {
    line: 'Your Reclaim List is on your dashboard, refined — the same list, seen with clearer eyes.',
    href: DASHBOARD,
    cta: 'Open your dashboard',
  },
  c2: {
    line: 'Your Bigger World Audit is in your Playbook: where your world can widen, and the one change you named for each.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  c3: {
    line: 'Your Quality Days are in your Playbook — your non-negotiables, what helps, and what pulls a day down.',
    href: PLAYBOOK,
    cta: 'Open your Playbook',
  },
  c4: {
    line: 'There is nothing to file from this one. Those answers set your Reclaim read, and it shows on your dashboard as part of your Grinta Index.',
  },
};

export function whereItLives(key: SessionKey): WhereItLives {
  return WHERE_IT_LIVES[key];
}
