// Rewire (v2.3, Phase 2 — Commitment/Mindfulness). Config #3 on the shared arc kernel (runArcTurn). Spec of record:
// G4L_Rewire_Build_Approach_v0.1.md (Jay-approved). Builds on the Reconnect engine (two-mode kernel, callback,
// administered checkpoint, earned ceremony, recalibration HH). THIS INCREMENT = SLICE 1: W1 (the Disinformation
// Audit) as a draw-out Session, harvesting the member's "true line" (affirmation) as a Playbook keeper. W2 / W3 / R4
// are later slices (they extend the arc the way Reconnect's beats did). Flag-gated by REWIRE (Decision JJ) — OFF by
// default; prod keeps the v1 static Rewire Sessions until the coupled v2.3 flip.
//
// PLACEHOLDER COPY: the member-facing lines below are Greg's V4 draft (lib/curriculum/content/rewire.ts · RWR-DIS),
// used as SCAFFOLDING. The plain-language voice pass (Decision B) is Cowork + Jay's lane; the polished copy replaces
// these constants without changing the beat structure or the harvest wiring.

import { resolveGapConfirm } from './onboarding-intent.ts';
import { runArcTurn, drawoutShouldReflect, withQuestion, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import type { ConvMessage, ConvState, ModelTurn, Turn } from './onboarding.ts';

// Is the Rewire arc selected? Own flag (Decision JJ) — defaults OFF, so prod keeps v1 static Rewire until the v2.3
// flip. Mirrors reconnectEnabled() / stagedEngineEnabled(); ONBOARDING_ENGINE + RECONNECT + REWIRE flip in sequence.
export function rewireEnabled(): boolean {
  return process.env.REWIRE === 'staged';
}

// ── W1 · The Disinformation Audit ────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER COPY (Greg V4 / RWR-DIS) — replaced by Jay's voice pass; structure is stable.
const W1_AUDIT_OPEN =
  "Your mind runs a quiet campaign to keep you comfortable — and comfortable, right now, means stuck. It tells you " +
  "things that sound like facts: 'too late for me,' 'I don't have the time,' 'this is just what fifty looks like.' " +
  "Let's catch the loudest one — write the lie you tell yourself most, in its own words, the way your head says it.";
const W1_AUDIT_PROBES = [
  "That's the cleaned-up version. What does it sound like at 6am when the alarm goes off? Say it rawer.",
  'And when it runs loudest — what does it talk you out of?',
];
// The reflection at enough depth IS the cross-examination — put the lie on trial (Greg's step 2).
const W1_CROSS_EXAMINE =
  "Now we put it on trial. A lie survives because no one ever asks it for evidence. What's the actual proof FOR it — " +
  "and what's the proof against?";
const W1_REOPEN = "Then I've not caught it yet — say it your way. What's the lie, in your own words?";
// Beat 2 — write the true line (the affirmation).
const W1_AFFIRM_OPEN =
  "A lie you've disproven still needs something to stand in its place. Not a slogan — something true you can stand " +
  "behind on a bad day. Write your true line: one sentence, true enough that you'd say it out loud.";
const W1_AFFIRM_PROBE = "If it sounds like a motivational poster, it won't hold — make it sound like you.";
const W1_CLOSE =
  "That's the audit. The lie won't vanish — but now you've got a line to answer it with, and I've kept your true " +
  "line in your Playbook. Next time the old line shows up, you've got this one to meet it with.";
// ── end placeholder copy ──

const AUDIT_MIN_DEPTH = 2;
const AUDIT_MAX_DEPTH = 4;

function auditMore(history: ConvMessage[]): string {
  const asked = history.filter((h) => h.role === 'agent' && /\?/.test(h.text)).length;
  return W1_AUDIT_PROBES[asked % W1_AUDIT_PROBES.length]!;
}
function reflectAudit(modelText: string): string {
  const t = (modelText ?? '').trim();
  if (t && /\?\s*$/.test(t)) return t; // the model already asked its own cross-examination
  if (t) return `${t}\n\n${W1_CROSS_EXAMINE}`;
  return W1_CROSS_EXAMINE;
}

// Beat 1 — surface the comfortable lie + cross-examine it (draw-out on the depth kernel).
const auditStage: StageDef = {
  id: 'audit',
  mode: 'drawout',
  opener: () => W1_AUDIT_OPEN,
  offersSubstance: (message) => message.trim().length >= 8,
  gather(b) {
    const sc = b.scratch as { auditDepth?: number };
    sc.auditDepth = (sc.auditDepth ?? 0) + 1;
    const advance = drawoutShouldReflect(b.modelText, b.model.depthReady, sc.auditDepth, AUDIT_MIN_DEPTH, AUDIT_MAX_DEPTH);
    if (!advance) {
      b.reply = withQuestion(b.modelText, auditMore(b.history));
    } else {
      b.reply = reflectAudit(b.modelText);
      b.awaitingConfirm = true;
    }
  },
  confirm(b) {
    const intent = resolveGapConfirm(b.memberMessage, b.model.replyIntent); // dispute | addition | done
    if (intent === 'dispute') {
      b.awaitingConfirm = false;
      b.reply = W1_REOPEN;
    } else if (intent === 'addition') {
      b.awaitingConfirm = false;
      b.reply = withQuestion(b.modelText, auditMore(b.history)); // more evidence first
    } else {
      // The lie is caught and cross-examined → hand into writing the true line (the affirmation).
      b.awaitingConfirm = false;
      b.stage = 'affirm';
      b.reply = W1_AFFIRM_OPEN;
    }
  },
};

// Beat 2 — the true line (affirmation) → harvested as a Playbook keeper. A single-line capture, not a deep draw-out.
const affirmStage: StageDef = {
  id: 'affirm',
  mode: 'drawout',
  opener: () => W1_AFFIRM_OPEN,
  offersSubstance: (message) => message.trim().length >= 6,
  gather(b) {
    const line = b.memberMessage.trim();
    if (line.length < 6) {
      b.reply = W1_AFFIRM_PROBE; // too thin / sloganish — draw it out once
      return;
    }
    // Harvest the affirmation (default-emit; the action drains pendingHarvest → emitHarvestMoment). keeperType
    // 'principle' — a positive rule/true-line the member commits to (KeeperType enum, harvest.ts). Member-owned;
    // propose/confirm on the Playbook per the frozen harvest contract (Decision O).
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    b.reply = W1_CLOSE;
    b.complete = true; // SLICE 1 terminal — W1 done; W2 (Visualization) is the next slice.
  },
  confirm(b) {
    affirmStage.gather(b); // no confirm loop for the single-line capture — treat any turn here as the line
  },
};

// The Rewire arc — config #3 on the generic kernel. SLICE 1 = W1 only (audit → affirm → complete). Later slices add
// W2/W3/R4 to stageOrder + stages + a real ceremony onComplete, exactly as Reconnect's beats were added.
export const REWIRE_ARC: ArcConfig = {
  id: 'rewire',
  stageOrder: ['audit', 'affirm'],
  stages: { audit: auditStage, affirm: affirmStage },
  onComplete: () => W1_CLOSE,
};

// The Rewire turn — public signature mirrors applyReconnectTurn / applyStagedTurn.
export function applyRewireTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_ARC, state, history, memberMessage, model);
}

// The opening beat (W1 audit). The live wrapper (liveTurnRewire) + the model tool-surface + the dashboard entry land
// in a later slice; this is enough to replay + felt-walk the W1 structure offline.
export function rewireOpening(): Turn {
  return { reply: W1_AUDIT_OPEN, state: { stage: 'audit', collected: {} }, complete: false };
}
