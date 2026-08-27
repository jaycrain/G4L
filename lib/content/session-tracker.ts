import type { SessionKey } from '../workspace/session-key.ts';
import type { PracticeKind } from '../practice/store.ts';

// THE TRACKER A SESSION JUST BUILT FOR THEM — named, previewed, and one tap away.
//
// Jay, 2026-08-26, walking Rebuild and finding two skill rows on his Playbook he could not account for: "where
// did these come from? I'm seeing the summary in What you've learned but didn't notice it getting teed up as a
// tracker." Then the instruction: "the call out in line of when a grid is derived should be visually different
// and have a link/button like 'Check it out' with an arrow. We've got to orient a Member to what we're creating
// for them, where it is, and immediate access to it. It's not intuitive, but once learned is easy."
//
// TWO DIFFERENT OBJECTS, AND THE PRODUCT WAS TREATING THEM AS ONE. `where-it-lives.ts` answers "the thing you
// MADE — where did it go", which is a record to go and read. A practice week is not that. It is a thing we built
// FOR them that wants them back tomorrow, and it exists because of answers they gave minutes ago. Folded into the
// same sentence, the second one disappears: B2's line says "your development map is in your Playbook" and never
// mentions that a five-day tracker just opened with two of their own skills on it.
//
// "ONCE LEARNED IS EASY" IS THE DESIGN CONSTRAINT. This block renders in the same place, in the same shape, after
// every Session that opens a week — so the second time a member sees it they already know what it is. That is
// also why it carries a PREVIEW of the real rows rather than a description of them: when they land on the
// Playbook they are looking for something they have already seen, not decoding a sentence from a minute ago.
//
// AUTHORED, NOT GENERATED, like where-it-lives — the model does not know our navigation and would invent a page.

/**
 * Which practice week each Session opens.
 *
 * DERIVED FROM THE CODE BY A TEST, not trusted as a list. `tests/hand-home-to-the-week.test.ts` already reads the
 * `startPracticeWeek(...)` calls out of the route files precisely because a hand-maintained list drifts; the same
 * test now checks this map against them, so a Session that starts opening a week and is not added here fails.
 *
 * w2_image JOINED 2026-08-26. It was absent because its week had no grid — "five minutes in a picture is not
 * countable" — which stopped being true the day Jay noticed a week missing from his Playbook and W2 got its row.
 * Leaving it out would have made W2 the one Session that opens a tickable week and never mentions it, which is
 * the exact gap this block exists to close.
 */
export const TRACKER_FOR: Partial<Record<SessionKey, PracticeKind>> = {
  w2: 'w2_image',
  w3: 'w3_logging',
  b2: 'b2_noticing',
  b3: 'b3_pilot',
  c3: 'c3_quality',
};

export type TrackerCopy = {
  /** Names the thing in terms of where it CAME FROM — that is the question the member is actually asking. */
  title: string;
  /** What it is and what to do with it, in one line. Never "don't worry" — say what it is. */
  blurb: string;
  /** The action. Reads as an invitation to look, not an instruction to comply. */
  cta: string;
};

const TRACKER_COPY: Record<PracticeKind, TrackerCopy> = {
  w3_logging: {
    title: 'A tracker, built from the triggers you named',
    blurb: 'Your False Start moves are the rows. Tick a day when you put one into practice.',
    cta: 'Check it out',
  },
  b2_noticing: {
    title: 'A tracker, built from your answers',
    blurb: 'The skills worth practicing are the rows. Nothing to change this week — tick a day when you catch one.',
    cta: 'Check it out',
  },
  b3_pilot: {
    title: 'A tracker, built from your plan',
    blurb: 'The two changes you chose are the rows. Tick the days you live them.',
    cta: 'Check it out',
  },
  c3_quality: {
    title: 'A tracker, built from your Quality Days',
    blurb: 'Rate each day and mark what showed up. The week fills in as you go.',
    cta: 'Check it out',
  },
  w2_image: {
    title: 'A tracker, built from the picture you made',
    blurb: 'One row, five minutes a day. Tick the day once you have stood in it.',
    cta: 'Check it out',
  },
  reclaim_item: {
    title: 'A tracker, built from your Reclaim List',
    blurb: 'The items you chose to work are the rows. Tick the days you move on one.',
    cta: 'Check it out',
  },
};

export function trackerCopy(kind: PracticeKind): TrackerCopy {
  return TRACKER_COPY[kind];
}

/** The tracker a Session opens, or null when it opens none (or one with no grid). */
export function trackerKindFor(key: SessionKey): PracticeKind | null {
  return TRACKER_FOR[key] ?? null;
}

/** Deep-links straight to the running week rather than the Playbook's default tab — "immediate access to it". */
export function trackerHref(memberId: string): string {
  return `/playbook/${memberId}?tab=thisweek`;
}

/**
 * DOES THE CLOSE HAVE ANYTHING TO HAND OVER? — the gate on the end card, as a pure function.
 *
 * IT USED TO BE `slots.some(filled)`, INLINE IN THE COMPONENT, AND THAT WAS THE BUG. B1, B2 and C2 are
 * administered instruments: `readArtifact` returns a qualitative frame with an EMPTY slots array for them
 * (never a bare score — governance). So the card bailed out and pushed the member straight to the dashboard,
 * which means `whereItLives.b2` — authored, covered by a test, sitting in the table — had never once been shown
 * to a member. Jay finished B2 on 2026-08-26, was handed a five-day tracker built from his own answers, and was
 * told about neither: "where did these come from? I didn't notice it getting teed up as a tracker."
 *
 * A close has something to say when there is a DESTINATION or a TRACKER, not only when there are slots to recite.
 *
 * THE CHECKPOINTS STAY OUT, deliberately. B4, C4 and the Rewire checkpoint have no href and open no week — their
 * whereItLives line is "there is nothing to file from this one" — and B4 hands straight to a ceremony. Raising a
 * card in front of that would be two receipts for one moment.
 *
 * Pure so it can be asserted without a browser: the failure it replaces was invisible in every unit test we had,
 * because it lived in a JSX condition.
 */
export function hasHandoff(input: {
  filledSlots: number;
  hasTracker: boolean;
  hasDestination: boolean;
}): boolean {
  return input.filledSlots > 0 || input.hasTracker || input.hasDestination;
}
