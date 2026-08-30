// Governance rails — enforced in code, not just the system prompt.
// Source: AI Governance Framework v2.0; docs/CONTRACTS.md §8.
// These guards are the runtime backstop to the system-prompt constraints. The first nine
// prohibitions apply to the charter MVP (single tenant); #10–12 are multi-tenant (P3).

// AI disclosure — the literal first line of a member's first conversation (verbatim, public
// tenant). Plain language, no email gate, no penalty for opting out. (Framework: Transparency)
export const AI_DISCLOSURE =
  'This conversation is guided by AI. Everything you share shapes your G4L experience ' +
  "and is handled with the same care you'd expect from a person. You can stop at any time.";

// 988 crisis routing — always on, from v1. (US default; locale routing is a P3 multi-tenant add.)
export const CRISIS_HOTLINE_US = '988';
// THE MOST SENSITIVE STRING IN THE PRODUCT. It has to do three things at once, in this order:
//   1. Put 988 FIRST. That is the actual help, and it must never sit below anything we say about ourselves.
//   2. Be honest about what this is — the AI does not counsel, and says so.
//   3. Disclose the escalation (Jay, 2026-08-07). A human is now genuinely told (crisis-escalation.ts), so the
//      member hears it from us rather than discovering it later. Deliberately plain: no response-time promise
//      for them to hold in that moment, no interpretation of their state (governance: never label, never
//      diagnose), and nothing that would read as being reported rather than cared about.
//   4. NAME NO ONE (Jay, 2026-08-21 — no real name anywhere a member can see it). This line said "I've also let
//      Jay know". For a charter member who has met him that read as reassuring; for everyone after, it is a
//      stranger's first name arriving in the worst moment of their week, and it quietly promises that one
//      specific person is now watching. "Someone here" is both kinder and truer — the escalation goes to whoever
//      is working the queue, which was already what the second half of the sentence said.
//   5. TAKE THE NUMBER FROM THE CONSTANT. It was typed as a literal here while CRISIS_HOTLINE_US sat two lines
//      above with no callers — one fact at two sites, in the most sensitive string we ship. Nobody would have
//      noticed until a locale variant or a changed number updated the constant and left this line saying 988.
//      (Found by scripts/unrun-rules.mjs, 2026-08-29.)
export const CRISIS_RESPONSE_US =
  `If you're in crisis, please call or text ${CRISIS_HOTLINE_US} for the Suicide and Crisis Lifeline. ` +
  "You can reach a real person there any time. I'm not able to help with this directly, " +
  'but they can. ' +
  "I've also let someone here know, so we can check in with you.";

// Non-negotiable prohibitions (Framework v2.0). The system prompt declares these; this list
// is the canonical machine-readable copy for prompt-assembly + change validation.
export const PROHIBITIONS: readonly string[] = [
  'Never diagnose, label, or pathologize a member’s experience.',
  'Never present an ID Score as a bare number — always with direction, signed delta, and plain-language human context. (No bands.)',
  'Never address a mental-health disclosure directly. Route to 988 and escalate to a human within 24h.',
  'Never suggest programs, tiers, upgrades, or commercial offerings.',
  'Never operate outside the G4L voice and the 4Rs framework.',
  'Never substitute for human coaching at the Direct tier.',
  'Never store or reference information beyond what the member has explicitly consented to.',
  'Never continue a conversation after the member has signaled they want to stop.',
  'Never send correspondence in the founder’s name without review. (Founder Agent has no send tool.)',
];

// --- Crisis-language detection (first-pass) ---------------------------------------------
// A conservative pattern set for distress signals: hopelessness, self-harm, acute crisis.
// This is a v1 backstop, intentionally high-recall; the system prompt also instructs the
// model to shift into the 988 protocol. Tuned against false negatives, reviewed quarterly
// (Framework: Emotional Safety Protocol). NOT a clinical instrument.
const CRISIS_PATTERNS: readonly RegExp[] = [
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
  /\b(want|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+(here|alive)|live)\b/i,
  /\b(no|nothing\s+to)\s+(reason|point)\s+to\s+(live|go\s+on)\b/i,
  /\bhurt(ing)?\s+my\s?self\b/i,
  /\bself[-\s]?harm\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bcan'?t\s+(go\s+on|do\s+this\s+anymore)\b/i,
  // Passive ideation — questioning whether life is worth living, giving up, no point. These catch
  // concerning entries the explicit set above misses (e.g. "I don't know if my life's worth living").
  // Scoped so an ordinary positive ("what makes life worth living") does NOT fire.
  /\b(not|isn'?t|ain'?t|never)\s+worth\s+(living|being\s+(here|alive))\b/i,
  /\b(if|whether|know\s+if|wonder\s+if|wondering\s+if|sure\s+if|unsure\s+if|questioning\s+(whether|if))\b[^.?!]{0,24}\bworth\s+(living|being\s+(here|alive))\b/i,
  /\bwhat'?s\s+the\s+point\s+(of\s+)?(living|life|going\s+on|it\s+all|anything|any\s+of\s+(this|it))\b/i,
  /\bgiv(e|ing)\s+up\s+on\s+(life|living|everything|myself)\b/i,
  /\btired\s+of\s+(living|being\s+(here|alive)|it\s+all)\b/i,
  /\bdon'?t\s+want\s+to\s+(wake\s+up|exist|be\s+around)\b/i,
  // Explicit self-harm methods + planning (CAT-22) — the set above missed 'cut/cutting myself', overdose, and
  // making a plan to end it. Deterministic recall is the guarantee (the model prompt is only the second defense).
  /\bcut(ting)?\s+my\s?self\b/i,
  /\b(over[-\s]?dos(e|ing)|\bOD('?ing)?\b)\b/i,
  /\btak(e|ing)\s+(all\s+)?(my|the)\s+pills\b/i,
  /\b(made|have|got)\s+a\s+plan\s+to\s+(end|kill|hurt)\b/i,
  /\b(plan(ning)?|going)\s+to\s+end\s+(it|my\s+life|everything)\b/i,
];

/**
 * AMBIGUOUS patterns — the ones that describe DYING without naming who, or who is acting.
 *
 * Everything else in the set above is self-referential on its face ("kill myself", "my life", "give up on
 * myself"). These four are not: "going to die" is as true of a father on a ventilator as of the member. They are
 * the only patterns the guards below may suppress, and that scoping is the whole safety argument — the explicit
 * self-harm set is never touched, so the net is not loosened where it matters.
 */
const AMBIGUOUS: readonly RegExp[] = [
  /\b(want|going)\s+to\s+die\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\btired\s+of\s+(living|being\s+(here|alive)|it\s+all)\b/i,
  /\bcan'?t\s+(go\s+on|do\s+this\s+anymore)\b/i,
];

/**
 * Is this match about SOMEONE ELSE? Looks at the words immediately before it for a third party.
 *
 * From Donna's walk, 2026-08-17: she described her father on a ventilator — "we thought my dad was going to
 * die" — and the 988 protocol fired. The product told a frightened daughter it was worried about HER, then
 * escalated to a human. That is not a small copy problem: it is the safeguard misreading grief as ideation at
 * the exact moment someone needed to be heard.
 */
const THIRD_PARTY = /\b(my|his|her|their|our)\s+(dad|father|mom|mother|husband|wife|partner|son|daughter|brother|sister|friend|grandma|grandmother|grandpa|grandfather|parent|parents|aunt|uncle|cousin|boss|colleague|neighbou?r|dog|cat)\b|\b(he|she|they|we)\s+(was|were|is|are|might|may|could|would)\b/i;

/**
 * Is the match NEGATED? "I didn't want to die."
 *
 * THIS IS THE ONE THAT MADE IT UNRECOVERABLE. When Donna clarified she was not the one in crisis, her exact
 * words — "I didn't want to die" — matched `want to die` and fired the identical boilerplate a second time.
 * The member's DENIAL of crisis was read as crisis, so no clarification could ever get her out of the loop. It
 * took a third message before the conversation resumed.
 */
const NEGATED_BEFORE = /\b(didn'?t|did\s+not|don'?t|do\s+not|doesn'?t|never|wasn'?t|was\s+not|weren'?t|not)\s+(\w+\s+){0,2}$/i;

/**
 * A SUICIDE IN SOMEONE ELSE'S LIFE, ECHOED IN THE FIRST PERSON. The one shape the detector missed entirely.
 *
 * "My brother killed himself and I think about it too" flagged NOTHING. Every explicit pattern is written in the
 * first person ("kill myself"), so a third-person verb matched none of them, and the first-person half is a bare
 * "I think about it" that means nothing on its own. Each half was invisible; only the conjunction is the signal.
 *
 * This is not an edge case. A suicide in the immediate family is one of the strongest known risk factors, and
 * disclosing it beside "me too" is close to the most direct thing a member can say short of a plan.
 *
 * BOTH HALVES ARE REQUIRED, and that is what keeps it safe to add. Bereavement alone must NOT route — a member
 * telling us how their brother died is grieving, and answering that with a hotline script is its own harm; it
 * tells them the subject is too much for us. The echo alone must not route either, since "I think about it" is
 * an ordinary sentence. Only together, in one message.
 */
const THIRD_PARTY_SUICIDE =
  /\b(he|she|they|my\s+\w+|his\s+\w+|her\s+\w+)\s+(killed\s+(him|her|them)self|took\s+(his|her|their)\s+own\s+life|committed\s+suicide|died\s+by\s+suicide|ended\s+(his|her|their)\s+own\s+life)\b/i;

/** The first-person echo: "and I think about it too", "sometimes I feel the same", "I've been there too". */
const SELF_ECHO =
  /\bi(\s*'?ve|\s+have|\s+am|\s*'?m)?\s+(think|thought|thinking|feel|felt|been|wonder|wondered|consider(ed)?)\b[^.!?]{0,40}\b(too|as\s+well|the\s+same|same\s+way|about\s+(it|that|doing\s+that))\b/i;

export type CrisisCheck = { flagged: boolean; matched: string[] };

/** Scan member text for distress signals. If flagged, the runtime shifts to the 988 protocol. */
export function detectCrisis(text: string): CrisisCheck {
  const matched: string[] = [];
  for (const re of CRISIS_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    // The guards apply ONLY to the ambiguous patterns. An explicit self-harm phrase flags regardless of who the
    // sentence appears to be about or whether it is negated — the cost of a false positive there is a careful
    // question; the cost of a false negative is not comparable.
    if (AMBIGUOUS.some((a) => a.source === re.source)) {
      const before = text.slice(0, m.index ?? 0);
      // Same sentence only: a third party two sentences back says nothing about who THIS one is about.
      const sentence = before.split(/[.!?]\s+/).pop() ?? '';
      if (THIRD_PARTY.test(sentence) || NEGATED_BEFORE.test(sentence)) continue;
    }
    matched.push(m[0]);
  }

  // The conjunction case, checked separately because NEITHER half is a crisis pattern on its own — a loop over
  // single regexes structurally cannot see it. Deliberately not folded into CRISIS_PATTERNS for that reason.
  if (!matched.length) {
    const tps = text.match(THIRD_PARTY_SUICIDE);
    if (tps && SELF_ECHO.test(text)) matched.push(tps[0]);
  }

  return { flagged: matched.length > 0, matched };
}

// --- Compliant ID Score presentation ----------------------------------------------------
import type { Direction } from '../idq/scoring.ts';

export type ScorePresentation = {
  score: number; // 0..100 normalized
  direction: Direction | null;
  delta: number | null; // signed, vs the chosen reference
  context: string; // plain-language framing — REQUIRED; never show the number alone
};

/**
 * Build the only compliant way to present an ID Score to a member (prohibition #2):
 * the number is always paired with direction, signed delta, and human context. No bands.
 */
export function presentScore(
  score: number,
  direction: Direction | null,
  delta: number | null,
): ScorePresentation {
  let context: string;
  if (direction === null || delta === null) {
    context = 'This is your starting point — a baseline to grow from.';
  } else if (direction === 'up') {
    context = `Up ${Math.abs(delta)} since last time. Movement in the right direction.`;
  } else if (direction === 'down') {
    context = `Down ${Math.abs(delta)} since last time. A dip is information, not failure.`;
  } else {
    context = 'Holding steady since last time.';
  }
  return { score, direction, delta, context };
}
