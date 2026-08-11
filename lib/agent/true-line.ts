// IS THIS A TRUE LINE, OR THE MEMBER TALKING TO ME ABOUT THE CONVERSATION?
//
// W1's affirm stage stored EVERY member message wholesale as a true line. So when the Companion asked "is there one
// that still feels unfinished — one you want to tighten before we close?" and Jay answered "No, that felt good",
// his decline was filed in his Playbook as a thing he believes about himself. "That's me" landed the same way
// (Jay's walk, 2026-08-11: "picked up the signoff as true line").
//
// This is the Jennifer shape again — the draw-out advances on the turn the member reacts, and that reaction gets
// stored as their material. Reconnect already solved its version with isKeeperMaterial().
//
// DO NOT REUSE isKeeperMaterial HERE. It rejects anything under five words, which is right for a drift declaration
// ("a sentence about their life") and wrong for a true line, which the prompt explicitly asks to be short and
// sayable: "One sentence. True enough that you'd say it out loud." Measured against Jay's real session,
// isKeeperMaterial returns false for "You're a bad ass" — one of his actual lines. A guard that fixes two false
// positives by dropping a real one is a worse bug than the one it fixes; we never drop what the member gave us.
//
// The discriminator is not LENGTH, it is ASSERTION vs REPLY. A true line asserts something ("You're a bad ass",
// "I have time to do whatever I choose"). A signoff answers the Companion ("No, that felt good", "That's me").
//
// Biased to KEEP, deliberately. A stray line in the Playbook is one tap to cut — the close says so ("to keep or
// cut"). A dropped line is gone silently and the member never learns it was lost. So this rejects only what is
// clearly a reaction, and anything with real content survives.

/** Answering "no" to the close-check. Only meaningful when what FOLLOWS it isn't substantive — see below. */
const LEADING_NEGATION = /^(no|nope|nah|not really|not quite|not exactly)\b[\s,.!—–-]*/i;

/** Pure reaction: assent to a reflection, or a verdict on how the conversation went. Never a belief about oneself. */
const REACTION =
  /^(that'?s (me|it|right|all|good|great|perfect|the one|correct)|yep|yes|yeah|sure|ok(ay)?|got it|exactly|correct|agreed|((that|this|it) )?(felt|feels|sound|sounds|looks|was|is) (good|great|right|fine|nice|better)|(i )?(like|love) (it|that)|good|great|perfect|nice|cool|thanks?( you)?|done|all good|i'?m good|makes sense)\b[\s.!]*$/i;

/**
 * Should this member message be kept as a true line?
 *
 * Returns false ONLY for messages that are entirely a reply to the Companion — a decline, an assent, or a verdict
 * on the exchange. A leading "no" alone is not disqualifying: "No, the real line is that I still race" carries an
 * assertion behind the negation and must be kept. That mirrors the whole-message-intent rule the arcs already hold
 * ("a leading word is a GUESS about the whole message" — onboarding-intent.ts).
 */
export function isTrueLineMaterial(message: string): boolean {
  const t = (message ?? '').replace(/[‘’]/g, "'").trim();
  if (t.length < 3) return false;
  if (REACTION.test(t)) return false; // "That's me", "yep", "sounds good"
  const afterNo = t.replace(LEADING_NEGATION, '').trim();
  // A leading negation that leaves nothing but a reaction behind it is a decline: "No, that felt good."
  if (afterNo !== t && (afterNo.length === 0 || REACTION.test(afterNo))) return false;
  return true;
}

/**
 * Is this reply a DECLINE — the member answering "is there one you want to tighten?" with no?
 *
 * Split from isTrueLineMaterial because the two reactions need opposite handling, and conflating them would trade
 * one bug for a worse one. A DECLINE means close the beat. A bare assent or reaction mid-draw-out ("That's me",
 * "nice") means only "this wasn't a line" — skip it and keep going. If every reaction closed the beat, reacting
 * warmly in the middle would END the member's session and lose the lines they hadn't written yet. Dropping work is
 * worse than keeping a stray line, which is one tap to cut.
 */
export function isDeclineReply(message: string): boolean {
  const t = (message ?? '').replace(/[\u2018\u2019]/g, "'").trim();
  if (!LEADING_NEGATION.test(t)) return false;
  const rest = t.replace(LEADING_NEGATION, '').trim();
  return rest.length === 0 || REACTION.test(rest);
}
