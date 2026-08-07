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
export const CRISIS_RESPONSE_US =
  "If you're in crisis, please call or text 988 for the Suicide and Crisis Lifeline. " +
  "You can reach a real person there any time. I'm not able to help with this directly, " +
  'but they can. ' +
  "I've also let Jay know, so someone here can check in with you.";

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

export type CrisisCheck = { flagged: boolean; matched: string[] };

/** Scan member text for distress signals. If flagged, the runtime shifts to the 988 protocol. */
export function detectCrisis(text: string): CrisisCheck {
  const matched: string[] = [];
  for (const re of CRISIS_PATTERNS) {
    const m = text.match(re);
    if (m) matched.push(m[0]);
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
