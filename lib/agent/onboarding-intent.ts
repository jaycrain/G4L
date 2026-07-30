// Onboarding INTENT — the one place that decides what a member's utterance MEANS.
//
// WHY THIS MODULE EXISTS: the staged engine (onboarding-staged.ts) is a state machine — it sequences stages and
// gates transitions. Every one of those gates needs to read the meaning of a free-text reply ("are they done?
// disputing? adding more? closing the list? a real fade or forward ambition?"). Historically those detectors
// were scattered through the engine as ~15 ad-hoc regexes, and every new persona phrasing meant hunting for the
// right one to widen — the exact whack-a-mole CLAUDE.md warns against. Consolidating them here gives ONE audited
// surface for "meaning," a single fixture table (tests/onboarding-intent.test.ts) to extend when a new phrasing
// slips through, and a clean seam for a future move from regex-inferred to model-signaled intent (the same
// "model proposes, engine disposes" pattern we already use for reflect_gap).
//
// CONTRACT: every function here is PURE (text in, classification out) and replayable. The engine composes them;
// it never re-implements meaning inline. Bias, where it matters, is documented per-function (e.g. the gap confirm
// biases to ADVANCE — a false "there's more" loops the beat, a missed terse add is caught by the card).
//
// TAXONOMY:
//   A. Reply intent at a confirm/gather — corrects / disputes / adds-more / signals-done / closes / deflects.
//   B. Capture-worthiness — should this message be captured as the gap / a reclaim want?
//   C. Fade & scope — is this a real Fade (loss/drift), forward ambition (decline), or Acceptance (resignation)?
//   D. Resolvers — compose the primitives into the single decision a stage needs (e.g. resolveGapConfirm).

import { matchDoors } from '../doors.ts';
import { gapIsNarrative } from './onboarding-contract.ts';
import { confirmsWhole, isAffirmation, memberWantsToWrap, type ReplyIntent } from './onboarding.ts';

// =======================================================================================================
// A. REPLY INTENT — what a member's reply to a reflection/question means
// =======================================================================================================

// The ONLY signal a simple confirm needs: did the member CORRECT the reflection? Everything else (an affirmation,
// or an ambiguous reply) advances — a reflection with no dispute moves on, so the transition can never trap.
const CORRECTION_RE =
  /\b(no|nope|not (quite|really|it|her|him|that|right)|that'?s not|that wasn'?t|wrong|isn'?t (it|her|right)|actually|what do you mean|doesn'?t (fit|feel|sound|seem))\b/i;
// The isAffirmation guard lets the colloquial "yeah no, that's her" (a yes) through as NOT a correction.
export function correctsReflection(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return CORRECTION_RE.test(m) && !isAffirmation(m);
}

// One shared "member is deflecting / closing / refusing" signal, used by both capture backstops so neither grabs
// a refusal as content (front-loader's "I'm not going to answer that again" became the gap — this kills that).
const DEFLECT_RE =
  /\b(i'?m not (going to |gonna )?(answer|engage|doing this)|not answering|i'?ve (answered|already)|already (said|told|answered)|stop asking|we'?re (good|done|fine)|that'?s (all|it|enough)|let'?s (move|keep going|proceed)|move (on|forward|along)|moving on)\b/i;
export function memberDeflecting(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return memberWantsToWrap(m) || DEFLECT_RE.test(m);
}

// The member signalling the fade story is WHOLE ("that's the whole of it", "no more", "more or less it for now").
// Until this fires (or a turn adds nothing new), the gap stage keeps RECEIVING so a multi-event story fully
// surfaces (and its Doors with it) before we reflect and advance.
const GAP_DONE_RE =
  /\b(that'?s (the )?(whole|all|it|everything|gist|story|picture|heart)|the (whole|full) (story|picture|thing|of it)|no(thing)? (more|else)|no more|that'?s how it (went|happened|unfolded)|that covers it|that'?s (about|more or less|pretty much|roughly|basically) it|that was (about|more or less|pretty much) it|more or less it|it for now|(that )?(about )?sums it up|that'?s most of it|pretty much it|that'?s the heart|that'?s (about |pretty much |roughly )?(the )?(size|shape) of it|(that'?s |that is )?the (size|shape) of it|that'?s the shape)\b/i;
export function memberSignalsGapComplete(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return confirmsWhole(m) || memberWantsToWrap(m) || GAP_DONE_RE.test(m);
}

// Contract 2 (advance) — the Independence-Guarantee signal for a DRAW-OUT stage: the member is asking to move on, says
// they're done, or deflects. A draw-out stage that sees this must advance rather than re-pose (never loop). Composes
// the existing wrap + deflect detectors — one name the arcs pass into drawoutShouldReflect.
export function memberWantsToAdvance(message: string): boolean {
  return memberSignalsGapComplete(message) || memberDeflecting(message);
}

// ONE "the member is closing the Reclaim List" signal — consolidates the close shapes (wrap, whole, and the
// reclaim-specific "that's the list / those are the real ones / those are the highlights / solid start" closings).
// This is what makes the warm nudge fire at the RIGHT moment (a soft-close below the minimum) instead of a bare
// "what else?", and keeps the backstop from grabbing a close/refusal as a fabricated item. The canonical corpus
// this MUST satisfy is locked with consolidateReclaim's drop-vocab in tests/reclaim-close-vocab.test.ts (the two
// detectors serve different jobs — unanchored intent here vs anchored whole-item drop there — but must AGREE on
// what counts as a close, so a phrase like "those are the highlights" can never be re-asked here yet persisted there).
const RECLAIM_CLOSE_RE =
  /\b(that'?s (actually |really |pretty much |honestly )?(it|all|everything|the list)|those are (the )?(real|only|main|biggest|big|top) ones|those are (the )?highlights|the highlights|that'?s (my|the) (real )?list|the (real )?list( is)?( complete| done| it)?|i'?m (good|done|ready)|i'?ve (answered|said|told you)|(let'?s |can we )?(move on|moving on|move forward|keep going)|i'?m (stepping away|not answering|done answering)|(that )?(about )?sums it up|that'?ll do|that covers it|(that'?s )?(a )?(pretty |fairly )?(solid|good|decent|fair|great) (start|list)|good enough|(that|this) (looks|sounds) (great|good|right|perfect|spot on)|that'?s (great|perfect|it exactly|the one)|love (it|that)|perfect|looks great|that'?s about it|that'?s (about |pretty much )?(the )?shape of it|(that'?s )?the shape of it|that'?s (it|everything|all)( for now)?|(i think )?that'?s about (it|everything)|(i )?do(n'?t| not) think so|not that i can think of)\b/i;
export function memberClosingReclaim(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return memberDeflecting(m) || confirmsWhole(m) || RECLAIM_CLOSE_RE.test(m);
}

// =======================================================================================================
// CAT-34 — "yes, BUT…" — the REVISION TAIL guard (shared by every propose→confirm point).
// =======================================================================================================
// Every confirm predicate in the arcs is ^-anchored on the leading token, so "yes, but make it twice a week"
// matched `^yes\b` and committed the UN-TWEAKED artifact — silently dropping the member's change. Same root as
// the reclaim/gap/door bugs: a leading word is a GUESS about the whole message, and it outranked what the member
// actually said. A confirm must be a WHOLE-message intent.
//
// This detects the tail that turns an affirmation into a change request. Deliberately conservative — a warm
// confirm ("yes, that's perfect", "yeah exactly right", "yes but that's fine") must still CONFIRM, or we'd trap
// members in an adjust loop, which is its own failure.
const CHANGE_REQUEST_RE =
  /\b(can (we|you)|could (we|you)|would you|i'?(d| would) (like|prefer|rather)|i want|let'?s (make|change|do)|make (it|that|them)|change|swap|instead|rather than|add |remove|drop |take out|tweak|adjust|shorten|lengthen|only thing|one thing|except that|other than)\b/i;
const CONTRAST_RE = /\b(but|although|though|however|except)\b/i;

/**
 * Does this message carry a REVISION after its affirmation? True = do NOT treat it as a plain confirm; route it
 * to the adjust/refine path so the member's change is honoured instead of discarded.
 */
export function hasRevisionTail(message: string): boolean {
  const m = (message ?? '').replace(/[\u2018\u2019]/g, "'").trim();
  if (!m) return false;
  if (CHANGE_REQUEST_RE.test(m)) return true; // an explicit ask — no ambiguity
  // A bare contrast word only counts when SUBSTANCE follows it ("yes but that's fine" is still a confirm;
  // "yes but I'd want Tuesdays and Thursdays" is not). Measured on the text AFTER the contrast word.
  const hit = CONTRAST_RE.exec(m);
  if (!hit) return false;
  const tail = m.slice(hit.index + hit[0].length).trim();
  return tail.split(/\s+/).filter(Boolean).length >= 4;
}

/** A plain, whole-message confirm: the predicate says yes AND there's no revision riding along. */
export function isPlainConfirm(message: string, predicate: (m: string) => boolean): boolean {
  return predicate(message) && !hasRevisionTail(message);
}


// A DISPUTE at the gap confirm ("no, that's not quite right") — the member says the reflection is WRONG, with no
// new content to append. Distinct from a bare "no/nope" (which answers "…or is there more?" = no more = done) and
// from an ADDITION (new material). Keyed on explicit wrongness so a plain negation never reopens the beat.
const GAP_DISPUTE_RE =
  /\b(that'?s not (it|right|how|quite)|that wasn'?t (it|right|how)|not (quite|really) (it|right|how)|(you'?(ve| have)? )?got it wrong|that'?s wrong|you'?re wrong|not what i (said|meant)|doesn'?t (fit|sound|feel) right)\b/i;
export function memberDisputesGap(message: string): boolean {
  return GAP_DISPUTE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// At the gap reflect-confirm we ask "…does it land, or is there more to it?" — so an answer that ADDS material
// ("yeah, there was work too") is a MORE signal, NOT a move-on. Detection = strip the acknowledgement, see what's
// LEFT. A confirmation ("yes, you've got it", "that lands", "exactly right") is nothing but affirmation + a meta-
// acknowledgement — stripping both leaves no content word. An addition ("and my mom got sick") leaves a real
// topic behind. More robust than a length threshold (a short confirm and a short addition are the same length),
// and it doesn't need a growing list of "more"-phrases — it recognises the closed set of confirmations and treats
// everything else as still-telling-it. BIAS TO ADVANCE: a false "more" loops the beat (Jay: "won't take yes"); a
// missed terse add is caught by the card.
const AFFIRM_PREFIX_RE =
  /^(yeah|yes|yep|yup|sure|ok(ay)?|right|true|correct|exactly|totally|definitely|absolutely|for sure|i guess|kind of|sort of|mm+|uh[ -]?huh)[\s,.!—–-]*/i;
const GAP_CONFIRM_WORDS_RE =
  /\b(you'?(ve|d| have)?\s*(got|nailed)\s*(it|that)|that'?s (it|right|me|correct|the one|spot on)|(it|that) (lands|fits|works|tracks)|spot on|exactly( right)?|absolutely|totally|definitely|perfect(ly)?|precisely|nailed it|got it|makes sense|understood)\b/gi;
export function memberAddingMoreGap(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (!m) return false;
  if (memberSignalsGapComplete(m)) return false; // "that's it / no more / more or less it for now" → advance
  const residual = m.replace(AFFIRM_PREFIX_RE, '').replace(GAP_CONFIRM_WORDS_RE, ' ').replace(/[^a-z]+/gi, ' ').trim();
  const contentWords = residual.split(/\s+/).filter((w) => w.length >= 3);
  if (contentWords.length === 0) return false; // bare acknowledgement/negation → advance
  if (hasLossSignal(m)) return true; // a new loss / Door signal → clearly more fade material, keep drawing out
  // Otherwise require a FRESH CHAPTER's worth of content — not a short meta reply ("I just did", "not really").
  return m.length >= 25 && contentWords.length >= 4;
}

// =======================================================================================================
// B. CAPTURE-WORTHINESS — is this message the gap / a reclaim want the engine should capture?
// =======================================================================================================

// Stage-scoped gap backstop test: when the model conversed but never called set_gap, is the member's OWN message
// a real-fade narrative safe to capture as the gap? A clear Door signal counts even in a terse fragment ("Knee.
// Then divorce."); otherwise an inferred gap must be a substantial real-fade narrative WITH a loss signal (this
// is what stops a no-fade optimizer's ambition from being backstopped as a fade).
const STAGED_GAP_MIN_CHARS = 80;
export function shouldCaptureStagedGap(message: string): boolean {
  const m = (message ?? '').trim();
  if (memberDeflecting(m) || isAffirmation(m) || isForwardAmbition(m)) return false; // never a wrap/refusal/ambition
  if (matchDoors(m).length > 0) return true; // a recognized Door event IS a fade, any length
  if (m.length < STAGED_GAP_MIN_CHARS) return false;
  return isRealFade(m) && hasLossSignal(m);
}

// Stage-scoped RECLAIM backstop test: in the reclaim stage every substantive member message IS a want, so
// capturing it is safe (no other field to contaminate). Reject wraps/affirms/uncertainty/stage-directions so
// refusals and "that's all" don't become list items. Lossy-but-recoverable — the card is the seatbelt.
const UNCERTAIN_RE = /\b(i (don'?t|do not) know|not sure|no idea|i'?m not sure|dunno|can'?t think of)\b/i;
export function shouldCaptureStagedReclaim(message: string): boolean {
  const m = (message ?? '').replace(/\*[^*]*\*/g, '').replace(/[‘’]/g, "'").trim(); // drop *stage directions*
  if (m.length < 6) return false;
  if (memberWantsToWrap(m) || isAffirmation(m) || correctsReflection(m)) return false;
  if (UNCERTAIN_RE.test(m) && m.length < 40) return false;
  return true;
}

// =======================================================================================================
// C. FADE & SCOPE — real Fade vs forward ambition (decline) vs Acceptance (resignation). The Stage-0 gate.
// =======================================================================================================
// Our member feels a REAL Fade — a felt distance from who they were (loss/decline/drift). A forward-looking
// optimizer with no loss ("nothing went wrong, I just want more") is NOT our member; the system DECLINES them,
// never fabricates a fade (locked scope, Jun 2026; onboarding-open-issues Issue 2).
const AMBITION_RE =
  /\b(optimi[sz]e|level[ -]?up|next (level|challenge|chapter|thing)|bigger|faster|scale|start[- ]?up|peak|keep (leveling|growing|building|pushing)|doing (great|well|amazing)|thriving|just want more|want to keep)\b/i;
// EXPLICIT no-fade declarations. These contain loss WORDS ("no loss", "no drift") but assert the OPPOSITE — so we
// test them first and strip them before reading LOSS_RE, or the negation flips the result.
const NO_LOSS_RE =
  /\b(no (real )?(loss|drift|regret|hardship|crisis)( or (loss|drift|regret|hardship))?|nothing (ever |really )?(went |is )?wrong|haven'?t (drifted|lost|fallen)|don'?t feel (a |any )?(loss|drift|gap))\b/i;
const LOSS_RE =
  /\b(lost|loss|losing|died|death|passed|sick|illness|diagnos|divorce|laid off|layoff|let go|left me|gone|stopped|gave up|drift|faded|fading|disappear|alone|lonely|empty|caregiver|caring for|injur|grief|grieving|miss(ed|ing)?|used to|no longer|slipped away|fell apart|burned out|breakdown)\b/i;
// Negated-loss DECLARATIONS beyond NO_LOSS_RE's "no X" — "not carrying any loss", "without loss", "don't feel any
// drift". These assert the ABSENCE of a fade, so we strip them before reading LOSS_RE, or the loss word inside the
// negation ("any loss") false-positives as a real fade (the incidental-token bug). Conservative: the negation must
// bind tightly to the loss word, so a REAL loss with an incidental negation ("can't stop thinking about the loss")
// is NOT stripped. (CAT-03/CAT-06)
const NEG_LOSS_RE =
  /\b(?:no|not|without|zero|not carrying(?: any)?|don'?t (?:have|feel)(?: any)?|haven'?t (?:felt|had)(?: any)?)\s+(?:real\s+|a\s+|any\s+|sense of\s+)*(?:loss|drift|distance|regret|gap|hardship|crisis|fade)\b/gi;
// Real loss LANGUAGE, ignoring explicit "no loss / nothing wrong" declarations. Keyed on loss VERBS/events, NOT a
// Door-name match — "marriage is genuinely good" mentions "marriage" but is not a loss.
export function hasGenuineLoss(text: string): boolean {
  // Strip ALL "no loss / no drift" declarations (global) — a corpus can repeat them, and a leftover would trip LOSS_RE.
  const stripped = (text ?? '')
    .replace(new RegExp(NO_LOSS_RE.source, NO_LOSS_RE.flags + 'g'), ' ')
    .replace(NEG_LOSS_RE, ' ');
  return LOSS_RE.test(stripped);
}

// REDUCTION / REROUTE language — the ORDINARY fade voiced WITHOUT loss-verbs: freedom/time/self getting squeezed,
// rerouted, or put on hold as life accumulates. This is the Doors-accumulation member (G4L's MOST common fade), whose
// story the loss-verb vocabulary completely misses ("didn't have that freedom anymore", "no time for myself",
// "everything had to fit around the kids", "shifted my priorities", "put myself last"). A HARD real-fade signal. (CAT-01)
const REDUCTION_RE =
  /\b(anymore|no (more )?time (for|to)\b|no (space|room)( left)? for (myself|me|us)|had to fit (it|them|everything|around)|crowded out|squeezed out|less time for|put (myself|me|it|them) (on hold|aside|last|second|on the back ?burner)|on the back ?burner|gave up|stopped (doing|going|playing|training|riding|making time)|slipped away|fell away|lost touch|shifted (my |our )?priorities|no longer (have|had|do|make|had time)|don'?t (have|make) (the )?time)\b/i;
export function hasReductionLanguage(text: string): boolean {
  return REDUCTION_RE.test(text ?? '');
}

// An AFFIRMATIVE no-fade DECLARATION — the genuine forward optimizer positively asserting there's no loss/drift and
// they simply want MORE. This is POSITIVE evidence of no-fade (never mere absence), and it's what the decline gate
// keys on — so an incidental loss token can't fabricate a fade, and a real fade is never turned away by silence. (CAT-03)
const THRIVING_RE =
  /\b(nothing (ever |really )?(went|is|feels?) (wrong|off|missing)|nothing('?s| is) missing|no (real )?(loss|drift|distance|regret|gap|hardship|crisis)\b|not carrying (any )?(loss|distance|weight)|(i'?m|i am|i feel|feeling|i'?m just) (great|amazing|fulfilled|wonderful|thriving)|life('?s| is) (great|good|full|amazing|wonderful)|no drift|no distance|just want (more|to (level up|optimi|grow|do more))|reaching forward|want to keep (leveling|growing|building|pushing)|i just want more)\b/i;
export function declaresThriving(text: string): boolean {
  return THRIVING_RE.test(text ?? '');
}
export function isForwardAmbition(text: string): boolean {
  const t = text ?? '';
  if (hasGenuineLoss(t)) return false; // a genuine loss verb wins — a real fade can still say "no crisis"
  return NO_LOSS_RE.test(t) || AMBITION_RE.test(t); // explicit no-fade declaration, or pure forward ambition
}
// A Door match still counts as a loss signal (a terse "Knee. Then divorce." names The Marriage) — but only
// alongside the length/ambition guards in shouldCaptureStagedGap, so a Door-name mention can't sneak a gap in alone.
export function hasLossSignal(text: string): boolean {
  return hasGenuineLoss(text) || matchDoors(text ?? '').length > 0;
}
// A captured gap is a REAL fade (not ambition). The model's explicit set_gap is trusted unless it's clearly
// ambition; the backstop is stricter (requires a loss signal) since it's inferring from an untagged message.
export function isRealFade(text: string): boolean {
  return gapIsNarrative(text, []) && !isForwardAmbition(text);
}
// Resignation to age-decline = The Acceptance (a REAL Fade, not no-fade). Read from the whole gap-stage corpus.
export function isAcceptanceFade(text: string): boolean {
  return matchDoors(text ?? '').includes('acceptance');
}

// =======================================================================================================
// D. RESOLVERS — compose the primitives into the single decision a stage needs
// =======================================================================================================

// The gap reflect-confirm asks "…or is there more to it?". Three outcomes, in priority order:
//   • dispute  — the reflection is WRONG ("no, that's not right") → reopen the beat (keep the gap + Doors).
//   • addition — substantive NEW material ("and my divorce that year") → append it and draw it out.
//   • done     — everything else, incl. a bare "no/nope/that's it/more or less it" → advance to reclaim.
// A plain negation is DONE, not a dispute (it answers "…or is there more?" = no more). This ordering is what
// stopped the beat looping when a member is plainly finished (Jay's walk: "won't take yes for an answer").
//
// v2.2 Phase 2.1 — MODEL-SIGNALED: when the model tags the member's reply (replyIntent), we USE it (the model
// reads "nope, that's a good list" far more reliably than a regex). The regex remains the FALLBACK for when the
// model doesn't signal — so the phrase corpus still holds, and a mis-signal is still caught by the card seatbelt.
// This is the intent half of "model proposes, engine disposes": the engine bounds it (the confirm only exists
// AFTER a floor/cap-bounded, verbatim-quoting reflect), so a signal can't skip the draw-out.
export type GapConfirmIntent = 'dispute' | 'addition' | 'done';
export function resolveGapConfirm(message: string, replyIntent?: ReplyIntent): GapConfirmIntent {
  if (replyIntent) return replyIntent === 'dispute' ? 'dispute' : replyIntent === 'more' ? 'addition' : 'done';
  if (memberDisputesGap(message)) return 'dispute';
  if (memberAddingMoreGap(message)) return 'addition';
  return 'done';
}

// The reclaim reflect-confirm asks "Anything missing before we move on?". A bare "no / nope / that's a good list /
// that's the list" ANSWERS that question — nothing missing = DONE → the card. Only an explicit request to CHANGE
// the list ("no, take the hiking one off", "actually I meant…") reopens. (New OFFERS — another want — are handled
// by the engine's late-add before this is consulted.) Without this, correctsReflection read the leading "nope" as
// a correction and reopened, re-capturing fragments as duplicates and letting the model free-text an IDQ pitch
// (Jay's walk). Mirrors resolveGapConfirm: a plain negation answering the question is DONE, not a dispute.
const NEGATION_PREFIX_RE = /^(no|nope|nah|not really|not quite)[\s,.!—–-]*/i;
export type ReclaimConfirmIntent = 'change' | 'done';
export function resolveReclaimConfirm(message: string, replyIntent?: ReplyIntent): ReclaimConfirmIntent {
  // Model-signaled (Phase 2.1): 'done' → the card; 'more'/'dispute' → reopen the gather to change/add. Regex below
  // is the fallback. (A brand-new want at the confirm is captured by the engine's late-add BEFORE this is consulted.)
  if (replyIntent) return replyIntent === 'done' ? 'done' : 'change';
  const m = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (!correctsReflection(m) || memberClosingReclaim(m)) return 'done'; // affirm / bare-no / close → done
  // A correction — reopen only if there's real substance to change (not a bare "no/nope").
  const residual = m.replace(NEGATION_PREFIX_RE, '').replace(AFFIRM_PREFIX_RE, '').replace(/[^a-z]+/gi, ' ').trim();
  return residual.split(/\s+/).filter((w) => w.length >= 3).length >= 3 ? 'change' : 'done';
}
