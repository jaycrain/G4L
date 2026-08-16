// THE LEGACY LETTER — a letter to yourself, dated one year from today.
//
// WHY IT MOVED HERE. Greg relocated it from Reclaim into Reconnect R3 (Visioning = Drift Quiz + Legacy Letter),
// on the grounds that it helps to end the activity on a positive and to provide the vision early on: the Success
// Story in Reclaim can then be a reflection on what was accomplished, so the Legacy Letter closes out Reconnect.
// A member should leave the first R holding a destination, not just a diagnosis.
//
// WHY IT DIDN'T EXIST. Two independent findings, the same gap. Greg, walking the product 2026-08-04: "It was cool
// that the Companion generated the Story but I thought it would also task me with actually writing a Legacy Letter
// since our original instructions encouraged them to read it later. It may have guided me through some of the
// elements but I never really wrote it." And a note left in lib/ceremony/reclaim-ceremony-beats.ts during Donna's
// walk, saying the same thing from the other end: Reclaim's Legacy-revisit beat has nothing to revisit.
//
// WHAT ALREADY EXISTS, AND WHY THIS IS NOT A SECOND THING. The Window beat (reconnect.ts §2d) already draws out
// Greg's first prompt — the ordinary Tuesday a year out — and keeps it as a Playbook keeper. The Story
// (identity_paragraph) already synthesizes who they were and what happened. Neither is a letter: they are ours
// ABOUT them. The letter is theirs, TO themselves, dated, and meant to be opened in a year. So this composes from
// material we already hold rather than re-interviewing someone who has just answered these questions.
//
// GREG'S DESIGN NOTE ON THE DRAFT: "Having it generate it as a draft would be great and maybe it could prompt
// revisions until each Member has a structured half-page / full-page manifesto that was created through the
// process." That is the shape — WE draft, THEY revise until it is theirs. A blank page after a long session is
// how a member writes nothing.

/** The six prompts, verbatim from Greg's Reconnect Gated Assets V4, R3 Step 2. Order is his. */
export const LEGACY_PROMPTS: readonly { key: string; prompt: string; note: string }[] = [
  {
    key: 'tuesday',
    prompt:
      'What does a Tuesday look like for you one year from now? Not the highlight reel — the ordinary day. How does it start? How does it end? Who is in it?',
    // Already answered in the Window beat. We carry their words forward rather than asking twice.
    note: 'carried from the Window beat when present',
  },
  {
    key: 'adventure',
    prompt: "What adventure have you completed that you haven't started yet today?",
    note: 'the thing that requires the body to come back',
  },
  {
    key: 'relationship',
    prompt: 'What relationship has deepened because you kept showing up?',
    note: 'the social dimension, asked as a person rather than a score',
  },
  {
    key: 'given_back',
    prompt: 'What have you given back? Who have you brought into the circle?',
    note: 'contribution — and the bridge toward other people',
  },
  {
    key: 'measuring_stick',
    prompt: 'What does the measuring stick say? What is the data point that proves the next year was real?',
    note: 'their own evidence, chosen by them, not a metric we assign',
  },
  {
    key: 'unfinished',
    prompt: 'What is your Unfinished Business?',
    note: 'Greg: "There should always be Unfinished Business. That\'s the point." Never resolved, never closed.',
  },
] as const;

export type LegacyAnswers = Partial<Record<string, string>>;

/** The date the letter is addressed TO — one year from the member's own today. Never the server's. */
export function letterDateFor(todayISO: string): string {
  const [y, m, d] = todayISO.split('-').map(Number);
  // Year + 1, same month/day. Feb 29 lands on Mar 1 in a non-leap year, which is fine and better than throwing.
  const dt = new Date(Date.UTC((y ?? 2026) + 1, (m ?? 1) - 1, d ?? 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Which prompts still need answering, given what we already carry.
 *
 * The Tuesday is pre-filled from the Window beat when the member gave one — asking a member to describe their
 * Tuesday twice in one session is the product not listening the first time.
 */
export function remainingPrompts(answers: LegacyAnswers): typeof LEGACY_PROMPTS[number][] {
  return LEGACY_PROMPTS.filter((p) => !(answers[p.key] ?? '').trim());
}

/** True once there is enough to draft from. Not all six — a letter of four honest answers beats six forced ones. */
export function readyToDraft(answers: LegacyAnswers): boolean {
  return LEGACY_PROMPTS.filter((p) => (answers[p.key] ?? '').trim().length > 0).length >= 4;
}

/**
 * The instruction used to draft the letter FROM THEIR ANSWERS. Deliberately strict about voice: this is the one
 * artifact in the product written in the MEMBER'S first person, and a draft that sounds like us is worse than no
 * draft — they will accept it rather than argue with it, and then it is our letter with their name on it.
 */
export function draftInstruction(answers: LegacyAnswers, dateLabel: string): string {
  const given = LEGACY_PROMPTS.filter((p) => (answers[p.key] ?? '').trim())
    .map((p) => `- ${p.prompt}\n  THEY SAID: ${(answers[p.key] ?? '').trim()}`)
    .join('\n');
  return `Draft this member's Legacy Letter from their own answers below.

THE FORM: a letter written by them, to themselves, dated ${dateLabel} — one year from today. First person, addressed
to the version of them who kept going. Half a page. It is not a summary of their answers and not a plan; it is the
letter that person would want to read.

VOICE — THE WHOLE POINT: it must sound like THEM, not like us. Use their own words and images wherever they gave
them; keep their phrasing even where it is plain or awkward. Do not upgrade their vocabulary, do not add
inspirational cadence, do not write a sentence they would not say out loud. If they were specific, stay specific.

NEVER: praise them, grade the answers, promise an outcome, or add anything they did not say. No "you've got this",
no "imagine the possibilities". If an answer is missing, leave that ground alone rather than inventing it.

END ON THE UNFINISHED BUSINESS if they named one — it is meant to stay open, not to be resolved.

THEIR ANSWERS:
${given}

Return only the letter itself. No preamble, no title, no sign-off from you.`;
}
