// PICKING THE ENGINE'S FOLLOW-UP QUESTION — one definition, four callers.
//
// Four beats keep a short list of "is there more?" lines and have to choose one: the gap and the Reclaim List in
// onboarding, the Doors and the drift in Reconnect. Each wrote its own chooser, and the choosers disagree about
// the one thing that matters — what happens when the list runs out.
//
// Onboarding's gap got it right: cap the asks, then REFLECT instead of asking again. Doors and drift index with
// `count % length`, which does not run out — it wraps, so the fourth ask is guaranteed to be the first one again.
// Jay hit that on the drift beat: "Second time it's asked me this."
//
// It is the third time this exact bug has been fixed. First the chooser counted question marks, which froze on
// one variant forever (Jennifer's walk: the same line three times running). Then it counted agent messages,
// which stopped the freeze and left the wrap. Fixing the drift chooser alone would have been the fourth patch,
// and would have left the Doors chooser sitting there with the identical bug waiting for someone's walk.
//
// So: one function, and the answer to "what happens when the list runs out" is NULL — stop asking. The caller
// then leaves the question to the model, which is where the draw-out's questions are supposed to come from
// anyway (the engine never appends its own; see the drawout rhythm rule).

export type Spoken = { role: string; text: string };

/**
 * The next follow-up that has NOT been said yet in this conversation, or null once they are all spent.
 *
 * Matching is on the exact line, because that is the promise being kept: a member never hears the same sentence
 * twice. A looser signature match would also catch the model's own paraphrases and silence us too early.
 */
export function nextFollowUp(variants: readonly string[], history: readonly Spoken[]): string | null {
  const said = new Set(
    history.filter((h) => h.role === 'agent').map((h) => (h.text ?? '').trim()),
  );
  // A variant counts as said if any agent turn CONTAINS it — the engine appends probes to model text, so the
  // stored turn is usually "<reflection>\n\n<probe>" rather than the probe alone.
  const spoken = (v: string) => [...said].some((t) => t === v || t.includes(v));
  return variants.find((v) => !spoken(v)) ?? null;
}
