// PRESENTING A MEMBER'S OWN WORDS — the display layer over verbatim capture.
//
// The engine grounds every stored item to the member's exact span (their-own-words-back, Jay 2026-08-09), which is
// right and must not change: what we KEEP is what they said. But a phrase lifted out of the middle of a sentence
// arrives mid-sentence-cased, and in a bulleted list beside phrases they happened to type at the start of one, it
// reads as a mistake about them. Jay's own Quality Day, 2026-08-26:
//
//     • A bike ride
//     • Pushing the G4L Movement forward
//     • keeping my eating routine constant     ← his words, lifted mid-sentence
//
// So: capitalise for DISPLAY, never in storage. The stored value stays byte-identical to what they said.
//
// HOISTED, NOT COPIED A FOURTH TIME. This exact one-liner already existed three times — lib/founder/draft.ts,
// lib/activity/summary.ts and onboarding-staged's `capFirst`. The standing rule here is that the second occurrence
// of a shape is the signal to fix the abstraction and the fourth is where brittleness is born, so this is the one
// definition and those three now point at it.

/**
 * Capitalise the first character for display. Leaves everything else untouched, including a word that is
 * deliberately lowercase further in ("my eating routine" stays as they wrote it).
 *
 * Returns the string unchanged when it does not start with a lowercase letter — so "iPhone rides", "3 miles" and
 * an already-capitalised phrase all pass through, and nothing is ever "corrected" beyond the first character.
 */
export function sentenceStart(s: string): string {
  if (!s) return s;
  const first = s.charAt(0);
  return first >= 'a' && first <= 'z' ? first.toUpperCase() + s.slice(1) : s;
}
