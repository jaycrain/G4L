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

import { matchDoors, hasResignationLanguage } from '../doors.ts';
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
  // "let's do it" / "let's do this" is a member saying GO, not asking for a change — but `let'?s (make|change|do)`
  // swallowed it, so the most enthusiastic possible confirm was read as a revision request at every commit gate.
  // The lookahead keeps "let's do something different" / "let's do three days" firing.
  /\b(can (we|you)|could (we|you)|would you|i'?(d| would) (like|prefer|rather)|i want|let'?s (make|change|do(?! (it|this|that)\b))|make (it|that|them)|change|swap|instead|rather than|add |remove|drop |take out|tweak|adjust|shorten|lengthen|only thing|one thing|except that|other than)\b/i;
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

// ── THE COMMIT GATE: one vocabulary, every arc ────────────────────────────────────────────────────────────────
//
// Every arc that proposes an artifact and asks "commit this?" grew its OWN hand-rolled confirm regex — Rebuild B3,
// Reclaim C1, Reclaim C3, the reclaim shape gate. They were forked from each other, so they share a shape but differ
// in vocabulary, and every one of them has different holes. Measured against one corpus of ordinary confirms, each gate
// missed 14 of 18. A miss is not cosmetic: the member says yes and is answered with "tell me what you'd change",
// which reads as the product not listening. Greg hit it on 2026-08-06 with the single most natural reply available —
// "lock in" — after the Companion itself offered "Want to lock them in, or tweak one?".
//
// So the vocabulary lives here, once, and every gate uses it. New gates inherit it for free; a gap found at any gate
// gets fixed for all of them. tests/confirm-corpus.test.ts asserts the SAME corpus against EVERY gate, which is what
// stops the next fork from drifting.
//
// BIAS AT A COMMIT GATE: a confirm must be UNAMBIGUOUS. A false confirm commits something the member never agreed
// to — silent and unrecoverable. A missed confirm costs one more turn. So the guards below stay strict even as the
// vocabulary widens.
const CONFIRM_CORE_RE = new RegExp(
  '^(?:' +
    [
      "yes|yeah|yep|yup|aye|uh[ -]?huh",
      "sure|ok(?:ay)?|alright|all right|fine",
      "absolutely|definitely|totally|certainly|exactly|precisely|of course|for sure",
      "perfect|great|good|nice|excellent|brilliant|love it|like it",
      // deictic acceptance — "that's it", "that's the one", "this works"
      "th(?:at|is)(?:'?s| is)?\\s+(?:it|the one|right|good|great|perfect|correct|us|me)",
      "th(?:at|is)\\s+works",
      "works(?:\\s+for\\s+me)?",
      "sounds?\\s+(?:good|right|great|perfect)",
      "looks?\\s+(?:good|right|great)",
      "all\\s+good",
      // imperatives — the member telling us to proceed
      "do it|go ahead|go for it|let'?s\\s+(?:do it|go)|send it|run it|start",
      // commit verbs. "lock in" (no object) is the one Greg used and the one every fork was missing.
      "lock(?:ed)?(?:\\s+(?:it|them|'?em|these|those))?(?:\\s+in)?",
      "sav(?:e|ed)(?:\\s+(?:it|that|them|these))?",
      "keep(?:\\s+(?:it|that|them|these))?",
      "commit(?:\\s+it)?|confirm(?:ed)?|done|agreed",
      "i'?m\\s+(?:in|good|ready|happy)|good\\s+(?:with that|to go)|ready|happy with that",
      "please(?:\\s+do)?|yes\\s+please",
    ].join('|') +
    ')\\b',
  'i',
);

/**
 * Does this message COMMIT to the artifact we just proposed?
 *
 * @param also  extra vocabulary specific to one gate, matched anywhere (not anchored) — e.g. the reclaim shape
 *              gate's "merge" / "combine" / "as one", which are answers to ITS proposal and nobody else's.
 */
export function confirmsProposal(message: string, also?: RegExp): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'").trim().replace(/[.,!]+$/, '');
  if (!m) return false;
  // A QUESTION IS NEVER A COMMIT. Greg's next message after the missed confirm was "How will I track it?" — asking
  // how to do the thing is not agreeing to do it, and a vocabulary this wide would otherwise start swallowing
  // questions that happen to open with "good" or "ok". (What a gate SHOULD do with a question is a separate,
  // unbuilt decision; refusing to read it as a yes is the part that belongs here.)
  if (m.endsWith('?')) return false;
  // "yes, but make it twice a week" is a CHANGE, not a confirm (CAT-34) — the leading token is a guess about the
  // whole message, and acting on it commits the un-tweaked artifact and silently drops what they asked for.
  if (hasRevisionTail(m)) return false;
  return CONFIRM_CORE_RE.test(m) || (also?.test(m) ?? false);
}


// A DISPUTE at the gap confirm ("no, that's not quite right") — the member says the reflection is WRONG, with no
// new content to append. Distinct from a bare "no/nope" (which answers "…or is there more?" = no more = done) and
// from an ADDITION (new material). Keyed on explicit wrongness so a plain negation never reopens the beat.
const GAP_DISPUTE_RE =
  /\b(that'?s not (it|right|how|quite)|that wasn'?t (it|right|how)|not (quite|really) (it|right|how)|(you'?(ve| have)? )?got it wrong|that'?s wrong|you'?re wrong|not what i (said|meant)|doesn'?t (fit|sound|feel) right)\b/i;
export function memberDisputesGap(message: string): boolean {
  return GAP_DISPUTE_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// …BUT THAT CONSERVATISM ONLY HOLDS FOR THE "is there more?" QUESTION.
//
// The same predicate was reused at four confirms that ask the OPPOSITE thing — "does that name the shape of it?",
// "is that the one worth chasing?", "is that truer?" — where a bare "no" doesn't mean "no more", it means WE GOT IT
// WRONG. Measured against real dispute phrasings, 9 of 12 were read as `done`: the member pushes back and the engine
// records agreement. That is the most expensive failure this product has — she said "that's not me" and we committed
// it anyway — and unlike a missed capture it can't be recovered, because nothing looks wrong afterwards.
//
// It cannot be fixed by widening GAP_DISPUTE_RE. The families overlap word for word:
//     "Not really, no."            → dispute      "Not really, that covers it."  → done
//     "No, that's not it."         → dispute      "No, that's it."               → done
// Same opening, opposite meaning, and only the QUESTION tells them apart. So the question becomes an argument.
const REFLECTION_REJECT_RE =
  /\b(miss(es|ed)? (the point|it)|you'?(ve| have)? missed|would ?n'?t put it (that|like that) way|would ?n'?t say that|that'?s wrong|off (the mark|base)|not me\b|not how i'?d (say|put) it)\b/i;
const LEADING_NEGATION_RE = /^(no|nope|nah|not really|not quite|not exactly|hmm+[\s,.!—–-]*(no|not)\b)/i;

/**
 * Does the member REJECT the reflection we just offered? For confirms that ask "is this right?", not "is there more?".
 *
 * BIAS TO DISPUTE, deliberately — the asymmetry runs the other way from the gap's. Over-reading a dispute costs a
 * re-open and more drawing-out, which is the program doing its job. Under-reading one commits something they turned
 * down. A confirm that opens with a negation ("No, that's it") is still a confirm: the negation is answering an
 * implied "anything to change?", so an explicit completeness or confirm phrase wins over the leading "no".
 */
// The phrase regexes here were written against contractions ("that's wrong", "that's everything"), so a member who
// types it out in full — "that is wrong", "nope, that is everything" — misses every one of them. Normalising first
// is cheaper and safer than teaching a dozen patterns to spell both ways.
function normalizeContractions(text: string): string {
  return (text ?? '')
    .replace(/[‘’]/g, "'")
    // NEGATIONS FIRST. Folding "I would" → "I'd" ahead of this eats the "would" out of "I would not put it that
    // way", leaving "I'd not put it…" which matches nothing — the rejection disappears into the normaliser.
    .replace(/\b(is|was|were|does|did|do|would|could|should|has|have|had)\s+not\b/gi, "$1n't")
    .replace(/\b(that|it|there|what|he|she|who)\s+is\b/gi, "$1's")
    .replace(/\b(i|you|we|they)\s+would\b/gi, "$1'd");
}

// "Not exactly" / "not quite right" contain a CONFIRM word behind a negation. Without this, the confirm-word guard
// below reads the "exactly" and hands back a confirm — the exact reply that means the opposite.
const NEGATED_CONFIRM_RE = /\bnot\s+(exactly|quite|really|right|it|me|correct|the one|spot on)\b/i;

export function memberRejectsReflection(message: string): boolean {
  const m = normalizeContractions((message ?? '').trim());
  if (!m) return false;
  GAP_CONFIRM_WORDS_RE.lastIndex = 0; // /g regex — a stale lastIndex makes this alternate true/false between calls
  // An explicit COMPLETENESS phrase always outranks a leading negation — "Not really, that covers it" closes the
  // beat even though it opens like a rejection, because "that covers it" is a separate, unambiguous statement.
  if (memberSignalsGapComplete(m)) return false;
  // A confirm WORD is weaker: "not exactly" and "not quite right" contain one behind a negation, and reading it as
  // a confirm hands back the opposite of what she said. So this guard stands down when the word is negated.
  if (!NEGATED_CONFIRM_RE.test(m) && GAP_CONFIRM_WORDS_RE.test(m)) return false;
  if (memberDisputesGap(m)) return true;
  return LEADING_NEGATION_RE.test(m) || REFLECTION_REJECT_RE.test(m);
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
// Resignation to age-decline is a REAL Fade (not no-fade) — this admits them at the Stage-0 gate.
//
// Reads RESIGNATION_CUES directly rather than going through matchDoors, because The Acceptance is no longer a
// Door (Decision C, 2026-08-15). The cue list is UNCHANGED, so admissions are byte-identical to before; what
// changed is that being recognised here no longer stamps a member as having surrendered.
//
// The name is kept: it is referenced by the Stage-0 gate and the Decision E rescue, and renaming it during a
// change that moves the scope gate would make the diff harder to read than it needs to be.
export function isAcceptanceFade(text: string): boolean {
  return hasResignationLanguage(text ?? '');
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
// "I DON'T UNDERSTAND" IS NOT "YES".
//
// The confirm gates classify a reply as dispute / addition / done, and everything unrecognised falls to done —
// deliberately (see the BIAS TO ADVANCE note above: a false "more" loops the beat, and Jay has reported the
// "won't take yes" failure). That bias is right for a hedge or a terse add, both of which the card catches.
//
// It is wrong for exactly one family: a member saying they did not follow us. Jay hit it walking his own account
// — the Companion emitted its graceful fallback, he asked "What do you mean", and the engine read that as
// agreement and ended the Doors excavation into the 24-item IDQ.
//
// So this matcher is deliberately TIGHT rather than clever. It wants a short, meta reply about the utterance —
// "what do you mean", "say that again". A long answer that happens to contain "I don't understand" is a member
// telling us something about their life ("I don't understand why I let it go"), and must never be intercepted.
// Two families, kept apart because they fail differently.
//  BARE — the whole message is the confusion: "huh?", "what?", "sorry?", "wdym". Anchored to the WHOLE string,
//  because "What I mean is the mornings were the part I lost" opens with "what" and is an answer.
const CONFUSED_BARE_RE = /^((sorry|wait|hang on)[\s,]*)?(wdym|huh+|what|sorry|eh|pardon)[\s,.!?]*$/i;
//  PHRASED — an explicit request to rephrase. The trailing object is optional AND so is the space before it,
//  which is what made a plain "I don't understand" slip through the first version of this.
const CONFUSED_PHRASE_RE =
  /\b(what do you mean|what'?s that mean|i (don'?t|do not) (understand|follow|get)( (that|this|you|what you mean))?|not sure what you'?re asking|say that again|said that again|come again|repeat that|you'?ve lost me|you lost me|i'?m lost|didn'?t follow|no idea what you)\b/i;
/** Roughly how much the member said beyond the confusion itself — a real answer is not a request to repeat. */
const CONFUSION_WORD_CAP = 12;
export function memberIsConfused(message: string): boolean {
  const m = (message ?? '').replace(/[\u2018\u2019]/g, "'").trim();
  if (!m) return false;
  if (!CONFUSED_BARE_RE.test(m) && !CONFUSED_PHRASE_RE.test(m)) return false;
  if (CONFUSED_BARE_RE.test(m)) return true; // the whole message is the question — length is already proven
  // "I don't understand why I let it go" is an ANSWER. Length is the cheap, honest separator: a request to
  // rephrase is short. Anything longer is content, and content must reach the gate unintercepted.
  return m.split(/\s+/).length <= CONFUSION_WORD_CAP;
}

export type GapConfirmIntent = 'dispute' | 'addition' | 'done';

/**
 * WHICH QUESTION DID WE JUST ASK? A negation means opposite things depending on it, so the caller must say.
 *  - 'anything_more'  — "…or is there more to it?" (the gap reflect). A bare "no" = no more = DONE.
 *  - 'is_this_right'  — "does that name the shape of it?" (drift, window, the Door insight, a re-seeing offer).
 *                       A bare "no" = we got it WRONG = dispute.
 */
export type ConfirmQuestion = 'anything_more' | 'is_this_right';

export function resolveGapConfirm(
  message: string,
  replyIntent?: ReplyIntent,
  question: ConfirmQuestion = 'anything_more',
): GapConfirmIntent {
  if (replyIntent) return replyIntent === 'dispute' ? 'dispute' : replyIntent === 'more' ? 'addition' : 'done';
  const rejects = question === 'is_this_right' ? memberRejectsReflection : memberDisputesGap;
  if (rejects(message)) return 'dispute';
  if (memberAddingMoreGap(message)) return 'addition';
  return 'done';
}

/**
 * The CORROBORATION GATE around a confirm. The model's `'more'` is a GUESS about what the member meant; when their
 * own words plainly CLOSE the beat and carry no new material, the close wins.
 *
 * Onboarding's gap confirm has had this since Jay's walk. Reconnect's confirms never got it, so a member who
 * answered a landed reflection with "Yes." or "Perfectly depicted." was tagged `'more'` by the model and re-asked
 * the same question — three times, verbatim, in Jennifer's walk (2026-08-05).
 *
 * THIS DOES NOT SHORTEN THE DRAW-OUT. It applies only AFTER the model has decided to reflect and has asked "is that
 * the shape of it?" — a question the member has now answered. During the gather, warmth is still just warmth and
 * the drawing-out is untouched. That is the whole distinction: praise counts as an answer only when we asked.
 *
 * Asymmetric on purpose. Only `'more'` can be overruled: a `'dispute'` always stands (a member pushing back must
 * always be heard), and any reply carrying real material still reads as an addition — so "Yes, and Sarah's in it
 * somewhere" keeps drawing out.
 */
export function resolveConfirmCorroborated(
  message: string,
  replyIntent: ReplyIntent | undefined,
  carriesMaterial: (m: string) => boolean,
  question: ConfirmQuestion = 'anything_more',
): GapConfirmIntent {
  const deterministic = resolveGapConfirm(message, undefined, question);
  // A REJECTION IS NEVER OVERRULED, in either direction: the model can't talk us out of one the member plainly gave,
  // and the corroboration below only ever converts 'more' → 'done'. A member pushing back is always heard.
  if (deterministic === 'dispute') return 'dispute';
  if (deterministic === 'done' && replyIntent === 'more' && !bringsSomethingNew(message, carriesMaterial)) return 'done';
  return resolveGapConfirm(message, replyIntent, question);

  // Measured AFTER a leading affirmation, because members answer a confirm and then keep going in the same breath:
  // "That's it — though the mornings matter more than the lifting does." Testing the raw string lets the opening
  // "That's it" mask the real content behind it, which is the CAT-34 shape ("yes, but make it twice a week") that
  // committed an un-tweaked artifact. A revision tail counts on its own — that's a change request, not new colour.
  function bringsSomethingNew(m: string, hasMaterial: (s: string) => boolean): boolean {
    return hasRevisionTail(m) || hasMaterial(withoutLeadingAffirmation(m));
  }
}

/** Strip an opening "yes / right / exactly / ok," so what FOLLOWS it can be judged on its own. */
export function withoutLeadingAffirmation(message: string): string {
  return (message ?? '').replace(/[‘’]/g, "'").trim().replace(AFFIRM_PREFIX_RE, '').trim();
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
