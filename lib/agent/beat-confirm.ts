// THE BEAT CONFIRM AS A TAP — the general form of the fix that already worked once.
//
// `gap-confirm-choice.ts` is the precedent and its reasoning applies unchanged here: reading a member's free-text
// answer three ways (agree / add / correct) with regex vocabulary took FIVE patches in two days and still leaked,
// because English has unlimited ways to say yes. The list cannot be finished. "A better classifier is a better
// guess. A tap is a fact."
//
// ── WHY THIS EXISTS NOW ──────────────────────────────────────────────────────────────────────────────────────
//
// Jay's walk, 2026-08-25. He was asked "Does that Tuesday feel like the one worth chasing — or is there more to
// it?", answered "Absolutely", and the next turn ended with "Is that the one worth chasing — or not quite it
// yet?". He answered a question and was asked it again.
//
// The mechanism is not a bad classifier. The MODEL asked that first question, so `awaitingConfirm` was never set
// — the engine only raises it when IT emits a reflection. His answer therefore went to `gather`, which decided
// the beat was ready, reflected, and appended the engine's own confirm. And the appending rule was "does the
// model's text end in a question mark?", which fails on the one thing it most needs to recognise: a CLOSE is a
// complete turn precisely BECAUSE it has no question. The engine advanced because `drawoutShouldReflect` read the
// model as having wrapped up, then immediately un-wrapped it by stapling on a question.
//
// ── WHAT WE ARE NOT DOING, AND WHY ───────────────────────────────────────────────────────────────────────────
//
// Not detecting from prose that the model asked a confirm, or that a turn is a close. That is stage-agreement
// prose-detection, which was built, shipped, and REVERTED — it told a member her own protest was a goal. Giving
// the model authority to declare its own control flow is the same wrong direction: every recurring failure in
// this product is the engine acting on a model judgement that contradicted what the member plainly said.
//
// So the engine stops MANUFACTURING questions, and where a beat genuinely needs a ruling it offers chips. The
// model owns the words, the engine owns the gate, and neither guesses at the other.
//
// ── THE THREE INTENTS ARE NOT NEW ────────────────────────────────────────────────────────────────────────────
//
// addition / done / dispute are exactly what `resolveConfirmCorroborated` already routes on at every drawout
// confirm. This replaces the guess at that fork; it does not add a fourth path. The text box stays and typed
// replies still fall through to the classifier — the chips make the unambiguous path the default one.

export type BeatConfirmIntent = 'addition' | 'done' | 'dispute';

export type BeatConfirmOption = {
  value: BeatConfirmIntent;
  /** What the member reads. In THEIR voice — something they would say, never an instruction we issue. */
  label: string;
};

/**
 * ORDER IS THE VIBE DECISION, and it is inherited deliberately from the gap confirm rather than re-argued.
 *
 * "There's more" LEADS. The first option is the one a surface signals it expects, and a drawout beat must never be
 * the place a member feels moved along — they set the depth (the Independence Guarantee). Putting "that's it"
 * first would quietly say we are ready to be finished with them. "Not quite right" sits last rather than being
 * hidden, because correcting us has to look as available as agreeing.
 */
export const BEAT_CONFIRM_CHOICES: readonly BeatConfirmOption[] = [
  { value: 'addition', label: 'There’s more' },
  { value: 'done', label: 'That’s it' },
  { value: 'dispute', label: 'Not quite right' },
];

// A DISTINCT WIRE MARKER, for the same reason the Doors board and the gap confirm have their own: taps and prose
// cross the same channel, and the engine must never mistake one for the other in either direction.
const PREFIX = '[beat-confirm]';

export function serializeBeatConfirm(intent: BeatConfirmIntent): string {
  return `${PREFIX} ${intent}`;
}

/**
 * `null` when this is not a tap — the common case, and the safe default. Anything the member TYPES must reach the
 * classifier untouched, including the bare word "more": reading their prose as a button press is the mirror of the
 * bug this replaces, and would put a decision they never made onto the beat that ends their story.
 */
export function parseBeatConfirm(message: string): BeatConfirmIntent | null {
  const m = (message ?? '').trim();
  if (!m.startsWith(PREFIX)) return null;
  const rest = m.slice(PREFIX.length).trim().split(/\s+/)[0] ?? '';
  const hit = BEAT_CONFIRM_CHOICES.find((c) => c.value === rest);
  // An unrecognised or malformed tap is NOT guessed at — a tap we cannot place must not become one we can.
  return hit ? hit.value : null;
}

/** What a member SEES for a tap, so the wire string can never reach the transcript. Mirrors memberDisplay's rule:
 *  a tap is never prose, anywhere. */
export function beatConfirmDisplay(message: string): string | null {
  const intent = parseBeatConfirm(message);
  return intent ? (BEAT_CONFIRM_CHOICES.find((c) => c.value === intent)?.label ?? null) : null;
}
