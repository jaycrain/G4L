// The pre-send validator — Governance §10 (the CC engine contract). PURE + testable. Every proactive message
// must pass EVERY check before it touches any channel; fail any = HOLD, not send. This is the single safety gate
// every channel routes through, so a nudge is governed identically no matter which pipe it takes. Tested against
// the governance §12 worked examples (GOOD must pass, BAD must fail on the right rule) in tests/outreach-validate.
//
// Design: the engine emits a STRUCTURED draft (tense / hasPlan / questionCount / provenance), so most checks are
// deterministic. The free-text guards below catch the §9 must-nots + §9.10 science-check overclaims by pattern.
// Semantic depth (a full MI/tense judge) is a later LLM-backed check; this pure layer is the non-negotiable floor.

import type { OutreachDraft } from './config.ts';

export type ValidateContext = {
  cadenceOk: boolean; // computed by cadence.ts — within rhythm, no double-nudge, quiet hours respected (§7b)
  dismissible: boolean; // the surface wires "not now" → lowers future cadence (§10)
};

export type ValidateResult = { ok: boolean; failures: string[] };

// An explicit easy-out (§6 autonomy tag).
const EASY_OUT =
  /\b(no pressure|no rush|no need to|take your time|whenever you (?:want|like|are ready)|your call|either'?s? (?:fine|good|ok|okay)|only if you|if you want|no worries|up to you)\b/i;
// Guilt / shame / streak / disappointment (§9.2, §9.4).
const GUILT =
  /\b(still haven'?t|you (?:missed|skipped|haven'?t)|streak|disappoint|you'?re behind|should have|failed to|why did(?:n'?t| not) you|you never)\b/i;
// Command / righting-reflex / advice (§9.1 no command in Present; §3 ban the righting reflex).
const COMMAND = /\b(you should|you (?:need|have|ought) to|do (?:it|your|the)\b|go (?:do|and)\b|make sure you)\b/i;
// Invitation framing that makes a plan legal in Practice (§5, §12).
const INVITATION =
  /\b(if you'?re up for it|want to|want me to|we (?:could|try|might|can)|or not\b|your call|how about|maybe try|open to|if you'?d like)\b/i;
// Science-check deterministic overclaims — behavior change is probabilistic (§9.10).
const OVERCLAIM =
  /\b(reveals? your (?:true|real)|prove[sd]?\b|fix(?:es|ed)?\b|guarantee[sd]?\b|permanently change|cures?\b|will (?:definitely|always))\b/i;
// A bare number / rating ask — never extract a score (§9.4; §12 post-log BAD).
const BARE_NUMBER = /\b(rate\b|score it\b|1\s*[-–to]+\s*10\b|out of (?:10|ten)|on a scale)\b/i;

const countQuestions = (t: string): number => (t.match(/\?/g) ?? []).length;

export function validateOutreach(d: OutreachDraft, ctx: ValidateContext): ValidateResult {
  const f: string[] = [];
  const t = d.text ?? '';

  // GROUNDED (§8) — a real provenance citation.
  if (!d.provenance || !d.provenance.ref?.trim()) f.push('grounded: no provenance');

  // TENSE-CORRECT (§5) — no plan/command outside Practice.
  if (d.hasPlan && d.tense !== 'practice') f.push('tense: a plan/directive is only legal in Practice');
  if (d.tense === 'present' && COMMAND.test(t)) f.push('tense: command/advice in the Present');

  // MI-SHAPED (§6) — at most one question; righting reflex resisted; a Practice plan must be an invitation.
  if (d.questionCount > 1 || countQuestions(t) > 1) f.push('mi: more than one question');
  if (d.tense !== 'practice' && COMMAND.test(t)) f.push('mi: righting reflex (advice/command)');
  if (d.hasPlan && d.tense === 'practice' && !INVITATION.test(t)) f.push('mi: plan not framed as an invitation');

  // AUTONOMY-TAGGED (§6) — required when there's a PULL toward action (a plan/invitation, or a Reclaim-goal nudge).
  // A pure reflection + open question is inherently non-obligating — the open question IS the open hand — so the
  // §12 Present GOOD example (no explicit tag) passes. [ASSUMPTION: confirm the exact boundary with Greg.]
  const pullsTowardAction = d.hasPlan || d.trigger === 'reclaim_milestone';
  if (pullsTowardAction && !EASY_OUT.test(t)) f.push('autonomy: action-pull without an explicit easy-out');

  // GUARDRAIL-CLEAN (§9) — no guilt/shame/streak, no bare number.
  if (GUILT.test(t)) f.push('guardrail: guilt / shame / streak');
  if (BARE_NUMBER.test(t)) f.push('guardrail: bare number / rating ask');

  // SCIENCE-CHECK-CLEAN (§9.10) — likelihoods, no deterministic overclaim.
  if (OVERCLAIM.test(t)) f.push('science-check: deterministic overclaim');

  // CADENCE-LEGAL (§7b) + DISMISSIBLE (§10) — system properties computed upstream.
  if (!ctx.cadenceOk) f.push('cadence: over the rhythm / quiet hours / double-nudge');
  if (!ctx.dismissible) f.push('dismissible: "not now" not wired');

  return { ok: f.length === 0, failures: f };
}
