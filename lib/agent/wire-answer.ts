// A WIRE ANSWER IS A FACT ONLY AT THE SURFACE THAT OFFERED IT.
//
// THE OTHER HALF OF THE TAP RULE. On 2026-09-01 we fixed the first half: four beats offered chips and then read
// the reply with the free-text classifier, so a tap arrived and nothing happened ("I clicked That's It button and
// it kept coming back"). The fix was to read the tap FIRST, at every site. This file is the complement — the
// question that fix never asked, which is whether we offered the chips at all.
//
// WHY IT MATTERS, and it is not hypothetical. `memberWantsToAdvance` reads a tap first and treats `done` as an
// instruction to move on, bypassing the draw-out's depth floor. So a beat-confirm string arriving at a beat that
// is NOT waiting on one will advance a Door the member has said nothing about. The live sequence:
//
//   1. She taps "That's it" on The Load-Bearer's insight → the confirm resolves, the Door is banked, the next
//      Door's opener goes on screen. The engine is now mid-draw-out on a Door she has not spoken about.
//   2. A SECOND copy of that same tap arrives — a double-tap, a retried request, a client resend.
//   3. It reaches the draw-out, `memberWantsToAdvance` says yes, and the new Door jumps straight to its insight
//      check at depth 1 on the strength of a tap that belonged to the previous Door.
//
// A duplicate submit is the most ordinary thing a member can do. Anywhere else it is idempotent; here it silently
// skips the excavation of a Door and then reports it walked.
//
// FOUND BY THE GATE, AND NOT AS A FAILURE. The walk passed. The instrumentation left behind after the double-back
// logged "tap reached the draw-out, not the confirm" on two consecutive green runs, which is the only reason
// anyone looked. A passing test with a warning in it is still evidence. [[read-the-artifact-not-the-summary]]
//
// DERIVED, NOT STORED — the rule `expectsForResume` already sets out. Recording "what we offered last turn" in
// the session row would be a second copy of something the state already determines, wrong for every session
// saved before it shipped, and one more field to keep in step. Each kind's offer condition is a pure function of
// the state, and is written once, here.

import { serializeBeatConfirm } from './beat-confirm.ts';
import { serializeGapConfirmChoice, GAP_CONFIRM_CHOICES } from './gap-confirm-choice.ts';
import { serializeBoardSubmission } from '../reconnect/doors-board-claim.ts';

/** The kinds that cross the wire as a serialized string. `scale`, `identity_pick`, `reclaim_list` and `domain_pick`
 *  submit plain text a member could equally type, so there is nothing to mistake in either direction. */
export type WireKind = 'beat_confirm' | 'gap_confirm' | 'doors_board';

/** The leading `[tag]` of a serialized answer. */
const marker = (wire: string): string => wire.match(/^\[[a-z0-9_-]+\]/i)?.[0] ?? '';

// THE MARKERS COME FROM THE SERIALIZERS, not from a list retyped here. Each prefix is a private const in its own
// module, and a fourth hand-copy is precisely how the tap rule ended up true in some places and not others. Ask
// the serializer what it writes and the detector cannot drift from it — rename a prefix and this follows.
const KIND_BY_MARKER: Record<string, WireKind> = {
  [marker(serializeBeatConfirm('done'))]: 'beat_confirm',
  [marker(serializeGapConfirmChoice(GAP_CONFIRM_CHOICES[0]!.value))]: 'gap_confirm',
  [marker(serializeBoardSubmission({ doors: [], quietDrift: false, first: null, biggest: null, stillOpen: [] }))]: 'doors_board',
};

/** Which structured surface this message claims to be answering — `null` for ordinary prose, the common case. */
export function wireAnswerKind(message: string): WireKind | null {
  const m = marker((message ?? '').trim());
  return m ? KIND_BY_MARKER[m] ?? null : null;
}

/** The minimum shape needed to rule on this — structural rather than importing ConvState, so this module keeps
 *  no dependency on the kernel it guards. */
export type OfferState = {
  stage?: string;
  awaitingConfirm?: boolean;
  collected?: { boardDone?: boolean };
};

/**
 * Was this surface actually on screen when the member answered it?
 *
 * `beat_confirm` — TRUE EXACTLY WHEN `awaitingConfirm` IS SET. All five sites that offer these chips (the Doors
 * insight, drift, the window, and both legacy revision beats) set `awaitingConfirm = true` in the same branch.
 * That is what makes this derivable, so it is asserted by a test rather than left as a comment: a sixth site that
 * offers chips without the flag would make this guard start refusing real taps.
 *
 * Note these chips are NOT produced by `nextExpects` — the handlers set `b.expects` directly — so unlike the gap
 * confirm and the board there is no shared derivation to reuse, and the condition is stated here.
 */
export function wireAnswerWasOffered(kind: WireKind, state: OfferState): boolean {
  switch (kind) {
    case 'beat_confirm':
      return state.awaitingConfirm === true;
    // The gap confirm is offered only while the beat is waiting on her (nextExpects, same condition).
    case 'gap_confirm':
      return state.awaitingConfirm === true;
    // The board is offered until she submits it; `boardDone` is what stops it reappearing under every later turn.
    case 'doors_board':
      return !state.collected?.boardDone;
  }
}

/**
 * A serialized answer to a surface that was not on screen — a duplicate submit, a retry, or a client resend.
 *
 * ONLY ONE DIRECTION IS DANGEROUS, which is why this is not symmetric with the parsers. Prose read as a tap puts
 * a decision on the member that they never made; a stale tap read as prose is inert, because a wire string is not
 * English and every classifier below already declines it. So this refuses to let a stale tap ACT, and does not
 * try to interpret it.
 */
export function isStaleWireAnswer(message: string, state: OfferState): boolean {
  const kind = wireAnswerKind(message);
  return kind !== null && !wireAnswerWasOffered(kind, state);
}
