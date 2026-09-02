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

import { isConversationalMeta, isAboutTheApp } from './conversational-meta.ts';
import { parseBeatConfirm } from './beat-confirm.ts';
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

/**
 * "Nothing needs changing here" — the legitimate NO-CHANGE answer to a question that invites a revision.
 *
 * DONNA SAID THIS SIX TIMES IN ONE SESSION AND COUNTED (2026-08-30): *"I ended up saying 'list holds' or 'list is
 * fine' six times (I counted)."* Then: *"it keeps reverting to its protocol and asking more questions… It moved on
 * when I explicitly asked it to twice."*
 *
 * WHY IT HAPPENED. C1 runs Greg's six revision passes, and each pass advanced on `memberDeflecting`. That signal
 * was built for REFUSAL — "stop asking", "we're done", "I already said" — not for the answer the passes actually
 * invite. So "list holds", "list is fine", "nothing to change", "no changes" and "the list stands" all read as
 * *not an answer*, and each pass held her for up to PASS_MAX_TURNS before giving up. Six passes of that.
 *
 * The code one line above the bug already stated the rule: *"'Nothing' is an answer, not a failure to answer."*
 * The predicate underneath it did not implement that sentence. A rule that exists and does not run.
 *
 * NOT A RELAXATION OF GREG'S INSTRUMENT. The six passes stay, in his order, asking his questions. This only lets
 * an answer count as an answer — the member saying "nothing here" is her ANSWERING the pass, and it was being
 * treated as her dodging it (dont-relax-the-experts-instrument).
 *
 * TWO TIERS, because a bare "fine" is only safe when it is the whole message. Specific phrases match anywhere;
 * generic affirmatives match only a short reply. That keeps "my marriage holds me back" — which contains "holds"
 * — from being read as "the list holds".
 */
const NO_CHANGE_SPECIFIC_RE =
  /\b(list (holds|stands|is (fine|good|right)|looks (fine|good|right))|nothing (to change|needs changing|to add|to drop|else to add)|no (changes?|edits?|additions?)|nothing'?s changed|same as (before|it was)|leave (it|them|the list) (as is|alone|be)|keep (it|them|the list) (as is|the same))\b/i;
const NO_CHANGE_SHORT_RE =
  /^(it|that|they|the list)?\s*'?s?\s*(all\s+)?(fine|good|right|ok(ay)?|unchanged|as is|holds|stands|no change)[.!]*$/i;

export function saysNothingToChange(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (!m) return false;
  if (NO_CHANGE_SPECIFIC_RE.test(m)) return true;
  // Generic affirmatives only when they ARE the message — six words is generous for "that's fine".
  return m.split(/\s+/).length <= 6 && NO_CHANGE_SHORT_RE.test(m);
}

// LEAVING IS NOT THE SAME AS BEING DONE WITH A BEAT, and we had no signal for it.
//
// Donna, 2026-08-27: "It did an amazing job of having an understanding conversation with me. But it did follow on
// with the rote buttons to click at the end which were out of context as I had just said I would step away."
//
// The Companion's reply was right; what followed it was a ruling to make. `memberDeflecting` covers "we're done
// here", "moving on" — closing THIS beat — and none of it covers someone saying they will come back later.
// Someone stepping away has not declined to answer; they are gone, and asking for a decision on the way out is
// the moment a warm conversation turns into a form.
//
// SUPPRESSION ONLY. This never advances a stage, never stores anything, and never ends a Session — it withholds
// the chips for one turn. The failure direction is therefore harmless: a false positive costs a tap they could
// have had, and they can still type. A false negative is what she already saw.
// THE MODAL IS REQUIRED, not optional. Written with `i(...)?` first, so a bare "I go" matched and "I go running
// most mornings" — a member's own content, in the stage where they describe who they were — read as an exit.
// Caught by this file's own false-positive test before it ran anywhere. Leaving is always announced with an
// intention ("I'll", "I need to"), never with a bare present tense.
const STEPPING_AWAY_RE =
  /\b(step(ping)? away|i(?:'?ll| will| need to| have to| gotta| got to| should) +(?:go|run|head out|leave|stop)\b|i'?ll be back|come back (?:to (?:this|it)|later)|pick (?:this|it) up (?:later|tomorrow|again)|(?:that'?s |this is )?enough for (?:now|today)|another time|talk (?:later|tomorrow)|good ?night|calling it (?:a night|here))\b/i;
export function memberSteppingAway(message: string): boolean {
  return STEPPING_AWAY_RE.test((message ?? '').replace(/[‘’]/g, "'"));
}

// The member signalling the fade story is WHOLE ("that's the whole of it", "no more", "more or less it for now").
// Until this fires (or a turn adds nothing new), the gap stage keeps RECEIVING so a multi-event story fully
// surfaces (and its Doors with it) before we reflect and advance.
const GAP_DONE_RE =
  /\b(that'?s (the )?(whole|all|it|everything|gist|story|picture|heart)|the (whole|full) (story|picture|thing|of it)|no(thing)? (more|else)|no more|that'?s how it (went|happened|unfolded)|that covers it|that'?s (about|more or less|pretty much|roughly|basically) it|that was (about|more or less|pretty much) it|more or less it|it for now|(that )?(about )?sums it up|that'?s most of it|pretty much it|that'?s the heart|that'?s (about |pretty much |roughly )?(the )?(size|shape) of it|(that'?s |that is )?the (size|shape) of it|that'?s the shape)\b/i;
/**
 * "I just said…" / "like I told you…" — a member REPEATING an answer we did not hear the first time.
 *
 * Stripped like a leading affirmation, and for the same reason: it is scaffolding around the answer, not the
 * answer. Leaving it on inverted the meaning of the whole message. "it sounds great" resolved as done, but
 * "I just said, it sounds great!" crossed the length-and-word-count threshold in memberAddingMoreGap and came
 * back as an ADDITION — so we asked her again, which gave her more reason to repeat herself, more emphatically,
 * which looked even more like new material. A loop that tightens the more frustrated the member gets.
 *
 * Donna's Legacy Letter, 2026-08-18: "Read it back. What's not right?" / "I just said, it sounds great!" — and
 * the Companion's own answer was the diagnosis: "You did — I circled back one time too many."
 */
const REPEAT_PREFIX_RE =
  /^\s*(?:(?:like|as) i (?:said|told you|mentioned)|i (?:just |already )?(?:said|told you|mentioned)|i've (?:already )?said)\b[\s,.:;—–-]*/i;

/**
 * SHE IS TELLING US WE ARE REPEATING OURSELVES. Close the beat, wherever we are.
 *
 * This is the BACKSTOP for the agreement vocabulary, and it exists because that list cannot be finished. Agreement
 * has endless phrasings — four separate patches went into it (Jennifer's "Yes.", "It was primarily around those
 * three things", "that's a fair picture of it", "you've said it better than I could") and a live walk immediately
 * found two more. Every miss looks the same from her side: she answers, we ask again.
 *
 * But there is one thing a member reliably does when that happens, and it is NOT open-ended — she says we already
 * did this. That family is small, closed, and unambiguous: nobody says "we've been over this" unless we are
 * looping. So it does not matter which agreement phrasing we failed to recognise; the next turn closes the beat.
 *
 * It fires at BOTH gates, which is the other half of the lesson: the gather path (memberPushedPast) and the
 * confirm path (resolveGapConfirm) are two different close-detectors, and all four earlier patches went into the
 * confirm one — so a member closing mid-draw-out was never covered at all.
 *
 * DELIBERATELY NARROW. It requires an explicit statement of repetition, not mere impatience ("can we move on"
 * is a wrap, handled by memberWantsToWrap). Reading impatience as completion would end the beat on someone who
 * is uncomfortable rather than finished, which is the opposite of letting her set the depth.
 */
export function memberSaysWeRepeated(message: string): boolean {
  const m = normalizeContractions((message ?? '').replace(/[‘’]/g, "'").trim().toLowerCase());
  if (!m) return false;
  // HIGH PRECISION ON PURPOSE. A false positive here CLOSES THE GAP on someone still telling her story — the one
  // direction that loses material rather than merely annoying her. A first attempt used a loose window and matched
  // "I said yes to the trip that summer", which would have ended the beat mid-sentence. So every pattern needs an
  // explicit marker of repetition (just / already / been over / and answered), never a bare verb.
  return (
    /\bbeen over (this|that|it)\b/.test(m) ||
    /\bdidn't we (just|already)\b/.test(m) ||
    /\bdid we not (just|already)\b/.test(m) ||
    /\b(i|we|you)('ve| have)? ?(just|already) (asked|told|said|covered|answered|went through|gone through|been through)\b/.test(m) ||
    /\btold you (this|that) already\b/.test(m) ||
    /\basked and answered\b/.test(m) ||
    /\b(you|we) keep (asking|repeating)\b/.test(m)
  );
}

export function memberSignalsGapComplete(message: string): boolean {
  const raw = (message ?? '').replace(/[‘’]/g, "'");
  // Judge what follows the repetition marker; if there is no marker this is the original string unchanged.
  const m = raw.replace(REPEAT_PREFIX_RE, '').trim() || raw;
  return confirmsWhole(m) || memberWantsToWrap(m) || GAP_DONE_RE.test(m) || isAnaphoricClose(m);
}

// ANAPHORIC CLOSURE — closing the beat by POINTING BACK at what you already said.
//
// GAP_DONE_RE above is twenty alternations that all share one grammar: the closing is anchored on "that's ___"
// ("that's it", "that's the whole story", "that's pretty much it"). Donna's walk (2026-08-18) closed a different
// way — "It was primarily around those three things." — and every one of those twenty branches missed it, so the
// engine read a CLOSE as an ADDITION, stayed in the gap stage, and the model (believing it had moved on) ran the
// Reclaim conversation itself: no list builder, no authored bridge, just "what else do you want back?" three
// times. That is the failure the corroboration gate was built for, arriving one layer BELOW the gate — the gate
// only rescues a 'more' when the deterministic read is already 'done', and here the deterministic read was wrong.
//
// A 21st alternation would have fixed her sentence and not the next one. The SHAPE is what generalises: a reply
// whose entire substance is a pointer to material already given. "Those three things" / "just what I mentioned" /
// "mainly those" name nothing new — they quantify and bound what is already captured.
//
// Same subtractive idiom as memberAddingMoreGap: strip the affirmation, the scope hedge, and the back-reference,
// then ask whether anything is LEFT. Nothing left = they are closing. A loss signal always wins, so "those three,
// and then my mother died" keeps drawing out — the test can only ever close a beat that carries no new fade.
// "THAT'S THE ___" POINTS BACKWARDS TOO. It was only admitted as a back-reference in the two frozen forms
// "that's one" and "that's it", so "That's the big stuff" failed the precondition below and never reached the
// residue test — the test that would have closed it.
//
// It matters that the fix goes HERE rather than in GAP_DONE_RE, which is where "that's the ___" closings
// otherwise live. GAP_DONE_RE is an unanchored substring match with no loss-signal guard, so teaching it "big
// stuff" would also close on "That's the big stuff, and my sister stopped speaking to me that same year" — and
// drop the sister. This path keeps both guards: real fade material outranks the shape, and anything left after
// the strip counts as new. The member has to be saying ONLY that we have it. [[completeness-never-touches-drawout]]
const BACKREF_RE =
  /\b(those|these|them|both)\b|\bthat('?s)? (one|it)\b|\bthat'?s the\b|\bwhat i (already |just )?(said|mentioned|told you|went through)\b/i;
const SCOPE_HEDGE_RE =
  /\b(primarily|mainly|mostly|chiefly|largely|essentially|basically|generally|roughly|broadly|principally|pretty much|more or less|just|only|really|all|about|around|to do with|of it|of them)\b/gi;
// Placeholder nouns carry no meaning on their own — they are the thing "those" is standing in for.
// THE "MAIN PART OF IT" NOUNS BELONG HERE TOO (Jay's walk, 2026-08-28). He closed the beat with "That's the big
// stuff" and was asked again — because "stuff" was not on this list, so the sentence left a residue and read as
// new content. Same for "that's the brunt of it" and "that's the heart of it", the latter being the exact phrase
// the engine's own follow-up offers him ("…or is that the heart of how it opened?"). We asked a question in a
// vocabulary we could not then hear the answer in.
//
// These are not the 21st alternation this comment warns about — they are the same CATEGORY as thing/part/bit: a
// noun standing in for material already given, bounding it rather than adding to it. A loss signal still outranks
// the whole test, so "the big stuff was my dad dying" keeps drawing out.
const PLACEHOLDER_RE =
  /\b(thing|things|one|ones|item|items|event|events|reason|reasons|area|areas|topic|topics|point|points|bit|bits|part|parts|piece|pieces|issue|issues|factor|factors|stuff|gist|brunt|bulk|crux|heart|core|meat|essence|upshot|highlights)\b/gi;
const NUMBER_WORD_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|couple|few|several|first|second|third)\b/gi;
const CLOSE_FILLER_RE =
  /\b(it|that|this|they|was|were|is|are|be|been|and|but|so|then|i|we|my|the|a|an|of|in|on|at|for|with|there|here|had|have|has|did|do|really|yeah|yes|no|not|nothing|else|more|other|same|main|big|key)\b/gi;

export function isAnaphoricClose(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (!m) return false;
  // Real new fade material ALWAYS outranks the shape — never close a beat a member is still filling.
  if (hasLossSignal(m)) return false;
  // It has to actually point backwards. Without this, any short sentence would strip down to nothing and close.
  if (!BACKREF_RE.test(m)) return false;
  const residual = m
    .replace(AFFIRM_PREFIX_RE, ' ')
    .replace(GAP_CONFIRM_WORDS_RE, ' ')
    .replace(BACKREF_RE, ' ')
    .replace(SCOPE_HEDGE_RE, ' ')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(NUMBER_WORD_RE, ' ')
    .replace(CLOSE_FILLER_RE, ' ')
    .replace(/[^a-z]+/gi, ' ')
    .trim();
  GAP_CONFIRM_WORDS_RE.lastIndex = 0; // /g regex — a stale lastIndex alternates true/false between calls
  return residual.split(/\s+/).filter((w) => w.length >= 3).length === 0;
}

// Contract 2 (advance) — the Independence-Guarantee signal for a DRAW-OUT stage: the member is asking to move on, says
// they're done, or deflects. A draw-out stage that sees this must advance rather than re-pose (never loop). Composes
// the existing wrap + deflect detectors — one name the arcs pass into drawoutShouldReflect.
export function memberWantsToAdvance(message: string): boolean {
  // A TAP IS A FACT, AND THIS READ PROSE ONLY (fixed 2026-09-01).
  //
  // Donna's walk: "I clicked That's It button and it kept coming back." She was in the Door draw-out with the
  // beat-confirm chips on screen. A tap arrives as a serialized wire string, every prose pattern below missed it,
  // so the draw-out ticked on and asked her for more about a Door she had just closed. She tapped it twice, then
  // had to tell the Companion it had already walked that Door. Typing "that's it" would have worked — the button
  // was the one route that did not.
  //
  // Fixed in the SHARED function rather than at the Door call site: drift and window pass their member message
  // through this same check, so all three draw-outs were tap-blind and a per-site fix would have left two of them
  // broken and a third copy of the rule to keep in sync. [[a-tap-is-never-prose]] [[one-fact-many-sites]]
  //
  // ONLY 'done' ADVANCES. "There's more" and "not quite right" are taps too, and both mean stay — reading any tap
  // as a wish to move on would end the Door work on a member who asked to keep going.
  const tap = parseBeatConfirm(message);
  if (tap) return tap === 'done';
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
// AGREEMENT VOCABULARY — stripped before the content words are counted, so a WORDY yes is still a yes.
//
// The mechanism is right: strip what is agreement, and whatever remains is new material. What keeps failing is
// the vocabulary. The confirm asks "does that land — or is there more?", so members answer the first half with a
// VERDICT ON OUR ACCURACY — "that's a fair picture of it", "you've captured it accurately" — and with none of
// that listed, the length heuristic (>=25 chars, >=4 content words) read plain agreement as a fresh chapter and
// the beat asked again. Live walk 2026-08-19: she said "That's a fair picture of it, yeah", was asked twice more,
// and replied "didn't we just do that".
//
// THIRD INSTANCE OF ONE SHAPE — Jennifer's "Yes." re-asked three times, Donna's "It was primarily around those
// three things", now this. Each earlier fix added the exact phrasing that had just failed. The FAMILY is what
// needed adding: any assessment that we have represented it correctly carries no new material, however many words
// it takes. What must still read as MORE is a reply that NAMES something new ("and my sister stopped speaking to
// me that year") — those introduce an event; these only grade us.
const GAP_CONFIRM_WORDS_RE =
  /\b(you'?(ve|d| have)?\s*(got|nailed|captured|described|summed)\s*(it|that|them|this|up)?|that'?s (it|right|me|correct|the one|spot on|fair|accurate|about right)|(a|the|pretty much the) (fair|good|accurate|decent|full|whole|right) (picture|summary|read|account)( of (it|that))?|(it|that|you) (lands|fits|works|tracks|covers? it|describes? it|sums? it up)|captured (it|that)|sums? (it|that) up|describes (it|that)|covers (everything|it all|most of it|the lot)|(said|put) it better( than i could)?|spot on|exactly( right)?|absolutely|totally|definitely|perfect(ly)?|precisely|nailed it|got it|makes sense|understood|(?:it |that )?sounds? (?:great|good|right|perfect)|(?:it |that )?looks? (?:great|good|right|perfect)|(?:i )?love it|that'?s great|reads (?:great|good|right))\b/gi;
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
/**
 * Can this member turn become a CHAPTER OF THEIR FADE STORY?
 *
 * `shouldCaptureStagedGap` asks whether the words look like a fade. This asks the second question the gap capture
 * was never asking: whether they were TELLING us their story or TALKING TO US ABOUT THE CONVERSATION.
 *
 * THE RUN THAT FOUND IT, 2026-09-02. A persona built to push back was asked something she had already answered,
 * and said so:
 *
 *   "You just asked me that. That's what the last twenty minutes have been — me telling you what pulled me away
 *    from her. The closing, my mother, the invisible work. I already answered it."
 *
 * That was appended to her gap and stored as part of her fade. It passes the fade matcher for a good reason — it
 * NAMES her Doors, because she was listing what she had already told us. Content alone cannot tell the two apart.
 * Donna produced the identical shape the day before ("You already asked me that. I just answered it").
 *
 * THE GUARD ALREADY EXISTED. `isConversationalMeta` was built for this exact sentence and carries an
 * ALREADY_ANSWERED matcher; `isAboutTheApp` was written for the second shape. Both were wired into the Reclaim
 * List — `canBeReclaimItem` is this function's twin, one file over — and neither reached the gap. Fifth instance
 * this week of a rule that exists and runs in one place. [[one-fact-many-sites]]
 *
 * WHY THIS IS NOT THE REVERTED WORK. Stage-agreement inferred that the member had DIVERGED and then captured what
 * she said next; it recited her protest back as a goal and was reverted, and its note says the prose-detection
 * idea is dead. This does the opposite: it captures nothing on a judgement, it only DECLINES to store a shape we
 * already refuse to store elsewhere. Excluding is safe where inferring is not — the worst case is a chapter she
 * has to say again, not a sentence of ours put in her mouth.
 */
export function canBeGapChapter(message: string): boolean {
  return shouldCaptureStagedGap(message) && !isConversationalMeta(message) && !isAboutTheApp(message);
}

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
// NOTHING/NEVER + a loss VERB. The rule above only strips negations of loss NOUNS, so the plainest way anyone
// actually declares no-fade — "nothing has faded", "nothing went wrong", "I never lost myself" — survived it and
// tripped LOSS_RE as evidence of the very thing it denied.
//
// THE CONSEQUENCE WAS NOT COSMETIC (found 2026-08-24, tracing Tim Carlin's decline). The decline gate requires
// `!hasGenuineLoss`, so a thriving member saying so plainly could not be released by their OWN words — and the
// decision fell through to the model's no-fade HINT instead. Measured on five natural phrasings, the member-words
// branch fired on two; the negation blindness was quietly routing intake decisions onto the riskier branch, which
// is the one that turned Tim away.
//
// STILL TIGHT. The subject must be nothing/never and the loss word must follow within a couple of words, so a real
// loss carrying an incidental negation is untouched: "can't stop thinking about the loss", "I never got over
// losing her", "nothing prepared me for the divorce" all still read as loss. Tested both directions. (CAT-03/06)
const NEG_LOSS_VERB_RE =
  /\b(?:nothing|never)\s+(?:really\s+|ever\s+|has\s+|had\s+|have\s+|was\s+|is\s+|felt\s+)*(?:faded?|fading|lost|losing|missing|gone wrong|went wrong|slipped away|fell away)\b/gi;
// Real loss LANGUAGE, ignoring explicit "no loss / nothing wrong" declarations. Keyed on loss VERBS/events, NOT a
// Door-name match — "marriage is genuinely good" mentions "marriage" but is not a loss.
export function hasGenuineLoss(text: string): boolean {
  // Strip ALL "no loss / no drift" declarations (global) — a corpus can repeat them, and a leftover would trip LOSS_RE.
  const stripped = (text ?? '')
    .replace(new RegExp(NO_LOSS_RE.source, NO_LOSS_RE.flags + 'g'), ' ')
    .replace(NEG_LOSS_RE, ' ')
    .replace(NEG_LOSS_VERB_RE, ' ');
  return LOSS_RE.test(stripped);
}

// REDUCTION / REROUTE language — the ORDINARY fade voiced WITHOUT loss-verbs: freedom/time/self getting squeezed,
// rerouted, or put on hold as life accumulates. This is the Doors-accumulation member (G4L's MOST common fade), whose
// story the loss-verb vocabulary completely misses ("didn't have that freedom anymore", "no time for myself",
// "everything had to fit around the kids", "shifted my priorities", "put myself last"). A HARD real-fade signal. (CAT-01)
const REDUCTION_RE =
  /\b(anymore|no (more )?time (for|to)\b|no (space|room)( left)? for (myself|me|us)|had to fit (it|them|everything|around)|crowded out|squeezed out|less time for|put (myself|me|it|them) (on hold|aside|last|second|on the back ?burner)|on the back ?burner|gave up|stopped (doing|going|playing|training|riding|making time)|slipped away|fell away|lost touch|shifted (my |our )?priorities|no longer (have|had|do|make|had time)|don'?t (have|make) (the )?time)\b/i;
// THREE MORE REGISTERS OF THE ORDINARY FADE, added 2026-08-24 after measuring how many real phrasings carried NO
// signal at all. REDUCTION_RE above is keyed on things getting SQUEEZED — time, space, priorities. These are the
// same fade told three other ways, and all three were invisible:
//
//   NON-RECOGNITION   "I don't recognise the guy in the photos" — the Fade stated as a stranger in the mirror.
//                     This is arguably the purest expression of identity distance and it had no matcher at all.
//   TAKEOVER          "work just took over" — something ELSE became the whole life. The Career Cliff and the
//                     Load-Bearer both usually arrive in this register rather than as a loss verb.
//   RESIGNED EVENT    "the kids came and that was that" — an event, then a shrug. The shrug IS the fade; the
//                     member is reporting a door closing without ever calling it a loss.
//
// WHY IT MATTERS BEYOND THE DECLINE GATE: these same signals decide whether a gap is CAPTURED. A member who says
// "work just took over" has handed us a Door and a story, and we registered nothing — so it was never drawn out
// and never reached her record. Missing the signal costs the capture, not only the admission.
//
// KEPT TIGHT, and tested against thriving phrasings so a good life does not read as a fade: "I took over the
// team", "the kids came and it was the best thing" and similar must stay clear.
const FADE_REGISTER_RE =
  /\b(?:(?:don'?t|do not|barely|hardly|no longer)\s+(?:recognise|recognize|know)\s+(?:the\s+)?(?:guy|girl|man|woman|person|face|myself|him|her|me)\b|not the same (?:person|guy|man|woman)\b|(?:a )?stranger in the mirror\b)/i;
const TAKEOVER_RE =
  /\b(?:(?:work|the job|the kids|caregiving|life|it|everything)\s+(?:just\s+)?(?:took over|swallowed|consumed|ate)\b|became (?:my )?(?:whole|entire) (?:life|world)\b|all[- ]consuming\b)/i;
const RESIGNED_EVENT_RE =
  /\b(?:and that was (?:that|it)|and (?:i|we) never (?:went back|did|got back)|that was the end of (?:that|it)|never picked it (?:back )?up (?:again)?)\b/i;

export function hasReductionLanguage(text: string): boolean {
  const t = text ?? '';
  return REDUCTION_RE.test(t) || FADE_REGISTER_RE.test(t) || TAKEOVER_RE.test(t) || RESIGNED_EVENT_RE.test(t);
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
  // She says we already did this — that outranks everything, including a leading negation. Nobody says it unless
  // we are looping, and continuing to ask is the one response that cannot be right.
  //
  // UNLESS SHE PUTS REAL CONTENT BEHIND IT. "I just said I want to change the second line" opens with the marker
  // and then makes a request; closing on it would throw the request away. Same residue rule the leading-affirmation
  // guard already uses — the marker closes the beat only when the marker IS the message.
  if (memberSaysWeRepeated(message) && !hasRevisionTail(message)) return 'done';
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
