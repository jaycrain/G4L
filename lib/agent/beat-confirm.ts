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

/**
 * THE LEGACY LETTER'S OWN TWO, and the labels are the whole decision.
 *
 * TWO, NOT THREE. Everywhere else "there's more" and "not quite right" are different acts — one adds, one
 * corrects. On a letter they are the same act: you are going back in to change it. The stage already treats them
 * identically (`intent === 'dispute' || intent === 'addition'` → stay on the draft and ask what). A third chip
 * would be a distinction the member has to think about for nothing.
 *
 * "THAT'S MINE", NOT "THAT'S IT". This beat deliberately never asks whether the letter is GOOD — the rule on
 * LEGACY_ASK_REVISION is that "an appraisal question invites a polite yes on the one artifact that has to be
 * theirs." Dropping the standard "That's it" chip here would quietly reintroduce exactly what that rule exists to
 * prevent. Ownership is the question that matters for a letter someone wrote to themselves; quality is not.
 *
 * WHY IT NEEDED A SET OF ITS OWN. Jay, 2026-08-25: he answered "That's great" and the entire letter reprinted —
 * any round that does not cleanly close redraws the whole artifact, so a misread here costs a page of the
 * member's own words handed back with the implication we were not listening. Donna hit the same beat on 8/18
 * ("I just said, it sounds great!") and the Companion's own reply was the diagnosis: "You did — I circled back one
 * time too many." That produced a patch for the "I just said" prefix; Jay's phrasing had no prefix and walked
 * straight through. Seventh instance. The list cannot be finished, so the gate stops being a guess.
 */
export const LEGACY_CONFIRM_CHOICES: readonly BeatConfirmOption[] = [
  { value: 'addition', label: 'Change a line' },
  { value: 'done', label: 'That’s mine' },
];

/** Named choice sets. A tap carries WHICH set it came from, so the member's bubble always shows the label they
 *  actually tapped — never another set's word for the same intent. */
export type BeatConfirmSet = 'default' | 'legacy';
const SETS: Record<BeatConfirmSet, readonly BeatConfirmOption[]> = {
  default: BEAT_CONFIRM_CHOICES,
  legacy: LEGACY_CONFIRM_CHOICES,
};
export const beatConfirmChoices = (set: BeatConfirmSet = 'default') => SETS[set];

// A DISTINCT WIRE MARKER, for the same reason the Doors board and the gap confirm have their own: taps and prose
// cross the same channel, and the engine must never mistake one for the other in either direction.
const PREFIX = '[beat-confirm]';

/** `set:` rides as a second token rather than inside the marker (`[beat-confirm:legacy]`), matching gap-confirm's
 *  `keep:` convention — and keeping the marker a plain `[tag]`, which is the shape looksLikeMachineLine detects. */
export function serializeBeatConfirm(intent: BeatConfirmIntent, set: BeatConfirmSet = 'default'): string {
  return set === 'default' ? `${PREFIX} ${intent}` : `${PREFIX} ${intent} set:${set}`;
}

/** Which choice set a tap came from. Defaults rather than failing: an unknown set still resolves its intent, and
 *  the display falls back to the default wording instead of showing the member a wire string. */
export function parseBeatConfirmSet(message: string): BeatConfirmSet {
  const m = (message ?? '').trim();
  if (!m.startsWith(PREFIX)) return 'default';
  const tok = m.slice(PREFIX.length).trim().split(/\s+/).find((t) => t.startsWith('set:'));
  const name = tok?.slice('set:'.length);
  return name && name in SETS ? (name as BeatConfirmSet) : 'default';
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
  // LOOK IN THE SET THE TAP CAME FROM, not always the default one.
  //
  // This read BEAT_CONFIRM_CHOICES regardless of the `set:` token — while parseBeatConfirmSet, its sibling three
  // lines above, exists solely to read that token. The legacy set survived only by coincidence: both its values
  // ('addition', 'done') also exist in the default set, so the wrong lookup happened to return the right answer.
  //
  // Found while diagnosing the Legacy Letter double-tap on 2026-08-31. It was NOT that bug — I checked before
  // claiming it, and the real cause was a re-emitted draft (v3.5.80). But a set whose values do not overlap the
  // default would return null here, and an unrecognised tap is deliberately NOT guessed at, so the member's tap
  // would vanish with no error anywhere. A latent fault that costs nothing today and everything the day someone
  // adds a chip.
  const hit = beatConfirmChoices(parseBeatConfirmSet(m)).find((c) => c.value === rest);
  // An unrecognised or malformed tap is NOT guessed at — a tap we cannot place must not become one we can.
  return hit ? hit.value : null;
}

/** What a member SEES for a tap, so the wire string can never reach the transcript. Mirrors memberDisplay's rule:
 *  a tap is never prose, anywhere. */
export function beatConfirmDisplay(message: string): string | null {
  const intent = parseBeatConfirm(message);
  if (!intent) return null;
  // Resolved from the SET the tap carried, so the bubble shows the words that were on the button. Without this a
  // member who tapped "That's mine" on their own letter would be shown "That's it" — another set's word for the
  // same intent, and an appraisal where they had made a statement of ownership.
  return beatConfirmChoices(parseBeatConfirmSet(message)).find((c) => c.value === intent)?.label ?? null;
}
