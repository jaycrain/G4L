// Arc replay harness (Phase 0 of docs/arc-reliability-hardening.md). The arc kernel `runArcTurn` is already a PURE
// function of (state, history, memberMessage, model) → Turn — no API. So we can replay a scripted walk offline and
// assert invariants, exactly as tests/onboarding-replay does for onboarding's applyModelTurn. This module is
// infrastructure only: it changes NO behavior. It gives fixtures two things — a replay driver, and detectors that
// characterize a walk (question count, loops, advance) so golden-path + regression fixtures can assert against them.

import type { ConvMessage, ConvState, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

/** Every arc exposes the same shape: applyXTurn(state, history, memberMessage, model) → Turn (wraps runArcTurn). */
export type ArcApply = (state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn) => Turn;

/** One scripted member turn + the model output the harness feeds the kernel for it. */
export type ScriptTurn = { member: string; model: ModelTurn };

export type ReplayStep = {
  member: string;
  reply: string;
  complete: boolean;
  crisis: boolean;
  state: ConvState;
  stage?: string;
};

export type Replay = { opening: Turn; steps: ReplayStep[]; replies: string[] };

/**
 * Replay a scripted arc walk through the real pure kernel. Threads state + a running member/agent history exactly as
 * the live loop would (the opening is the first agent message). Returns every step for assertions. No API, no I/O.
 */
export function replayArc(apply: ArcApply, opening: Turn, script: ScriptTurn[]): Replay {
  const history: ConvMessage[] = [{ role: 'agent', text: opening.reply }];
  let state = opening.state;
  const steps: ReplayStep[] = [];
  for (const t of script) {
    const turn = apply(state, history, t.member, t.model);
    history.push({ role: 'member', text: t.member });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    steps.push({
      member: t.member,
      reply: turn.reply,
      complete: turn.complete,
      crisis: !!turn.crisis,
      state,
      stage: state.stage,
    });
  }
  return { opening, steps, replies: steps.map((s) => s.reply) };
}

// ── Detectors — characterize a walk. Phase 0 only MEASURES; later phases assert the contracts against these. ────────

/** Sentence-final questions in one assistant reply. The one-question-per-turn contract (Phase 1) targets this. */
export function questionCount(reply: string): number {
  // Count '?' that end a sentence/segment (ignore mid-string rhetorical marks inside a clause is out of scope here).
  return (reply.match(/\?/g) ?? []).length;
}

/** The most any single reply in the walk asks at once — the headline "two questions stacked" signal (#1/#4). */
export function maxQuestionsInAReply(r: Replay): number {
  return r.replies.reduce((m, reply) => Math.max(m, questionCount(reply)), 0);
}

/** A reply that repeats a prior reply near-verbatim → the loop signal for the advance contract (#3/#2/#17). */
export function hasRepeatedReply(r: Replay): boolean {
  const seen: string[] = [];
  for (const reply of r.replies) {
    const norm = reply.trim().toLowerCase().replace(/\s+/g, ' ');
    const head = norm.slice(0, 60);
    if (head && seen.some((p) => p.slice(0, 60) === head)) return true;
    seen.push(norm);
  }
  return false;
}

/** Did the walk reach completion by its end? (advance contract: a clean walk finishes; a loop never does.) */
export function completed(r: Replay): boolean {
  return r.steps.some((s) => s.complete);
}
