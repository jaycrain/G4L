// "Explore the Science" — the third tier of framing on a session, below the "Why this matters" summary.
//
// WHERE IT CAME FROM. Greg, 2026-08-07: "I suggest adding a bit more depth to the introduction that helps a member
// gain some insight before jumping in… I thought it could be used as a hyperlink and we can say 'Click the Explore
// link to take a deeper dive'… I think [it] is conceptually different than the Why it Matters box and provides more
// context." He drafted C1's from the Science Check and offered to do the rest: "It wouldn't be too hard to do this
// for other activities since I already drafted the foundations in the Science Check files."
//
// WHY IT IS NOT A REPLACEMENT for summaries.ts. All six of his C1 points were ALREADY in our C1 "Why this matters" —
// compressed into four sentences that he himself voice-passed on 2026-07-20. This tier is the same ideas at a
// different resolution and for a different job: six labelled principles you can point at, so a member who wants to
// know the foundation is real can see that it is. Tier 2 tells you why it matters; tier 3 shows you it's grounded.
// So: DO NOT restate a point here that the summary already makes better in fewer words — earn the extra tap.
//
// VOICE. Greg's draft is his own and he says so ("It is still a b[i]t 'researchy'"). His science is the source; the
// wording is ours. Two rules carried from the summaries:
//   · PROBABILISTIC, never deterministic — "tends to", "more likely", "research suggests". Never "proves"/"guarantees".
//     (The science-check language rule — it applies here more than anywhere, since this tier IS the evidence claim.)
//   · Second person, plain, no jargon a member would have to look up. "Goals you actually chose", not
//     "self-concordant goals". The construct name belongs in Greg's documents, not on a member's screen.
//
// The heads are deliberately full sentences — a member skimming only the bold lines should still get the argument.

import type { AssetId } from './summaries.ts';

export type ExplorePoint = { head: string; body: string };
export type Explore = {
  /** Panel subtitle — names what the foundation is FOR, in the member's terms. */
  lede: string;
  points: ExplorePoint[];
};

// Only C1 for now — deliberately. We build one, put it in front of Greg and Jay on a real screen, and decide about
// the other eleven after seeing it work. A half-populated record is honest about that; a stubbed-out set of twelve
// would not be. `exploreFor` returns undefined for the rest and the link simply doesn't render.
export const ASSET_EXPLORE: Partial<Record<AssetId, Explore>> = {
  c1: {
    lede: 'Why revisiting your list is the work, not a detour from it',
    points: [
      {
        head: 'Goals you actually chose hold up longer',
        body:
          'Research suggests people stay with goals that fit their own values and sense of self, and drift from ones ' +
          'carried out of pressure, guilt, or comparison with someone else. A goal that is yours has a much better ' +
          'chance of surviving a hard week.',
      },
      {
        head: 'Who you think you are shapes what feels possible',
        body:
          'What you want gets filtered through how you see yourself. As that understanding shifts — and three phases ' +
          'of this work tend to shift it — the same goal can move from central to beside the point, or the reverse.',
      },
      {
        head: 'Sorting the list is what makes it usable',
        body:
          'Clear, ranked goals tend to work better than a long flat list of good intentions. Most lists start out ' +
          'diffuse and a little competing. Sitting with one deliberately is how it becomes something you can act on.',
      },
      {
        head: 'Changing a goal is a skill, not a retreat',
        body:
          'Revising what you are aiming at is part of steering, not evidence you failed at the first version. It ' +
          'usually reflects a sharper read on what is meaningful and what is realistic.',
      },
      {
        head: 'Goals get better when experience informs them',
        body:
          'A goal built on what you have actually noticed about your habits and your patterns tends to be sturdier ' +
          'than one built on how you hoped things would go. You have several weeks of that evidence now.',
      },
      {
        head: 'The parts of a life are not separate',
        body:
          'Change tends to hold better when what you learn in one area feeds the others, rather than sitting in its ' +
          'own box. Looking at the whole list at once is how those connections surface.',
      },
    ],
  },
};

export function exploreFor(asset: AssetId): Explore | undefined {
  return ASSET_EXPLORE[asset];
}
