// WHEN DOES THE MEMBER GET A TEXT BOX?
//
// One rule, one place. The four arc chats (reconnect / rewire / rebuild / reclaim) each rendered their own copy of
// the condition, and a copy is what let this drift: the composer knew to hide behind an administered turn, and
// knew nothing about the beat where the Companion has finished and is waiting for a TAP.
//
// Donna, 2026-08-20, at the end of the Rebuild assessments: "That's the read. Hold on — let me show you what you
// just built," and then two ways forward at once — an empty "Type your reply here…" with a Send button, and a
// "See where that landed →" button. No question had been asked. Her note: showing a blank reply field when there
// is nothing to respond to "implies input is expected or optional when it isn't, and creates uncertainty about
// which control actually advances the flow." She flagged it as consistent, because it is: same shape in all four.
//
// THE COMPOSER AND THE CONTINUE BUTTON ARE TWO VIEWS OF ONE STATE. Whenever the surface is waiting on a specific
// act — answering chips, or tapping through to the reveal — a free-text box is not a second option, it is a
// dead end that looks like one. Deriving both from this function is what stops them disagreeing again.

/**
 * NOT EVERY EXPECTATION IS THE INPUT. Some are a SHORTCUT to it, and those must keep the text box.
 *
 * Jay, R3, 2026-08-28: "Didn't give the composer on the first try."
 *
 * `beat_confirm` is the Companion asking the member to rule on something it just reflected — the drift, the
 * window, the Legacy Letter. The chips are two fast answers; they are not the only two answers, and the code that
 * renders them says so eight lines above the composer: "The composer stays: typed replies fall through to the
 * classifier as before." It did not stay. This helper landed afterwards, for Donna's Rebuild finding, and
 * overrode a rule written down beside it — so a member holding a draft of their own Legacy Letter, wanting to
 * change one line, had two buttons and nowhere to type.
 *
 * THE DISTINCTION IS WHETHER THE STRUCTURE CAN CARRY THE WHOLE ANSWER:
 *  · a 1–5 scale, the Doors board, the Reclaim builder — the answer IS the structure. No composer; a text box
 *    beside it is the dead end Donna reported.
 *  · a confirm — the structure carries the two COMMON answers. Anything else the member wants to say has to go
 *    somewhere, and the engine already accepts it (the confirm handlers classify free text).
 *
 * The failure modes are not symmetric, which is what settles it: a needless text box is a moment's confusion,
 * and a missing one is a member who cannot say the thing they came to say. [[no-unreachable-rules]]
 */
const SHORTCUT_KINDS = new Set(['beat_confirm']);

export function showComposer(
  expectation: boolean | { kind?: string } | null | undefined,
  awaitingContinue: boolean,
): boolean {
  if (awaitingContinue) return false;
  // Back-compat: callers that pass a bare boolean get the old all-or-nothing rule.
  if (typeof expectation === 'boolean') return !expectation;
  if (!expectation) return true;
  return SHORTCUT_KINDS.has(expectation.kind ?? '');
}
