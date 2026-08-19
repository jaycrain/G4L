// PROVENANCE, NOT QUALITY — see tests/reclaim-voice.test.ts for the walk that produced this.
//
// The engine cannot tell a good want from a bad one and should not try; every attempt to judge the CONTENT of a
// member's words here has gone wrong (the drill-and-sharpen steering that lost ~30% of items was exactly that).
// This judges only who WROTE the sentence, which is a different and much more reliable question.
//
// A member's want is never addressed to her. "Lets you rebuild savings" is the Companion speaking TO her, so a
// second-person pronoun is proof the model composed the line instead of quoting it — the one thing the capture
// rule forbids. That makes it a clean structural signal rather than a taste call.

/** Second person as WHOLE WORDS. Substring matching would eat "journey", "young", "yoga" — real wants, all. */
const SECOND_PERSON = /\b(you|your|yours|you're|youre|yourself|yourselves)\b/i;

/**
 * True when this text was written BY the Companion rather than quoted FROM the member.
 *
 * Only ever asked of model-tagged items. A builder submission is the member's own typing and is never subject to
 * this — she may write whatever she likes, including "you", and it stands. That guarantee is the entire reason
 * the builder replaced conversational extraction, and this must not quietly erode it.
 */
export function isModelVoiced(item: string): boolean {
  return SECOND_PERSON.test((item ?? '').trim());
}
