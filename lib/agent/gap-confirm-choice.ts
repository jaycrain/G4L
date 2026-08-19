// THE GAP CONFIRM AS A TAP — the classification stops being a guess.
//
// The beat reflects her story and asks "have I got the shape of it — or is there more?". Reading her free-text
// answer three ways (agree / add / correct) with regex vocabulary took FIVE patches in two days and still leaked:
// Jennifer's "Yes." re-asked three times, "It was primarily around those three things" (a day and a reverted
// module), "that's a fair picture of it", "you've said it better than I could", "we've been over this". A live walk
// found two more in three runs, and one attempt matched "I said yes to the trip that summer" — which would have
// closed her story mid-sentence. English has unlimited ways to say yes. The list cannot be finished.
//
// This product has answered that question four times already — the Reclaim List became a builder, the identity
// handle became tap-to-pick, the Doors became a board, the instruments became chips. Every high-stakes capture that
// began as free-text inference was replaced with a structured affordance. This is the gate that never got
// converted, and it is the one still producing bugs.
//
// NO MODEL UPGRADE IS AVAILABLE, and it would not be the answer anyway. Capture already runs on the strongest tier
// (capture-model.ts — Sonnet stalled and captured zero items in testing). The model also already emits its own
// intent tag; the regexes exist precisely to override it, because it tagged Jennifer's "Yes." as "more" three times.
// A better classifier is a better guess. A tap is a fact.
//
// WHAT THIS DELIBERATELY DOES NOT DO: replace the conversation. The text box stays, typed replies still fall
// through to the classifier, and the chips are an easy option rather than a gate. The point is to make the
// unambiguous path the default one — exactly what the builder did for the Reclaim List.

export type GapConfirmChoice = 'more' | 'done' | 'wrong';

export type GapConfirmOption = {
  value: GapConfirmChoice;
  /** What she reads. In HER voice — something she would say, never an instruction we issue. */
  label: string;
  /** The intent the confirm gate already routes on. This replaces the guess; it does not add a fourth path. */
  intent: 'addition' | 'done' | 'dispute';
};

// ORDER IS THE VIBE DECISION, and it is not cosmetic.
//
// "There's more" LEADS. The first option is the one a surface signals it expects, and this beat must never be the
// place a member feels moved along — she sets the depth (the Independence Guarantee), and Greg's own framing is
// that most people walk through several Doors. Putting "that's it" first would quietly tell her we are ready to be
// finished with her story. Leading with "there's more" says the opposite: there is room, take it.
//
// "Not quite right" sits last rather than being hidden, because correcting us has to look as available as agreeing.
export const GAP_CONFIRM_CHOICES: readonly GapConfirmOption[] = [
  { value: 'more', label: 'There’s more', intent: 'addition' },
  { value: 'done', label: 'That’s the whole of it', intent: 'done' },
  { value: 'wrong', label: 'Not quite right', intent: 'dispute' },
];

// A DISTINCT WIRE MARKER, for the same reason the Doors board has one: her taps and her prose cross the same
// channel, and the engine must never mistake one for the other in either direction.
const PREFIX = '[gap-confirm]';

/**
 * @param keptDoors the Doors she LEFT ON after seeing what we heard. Omit entirely when the surface has no Doors
 * to show — absent must never be read as "drop them all".
 */
export function serializeGapConfirmChoice(choice: GapConfirmChoice, keptDoors?: string[]): string {
  const kept = keptDoors && keptDoors.length ? ` keep:${keptDoors.join(',')}` : keptDoors ? ' keep:' : '';
  return `${PREFIX} ${choice}${kept}`;
}

/**
 * `null` when this is not a tap — which is the common case, and the safe default. Anything she TYPES must reach the
 * classifier untouched, including the bare word "more": reading her prose as a button press is the mirror of
 * today's bug and would put a decision she never made onto the beat that ends her story.
 */
export function parseGapConfirmChoice(message: string): GapConfirmChoice | null {
  const m = (message ?? '').trim();
  if (!m.startsWith(PREFIX)) return null;
  const rest = m.slice(PREFIX.length).trim().split(/\s+/)[0] ?? '';
  const hit = GAP_CONFIRM_CHOICES.find((c) => c.value === rest);
  // An unrecognised or malformed tap is NOT guessed at — a tap we cannot place must not become one we can.
  return hit ? hit.value : null;
}

/**
 * The Doors she left on, or `null` when the surface sent no list at all.
 *
 * NULL AND EMPTY MEAN DIFFERENT THINGS, and conflating them loses her story. `null` is "no Doors were shown, leave
 * them alone"; `[]` is "she was shown Doors and took every one off", which is a real answer — Jennifer's case at
 * its limit, where none of what we matched was hers.
 */
export function parseGapConfirmDoors(message: string): string[] | null {
  const m = (message ?? '').trim();
  if (!m.startsWith(PREFIX)) return null;
  const tok = m.slice(PREFIX.length).trim().split(/\s+/).find((t) => t.startsWith('keep:'));
  if (tok === undefined) return null;
  return tok.slice('keep:'.length).split(',').map((x) => x.trim()).filter(Boolean);
}

/** The intent a tap resolves to. Exported so the engine never re-derives the mapping at a call site. */
export function gapConfirmIntent(choice: GapConfirmChoice): 'addition' | 'done' | 'dispute' {
  return GAP_CONFIRM_CHOICES.find((c) => c.value === choice)!.intent;
}
