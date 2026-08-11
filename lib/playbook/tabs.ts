// WHERE A SESSION'S OUTPUT LANDS IN THE PLAYBOOK.
//
// This is the contract between "a Session produced something" and "the member can find it", and it used to live
// inside the Playbook view — a client component, which meant nothing could test it. It moved here so the routing
// can be asserted directly, because the question "are the Sessions actually hooked up?" should have an answer that
// stays true rather than one that has to be re-read every time the tabs move (they moved twice this week).
//
// THE CHAIN, end to end:
//
//   a Session commits a keeper with a keeperType
//        -> chapterKey()      which chapter the line belongs to
//        -> TAB_FOR_CHAPTER   which tab that chapter sits under
//
// Two other feeds reach the Playbook WITHOUT a keeper, and they are why "the Sessions write nothing" reads true
// from the keeper table alone and is false in the product:
//   · derived READS (B1 motivation, B2 skills, C2 bigger world) -> the "What you've learned" tab
//   · the live PRACTICE WEEK (w2/w3/b2/b3/c3)                   -> the "This week" tab
// A closed practice week then ALSO commits a 'plan' keeper, which is how a finished week reaches What worked.

export type ChapterKey = 'who' | 'lights' | 'tells' | 'plays' | 'why';
export type TabKey = 'thisweek' | 'worked' | 'learned' | 'journal';

/** Which tab a chapter sits under. Chapters survive INSIDE tabs — this is the grouping above them. */
export const TAB_FOR_CHAPTER: Record<ChapterKey, TabKey> = {
  plays: 'worked',
  tells: 'learned', // a tell is something you noticed about yourself — that is a learning
  why: 'learned', // the science sits beside what it explains
  who: 'learned',
  lights: 'learned', // what still moves you is something you learned about yourself
};

/**
 * What a kept line IS → its chapter. Keeper-type is authoritative; `section` is the fallback for older entries
 * written before keeper types existed (0046), which is why the section checks come after the switch rather than
 * instead of it.
 */
export function chapterKey(e: { keeperType?: string | null; section?: string | null }): ChapterKey | null {
  if (e.section === 'journal') return null; // journal is intake, not a chapter
  switch (e.keeperType) {
    case 'definition':
      return 'who';
    case 'lights_you_up':
      return 'lights';
    case 'tell':
      return 'tells';
    case 'principle':
    case 'recovery_move':
    case 'plan':
      return 'plays';
  }
  if (e.section === 'why_works') return 'why';
  if (e.section === 'what_works') return 'plays';
  return 'who';
}

/** The tab a kept line lands on — the whole chain in one call. Null for journal entries, which are intake. */
export function tabFor(e: { keeperType?: string | null; section?: string | null }): TabKey | null {
  const c = chapterKey(e);
  return c ? TAB_FOR_CHAPTER[c] : null;
}
