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
 * Should the free-text composer be shown?
 *
 * @param hasExpectation the engine handed back a structured surface (chips, a board, a builder) — that IS the input
 * @param awaitingContinue the beat is over and a continue control is on screen, waiting for a tap
 */
export function showComposer(hasExpectation: boolean, awaitingContinue: boolean): boolean {
  return !hasExpectation && !awaitingContinue;
}
