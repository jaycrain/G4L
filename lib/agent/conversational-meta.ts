// A MEMBER TALKING **ABOUT** THE CONVERSATION IS NEVER TALKING ABOUT HER LIFE.
//
// This is the third time the same shape has reached a member, so it stops being a patch at the call site and
// becomes one predicate every caller inherits:
//
//   1. A protest was promoted into a goal (the stage-agreement work — reverted).
//   2. 2026-08-19 — her Visualization keeper was stored as "Can you remind me what is on my Reclaim List?", her
//      own housekeeping question filed as an insight about her. Her words: it "signals the app isn't working."
//   3. 2026-08-20 — the one below.
//
// WHAT IT COST THE THIRD TIME. At the Window beat the engine keeps the member's latest substantive line as the
// vision she is describing. `isKeeperMaterial` guarded that, but it only rejected assent, praise, and anything
// under five words — so Donna's thirteen-word "I think we already did that and you were writing a letter for me?"
// read as a sentence about her life. That ONE value is then used TWICE (reconnect.ts, the window close):
//
//   · pushed to the keeper queue as "The spark"  → a card offering to save her own complaint to her Playbook
//   · copied to `legacyTuesday`                  → the Legacy Letter's carried-forward answer
//
// and the letter prompt duly injected: They ALREADY answered 1 in the Window beat: "I think we already did that
// and you were writing a letter for me?" — do not ask it again; use it. The model read that, correctly concluded
// it was not a Tuesday, and asked again. She protested again, which OVERWROTE the payload with the new protest.
// That is why it looped instead of failing once, and why the model saying "you're right, let me write that
// letter" changed nothing: it was handed the same garbage every turn.
//
// WHY LENGTH AND PRAISE CANNOT SEE THIS. A protest is often long, fluent, first-person, and about the very topic
// at hand — every surface feature of real material. What distinguishes it is what it POINTS AT: the exchange,
// not her life. That is a shape, and shapes are checkable.
//
// SCOPE, DELIBERATELY NARROW. This decides what may be STORED AS HER WORDS. It never silences her, never changes
// what the Companion says back, and never routes the conversation. A member is completely free to ask us
// anything — she just should not later find it framed as an insight about who she is.

/**
 * Is this the member talking about the CONVERSATION (asking us something, correcting us, objecting to the
 * process) rather than about her life?
 *
 * Two independent signals, because either alone is wrong:
 *
 *   · SECOND-PERSON REFERENCE TO US doing something — "you were writing", "you asked me", "did you get that".
 *     A sentence about her life rarely addresses the Companion's own actions.
 *   · ALREADY-ANSWERED / REPEAT language — "I already told you", "didn't I just", "we did that".
 *
 * Requiring a genuine tell rather than a keyword keeps a real want like "I want work that pays me what I'm
 * worth" — second person absent, no repeat claim — comfortably out of scope.
 */
const ADDRESSES_US =
  /\b(you|you're|youre|your)\s+(?:just\s+|already\s+|were\s+|are\s+|have\s+|had\s+)?(?:ask(?:ed|ing)?|writ(?:e|ing|ten)|said|say(?:ing)?|told|tell(?:ing)?|answer(?:ed|ing)?|do(?:ing|ne)?|did|repeat(?:ed|ing)?|gave|give|going to|gonna)\b/i;

const ALREADY_ANSWERED =
  /\b(?:already\s+(?:said|told|answered|did|covered|gave|mentioned)|did(?:n'?t| not)\s+(?:i|we)\s+(?:just|already)?\s*(?:say|tell|answer|do|cover)|(?:i|we)\s+(?:just\s+)?(?:said|told|answered|did|covered)\s+(?:that|this|it)|we\s+already\s+(?:did|covered|went over)|asked\s+(?:me\s+)?(?:that|this)\s+already|same\s+question\s+again)\b/i;

/** A question aimed at the Companion — "are you…?", "can we…?", "what happens next?" — not a reflection. */
const ASKS_US = /\?\s*$/;

export function isConversationalMeta(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (ALREADY_ANSWERED.test(t)) return true;
  // A question ABOUT us. The question mark alone is not enough — a member may end a real reflection with one
  // ("who even am I now?") — so it must also be pointed at the Companion's own conduct.
  if (ASKS_US.test(t) && ADDRESSES_US.test(t)) return true;
  return false;
}

// ── TALKING TO US ABOUT THE PRODUCT ────────────────────────────────────────────────────────────────────────────
//
// A SECOND SHAPE, found in Donna's walk on 2026-08-22. `isConversationalMeta` catches a member answering the
// Companion's process ("we just did that", "you already asked me"). It does not catch a member stepping out of
// the conversation to talk about the SOFTWARE:
//
//   "This remains confusing and fucked up."
//   "We need to make a change here to how the Reclaim List is populated"
//   "20 lbs, and I can just show lbs lost"
//
// All three were committed to her Reclaim List as things she wanted back. The middle one is a bug report about
// the Reclaim List, stored by the Reclaim List.
//
// THIS IS DELIBERATELY NARROW, and it is only ever used to filter OUR OWN PROPOSALS — the pre-filled seeds in the
// builder, never something she typed and committed. That is what makes a false positive cheap: the worst case is
// she types a line again in a form that is already open. A false positive on committed text would be data loss,
// and this is never used there.
//
// Two signals must BOTH be present: a product noun (the thing she is talking about) and either a fix-verb aimed
// at us or plain frustration. "I want my confusing life to change" has the frustration and no product noun;
// "I want to write again" has neither. Neither is caught.

/** Words that only appear when a member is talking about the SOFTWARE rather than her life. */
const PRODUCT_NOUN =
  /\b(app|screen|page|button|field|form|list|prompt|question|companion|chat|ui|interface|dashboard|playbook|reclaim list|onboarding|this thing)\b/i;

/** A fix aimed at US — "we/you need to", "should be", "make it", "change this" — or a REQUEST that we do
 *  something to it: "can you add it to my list?".
 *
 *  THE REQUEST FORM WAS MISSING (Jay's walk, 2026-08-25). He typed "Can you add it to my list?" mid-Session and
 *  it was composed into his Visualization picture and offered back as a keeper — his own housekeeping request,
 *  stored as the scene he had built. Neither predicate saw it: isConversationalMeta needs a repeat-claim or a
 *  question about our CONDUCT, and this asks us to perform an ACTION; isAboutTheApp had the product noun ("list")
 *  and no fix-verb, because asking politely is not the same shape as "you need to change this".
 *
 *  Still safe against a real want, because isAboutTheApp requires a PRODUCT NOUN alongside this. "Can you believe
 *  how long it's been?" has the request form and no product noun, so it stays out. */
const FIX_AT_US =
  /\b(we|you)\s+(need|should|could|have)\s+to\b|\b(needs?|should)\s+to\s+(be|change|say|show)\b|\bmake\s+(it|this|that)\b|\bchange\s+(it|this|that|how)\b|\bfix\s+(it|this|that)\b|\b(can|could|would|will)\s+you\s+\w+/i;

/** Plain frustration ABOUT something, not a wish for something back. */
const FRUSTRATION =
  /\b(confusing|broken|buggy|glitch|doesn'?t work|not working|makes no sense|fucked up|messed up|annoying|weird|wrong)\b/i;

/**
 * Is this the member talking to us about the product, rather than naming something she wants back?
 *
 * Used ONLY on proposals we are about to put in front of her. Never on committed text.
 */
export function isAboutTheApp(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (PRODUCT_NOUN.test(t) && (FIX_AT_US.test(t) || FRUSTRATION.test(t))) return true;

  // A BARE JUDGEMENT, with the product only implied — "This remains confusing and fucked up." (Donna, 2026-08-22).
  // No product noun, because the referent is just "this"; no life content either. A reclaim item is something she
  // WANTS BACK, so the tell is a deictic subject carrying a complaint and nothing of herself in it.
  //
  // The first-person escape is what keeps this narrow. "I want my confusing life to change" and "This is what I
  // want back" both survive, because a sentence about her own life says so.
  const bareJudgement = /^(this|that|it|these|those)\b/i.test(t) && FRUSTRATION.test(t);
  const aboutHer = /\b(i|i'?m|my|me|myself|we're)\b/i.test(t) || /\bwant\b/i.test(t);
  return bareJudgement && !aboutHer;
}
