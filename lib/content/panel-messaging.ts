// THE MESSAGING LADDER — one idea per feature, said four times, each time doing one more job.
//
// Cowork + Jay, 2026-08-13. Every feature a member can see runs the same core idea down four layers:
//   tour   — the anchor line, said once during the Opening Tour
//   panel  — the dashboard card: the idea PLUS live state
//   header — the subpage title: the idea PLUS its purpose (the "train" upgrade from a bland label)
//   intro  — how it works, and ONLY where the header doesn't already carry it
// The repetition is the point — it cements the vocabulary. What must not repeat is the JOB of each layer.
//
// THIS IS THE SINGLE SOURCE, for the same reason lib/content/summaries.ts is: ten subpages each hand-writing their
// own title is ten chances to drift, and the surfaces that quote each other (the tour line and the panel line say
// the same thing on purpose) cannot be kept honest across ten files. A wording change is a one-file edit here.
//
// PLAYBOOK POSITIONING IS DRAFT, NOT CANON (Jay, 2026-08-13): "the endpoint framing is the direction, but the copy
// isn't locked." #134 is still open and still blocks #135/#144/#155. Build the mechanics; expect these two strings
// to move, and do not treat them shipping as #134 being settled.
//
// The `sub` line is member-facing prose, not a slug — keep it a sentence. Bracketed tokens like [Reconnect] in the
// doc are LIVE STATE and belong to the page, not to this file, so they are not baked in here.

export type PanelMessaging = {
  /** The subpage title: "<Name> — <what it's for>." */
  title: string;
  /** The line under the title. Always present; it is what upgrades a label into a purpose. */
  sub: string;
  /** How it works. Null where the header already carries it — an intro that restates the sub is noise. */
  intro: string | null;
  /**
   * ONE extra sentence the Opening Tour says and no other surface does — what you actually DO here. Optional;
   * most panels don't need it, because title + sub already say the thing.
   */
  tourExtra?: string;
};

/**
 * The TOUR rung, COMPOSED — never stored.
 *
 * The tour used to hold its own hand-written line for every panel, which meant this file and the tour were two
 * copies of one idea. Jay edited the copy here on 2026-08-13 and then watched the tour on prod say the old
 * words: "some of the copy didn't have my last edits." Composing the line means an edit to `title` or `sub`
 * reaches the tour with no second place to remember.
 */
export function tourLine(key: PanelKey): string {
  const m = PANEL_MESSAGING[key];
  return [m.title, m.sub, 'tourExtra' in m ? m.tourExtra : null].filter(Boolean).join(' ');
}

export const PANEL_MESSAGING = {
  program: {
    title: 'The Program — your way back.',
    sub: 'Four phases, your pace.',
    intro:
      'Your Comeback runs in four phases — Reconnect, Rewire, Rebuild, Reclaim. Each is built from a few Sessions: ' +
      'guided conversations with your Companion, one at a time, at your pace. Finish a phase’s Sessions and a ' +
      'Checkpoint opens the next. Everything you do here builds your Playbook.',
    tourExtra: 'You start the next one right here.',
  },
  idScore: {
    title: 'ID Score — the distance you’re closing.',
    sub: 'How close you are to the person you’re reclaiming, 0–100.',
    intro:
      'It comes from the IDQ — twenty-four questions, about every 60 days. It moves slowly on purpose, so when it ' +
      'moves, you know you earned it.',
  },
  grinta: {
    title: 'Grinta Index — the grit you’re building.',
    sub: 'Your resilience, measured — and it grows with every phase.',
    intro:
      'Grit is what carries you past where you stopped before. It climbs as you close phases, so you can watch ' +
      'yourself getting stronger.',
  },
  badges: {
    title: 'Badges — proof of what you’ve actually done.',
    sub: 'Passport stamps, not trophies — the count is the point.',
    intro:
      'You don’t get one for showing up. You get one for the moves that count — passing a stretch of grit, ' +
      'reclaiming something on your list, coming back after a miss. A passport that fills is a life being won back.',
  },
  momentum: {
    title: 'Momentum — your rhythm, one call at a time.',
    sub: 'The small daily choices, and the pattern they make.',
    intro:
      'A single day tells you little. A few weeks tell you what your rhythm actually is — the thing worth seeing ' +
      'while you’re still building it.',
  },
  playbook: {
    // DRAFT — see the note at the top of this file. #134 is open.
    title: 'Your Playbook — how you watch yourself change.',
    sub: 'The moves that work for you, and the person you’re reclaiming, in one place.',
    intro:
      'Everything worth keeping lands here in your own words — the moves you’ll run again, and what you’re learning ' +
      'about yourself. It grows every week.',
    // A brand-new member is looking at zeros while the tour says this. Say so before they wonder.
    tourExtra: 'It starts empty and fills as you go.',
  },
  reclaimList: {
    title: 'Reclaim List — what you’re taking back.',
    sub: 'The goals where your Comeback is aimed. Add or refine anytime with your Companion.',
    intro: null, // the sub carries it; an intro here would say "these are your goals" twice
  },
  movement: {
    title: 'Movement — the work, showing up in your body.',
    sub: 'Connect a source and your activity lands here.',
    intro:
      'It feeds the same picture your Companion is building — so what shows up here shows up when you talk about ' +
      'how the body work is going.',
  },
  community: {
    title: 'Community — others walking the same road.',
    sub: 'Give and get support from people who get it.',
    intro: null, // the sub carries it
  },
  account: {
    title: 'Your Account — yours to set.',
    sub: 'Your details, your reminders, and your privacy, in one place.',
    intro:
      'What you write here stays yours — export it or close your account anytime. Set reminders to get as many ' +
      'nudges as helps, and no more.',
  },
} as const satisfies Record<string, PanelMessaging>;

export type PanelKey = keyof typeof PANEL_MESSAGING;
