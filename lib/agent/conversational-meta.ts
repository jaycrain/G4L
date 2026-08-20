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
