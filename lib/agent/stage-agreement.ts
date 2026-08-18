// STAGE AGREEMENT — the engine's stage and the model's turn must describe the same conversation.
//
// THE SHAPE THIS EXISTS TO KILL. The engine owns structure; the model owns content. But nothing ever checked that
// the two agreed, so they could silently diverge: the engine sits in `gap` believing it is still drawing out the
// story while the model, believing it has moved on, runs the NEXT stage's conversation itself. The member is
// talking to the model, so the member goes with the model — and every structural guarantee the engine provides for
// that stage (the authored bridge, the verbatim builder, the parked-wants read-back) silently does not happen.
//
// It has now been fixed twice at the classifier layer and come back both times:
//   1. Jay's walk (2026-07-29) — the corroboration gate. "the reclaim BUILDER never fired and the old
//      conversational extraction came back" (onboarding-staged.ts, the gap confirm).
//   2. Donna's walk (2026-08-18) — `isAnaphoricClose`. Her "It was primarily around those three things" read as a
//      fresh chapter, the engine held in `gap`, and the model ran the whole Reclaim List in chat. She was then
//      handed the builder for a list she had already built: "Didn't we just do my Reclaim List?"
//
// Both fixes made the CLOSING-SENTENCE recognizer better. Neither could stop the divergence, because the recognizer
// is natural-language classification and there is always another way to say "I'm done". Per CLAUDE.md the second
// occurrence of a shape is the signal to stop patching and fix the abstraction — so this module stops trying to
// prevent divergence and instead makes it DETECTABLE and RECOVERABLE:
//
//   - DETECT. The model's own turn says which stage it is running. Reciting or soliciting the Reclaim List is not
//     ambiguous, and it is evidence the engine can act on deterministically.
//   - NEVER DROP. Once diverged, the member's next message is answering the MODEL's stage, not the engine's. The
//     caller captures it there. This is the "never drop what they gave you" invariant applied to a desynced engine.
//
// WHAT IT DELIBERATELY DOES NOT DO: move the engine's stage. That was the first thing I built and it was wrong.
// Reclaim is a STRUCTURED-BUILDER stage with no conversational mode — its gather routes anything that is not a
// builder submission straight on into the Grinta survey. So "helpfully" advancing a diverged member into Reclaim
// skipped the builder entirely and dropped them into the 12-item baseline mid-sentence. Advancing fights the
// architecture; capturing works with it.
//
// The recovery is already in the code and only ever needed its input. `reclaimOpening` reads parked wants back —
// "Earlier you said you want X and Y back, so those are on your list. What else?" — which its own comment calls
// the single best trust moment in the flow, because it proves nothing was dropped. Blank, that same opener is
// what made Donna ask "Didn't we just do my Reclaim List?". Seeded, it is the answer to that question. So the job
// here is narrow and load-bearing: make sure what she told the model is PARKED by the time that opener runs.
//
// ASYMMETRIC ON PURPOSE — only a model that has demonstrably taken the member into a LATER stage counts. A model
// lagging the engine is normal (mid-reflection on the stage we are in) and is left alone.

import type { ConvMessage } from './onboarding.ts';

export type StageId = string;

/** Which stage a model turn is demonstrably running, and the phrase that proves it (for tests + telemetry). */
export type ModelStageEvidence = { stage: StageId; tell: string };

// DELIBERATELY NARROW. A false positive here advances a real member past a stage, so every pattern must be
// something the model can only be saying if it is ALREADY RUNNING that stage with the member — soliciting or
// reciting, never merely mentioning. "we'll build that list in a minute" is a forecast and must NOT match.
//
// Keyed by stage so adding a surface is a table entry, not a new branch: the shape is general even though today
// only Reclaim has been observed to capture the model. (The administered stages — IDQ, Grinta — run off the
// kernel entirely and the model has no path to run them.)
const STAGE_TELLS: Array<{ stage: StageId; re: RegExp }> = [
  // "Now — what do you want back?" / "What else do you want back?" — Donna's walk, the model's own transition.
  { stage: 'reclaim', re: /\bwhat (?:else )?(?:do|would) you want back\b/i },
  // "Then here's your Reclaim List as it stands:" — the model reciting a list it gathered itself.
  { stage: 'reclaim', re: /\b(?:here'?s|this is) your reclaim list\b/i },
  { stage: 'reclaim', re: /\byour reclaim list as it stands\b/i },
];

/**
 * Which stage is this model turn actually running? `null` when there is no unambiguous tell — the common case,
 * and the safe default: no evidence means no divergence, so the engine keeps its own counsel.
 */
export function detectModelStage(text: string): ModelStageEvidence | null {
  const t = (text ?? '').replace(/[‘’]/g, "'");
  if (!t.trim()) return null;
  for (const { stage, re } of STAGE_TELLS) {
    const m = re.exec(t);
    if (m) return { stage, tell: m[0] };
  }
  return null;
}

/** The most recent thing the Companion said — what the member's current message is replying TO. */
export function lastAgentText(history: ConvMessage[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h && h.role === 'agent') return h.text ?? '';
  }
  return '';
}

export type StageAgreement =
  | { diverged: false }
  | {
      diverged: true;
      /** The stage the model has demonstrably taken the member into. */
      modelStage: StageId;
      /** The phrase that proved it — surfaced so a failure is debuggable without a live walk. */
      tell: string;
    };

export interface StageAgreementInput {
  engineStage: StageId;
  /** The Companion's PREVIOUS turn — the one the member is answering. This is the load-bearing signal. */
  priorAgentText: string;
  /**
   * This turn's model text. Accepted for symmetry and future detectors, but deliberately NOT read: see
   * resolveStageAgreement. A tell here has not reached the member yet.
   */
  currentModelText?: string;
  stageOrder: StageId[];
}

/**
 * Compare where the engine thinks it is against where the model has actually taken the member.
 *
 * Reads the PRIOR agent turn, and only that: divergence is about the conversation the member is demonstrably
 * already in. A tell in this turn's model text describes a question they have not been asked yet.
 */
export function resolveStageAgreement(input: StageAgreementInput): StageAgreement {
  const { engineStage, priorAgentText, stageOrder } = input;
  // PRIOR TURN ONLY. A tell in THIS turn's model text means the member has not seen it yet — their message is still
  // answering the previous beat, and both acting on it and capturing it are wrong. Advancing on it handed the
  // member's message to the new stage's handler, which filed Donna's gap close as a Reclaim want and then ran
  // straight on into the Grinta survey. Waiting one turn costs nothing: nothing has been mis-captured yet, and the
  // divergence is still there to be found the moment she replies to it.
  const evidence = detectModelStage(priorAgentText);
  if (!evidence) return { diverged: false };

  const here = stageOrder.indexOf(engineStage);
  const there = stageOrder.indexOf(evidence.stage);
  // An unknown stage on either side is not evidence of anything — never act on an index we cannot place.
  if (here < 0 || there < 0) return { diverged: false };
  // FORWARD ONLY. Equal means agreement (the engine emitted that copy itself, which is the normal case once the
  // stage has legitimately advanced). Behind means the model is mid-reflection on the stage we are in — also fine.
  if (there <= here) return { diverged: false };

  return { diverged: true, modelStage: evidence.stage, tell: evidence.tell };
}
