// Reclaim (v2.5, Phase 4 — Challenge / "the bigger world"). Config #5 on the shared arc kernel. Spec of record:
// G4L_Reclaim_Build_Approach_v0.2 + Greg's RECLAIM Gated Assets V4. The Cycle-1 capstone — closes the loop, hands to
// Community. Almost entirely REUSE (coaching mode, administered factory, Momentum, the checkpoint+ceremony pattern).
// SLICE 1 = C1 · Readiness Assessment. Step 1 (here) = the 15-item evidence self-check — administered, and per RC-2
// (Greg 7/9) FORMATIVE ONLY: not scored, not persisted, just a reflective "are you in Reclaim" mirror. Step 2 (the
// Reclaim List refinement, coaching mode) follows. Flag-gated by RECLAIM (Decision JJ) — OFF by default; prod stays v2.4.

import { runArcTurn, administeredStage, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { BEAT_SEP, type ConvMessage, type ConvState, type Turn } from './onboarding.ts';
import { EVIDENCE_ITEMS, EVIDENCE_ITEM_COUNT, EVIDENCE_PART_STARTS, EVIDENCE_PART_LABEL } from '../reclaim/evidence-instrument.ts';

export function reclaimEnabled(): boolean {
  return process.env.RECLAIM === 'staged';
}

// ══ C1 · Readiness Assessment · Step 1 — Reflecting on Progress ═══════════════════════════════════════════════
// The warm frame (Greg's member intro), then the three evidence clusters (Physical → Relational → Identity), 1–5.
const C1_OPEN =
  "Reclaim isn't something someone else declares for you — it's something you recognize in yourself. This is a look at " +
  "whether the work you've done through Reconnect, Rewire, and Rebuild is showing up in how you live, not just how you " +
  "feel. Rate each one 1 (strongly disagree) to 5 (strongly agree). There's no score here — just an honest read. We'll " +
  "go in three parts: your body, your relationships, and who you are.";
// The close (Greg's verbatim "Guide to Member after Step 1") — reflective, all-or-nothing explicitly rejected. Bridges
// toward Step 2 (revisiting the Reclaim List).
const C1_STEP1_CLOSE_1 =
  "That's the read. If you rated yourself a 4 or 5 on most of these, the work has landed — you're in Reclaim. Not " +
  "because someone told you, but because the evidence is there. And if it's more mixed, that's honest too: Reclaim " +
  "isn't all-or-nothing. You can be in Reclaim in your body and still in Rebuild in your relationships. The Rs are a " +
  "cycle, not a checklist.";
const C1_STEP1_CLOSE_2 = "Next, let's revisit your Reclaim List — the same list from the start, re-read with clearer eyes.";

// Deliver the framed item: a part header on the first item of each cluster (0/5/10), the bare stem otherwise.
function evidenceDeliver(index: number): string {
  const item = EVIDENCE_ITEMS[index]!;
  const partStart = EVIDENCE_PART_STARTS[index];
  if (partStart) return `${EVIDENCE_PART_LABEL[partStart]}\n\n${item.stem}`;
  return item.stem;
}
function evidenceOpener(): string {
  return `${C1_OPEN}\n\n${evidenceDeliver(0)}`;
}

const evidenceStage: StageDef = administeredStage({
  id: 'evidence',
  itemCount: EVIDENCE_ITEM_COUNT, // 15 (scaleMax defaults to 5)
  opener: () => evidenceOpener(),
  deliverItem: (n) => evidenceDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel?\n\n${evidenceDeliver(n)}`,
  onComplete: (b) => {
    // FORMATIVE (RC-2): the 15 responses are NOT scored or persisted. Close on the reflective mirror; Step 2 (the list
    // refinement) is a separate arc for now. b.administeredResponses holds them only for the turn — nothing reads them.
    b.stage = 'complete';
    b.complete = true;
    b.reply = `${C1_STEP1_CLOSE_1}${BEAT_SEP}${C1_STEP1_CLOSE_2}`;
  },
});

export const RECLAIM_C1_ARC: ArcConfig = {
  id: 'reclaim-c1',
  stageOrder: ['evidence'],
  stages: { evidence: evidenceStage },
  onComplete: () => C1_STEP1_CLOSE_1,
};

export function applyReclaimC1Turn(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  // C1 Step 1 is ADMINISTERED (deterministic Likert parse) — no model call needed; the action passes empty text.
  return runArcTurn(RECLAIM_C1_ARC, state, history, memberMessage, { text: '' });
}

export function reclaimC1Opening(): Turn {
  return { reply: evidenceOpener(), state: { stage: 'evidence', collected: {} }, complete: false };
}

export function liveTurnReclaimC1(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyReclaimC1Turn(state, history, memberMessage);
}
