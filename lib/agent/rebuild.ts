// Rebuild (v2.4, Phase 3 — Control / Fitness, "the body"). Config #4 on the shared arc kernel (runArcTurn). Spec of
// record: G4L_Rebuild_Build_Approach_v0.1 + Greg's Rebuild Gated Assets V4. SLICE 1 = B1 · "What is Your Why?" — the
// Foundation asset: a 12-item Self-Determination (SDT) instrument on a 1–7 scale (activity, then eating), ADMINISTERED
// (deterministic, off the depth kernel — a validated construct is never "drawn out"). Per RB-1 the numeric profile is
// STORED but NOT displayed; the member gets the reflective experience + a forward-looking reflection at the close.
// This is a parallel motivation register — NEVER folded into Grinta (that's B4's Control component, a later slice).
// Flag-gated by REBUILD (Decision JJ — additive per-Phase) — OFF by default; prod stays v2.3 until the v2.4 flip.

import { runArcTurn, administeredStage, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import type { ConvMessage, ConvState, Turn } from './onboarding.ts';
import { WHY_ITEMS, WHY_PROMPTS, WHY_SCALE_MAX, WHY_ITEM_COUNT, WHY_DOMAIN_SPLIT } from '../rebuild/why-instrument.ts';

export function rebuildEnabled(): boolean {
  return process.env.REBUILD === 'staged';
}

// ══ B1 · What is Your Why? ════════════════════════════════════════════════════════════════════════════════════
// The warm frame (ours), then Greg's activity prompt + item 0. Sets the honesty posture: no right answers, nothing
// to pass, not a score — a starting mark to watch move.
const B1_OPEN =
  "Before we build anything in Rebuild, a simple place to start — your why. Not the shoulds. The reasons that are " +
  "actually yours. There are no right answers here and nothing to pass; this is just a read on where you stand today. " +
  "For each statement, tell me how true it feels — 1 (not at all true for you) to 7 (very true for you). Movement " +
  "first, then eating.";
// The domain transition (ours) — shown when the diet items begin (index 6).
const B1_DIET_TURN = "That's movement. Now the other half of it — eating.";
// The forward-looking close (ours, RB-1): frame the baseline as a promise, not a verdict. No number is shown.
const B1_CLOSE =
  "That's your starting why. Some of it is already yours; some of it might still be the shoulds — and that's exactly " +
  "the point. We're not scoring it. We're marking where you stand today, so when you come back to these same " +
  "questions down the road, you can watch your why become more your own. That shift is the real work of Rebuild. Your " +
  "next step is on your dashboard.";

// Deliver the framed item at 0-based index: activity prompt on item 0, the diet-domain frame + prompt on item 6, the
// bare stem otherwise (the item IS the ask — the administered wall, no draw-out).
function whyDeliver(index: number): string {
  const item = WHY_ITEMS[index]!;
  if (index === 0) return `${WHY_PROMPTS.activity}\n\n${item.stem}`;
  if (index === WHY_DOMAIN_SPLIT) return `${B1_DIET_TURN}\n\n${WHY_PROMPTS.diet}\n\n${item.stem}`;
  return item.stem;
}
function whyOpener(): string {
  return `${B1_OPEN}\n\n${whyDeliver(0)}`;
}

const whyStage: StageDef = administeredStage({
  id: 'why',
  itemCount: WHY_ITEM_COUNT, // 12
  scaleMax: WHY_SCALE_MAX, // 7 — the SDT scale (parameterized; every Grinta/IDQ caller stays 1–5)
  opener: () => whyOpener(),
  deliverItem: (n) => whyDeliver(n),
  reprompt: (n) => `A number from 1 to 7 — 1 is “not at all true for you,” 7 is “very true for you.”\n\n${whyDeliver(n)}`,
  onComplete: (b) => {
    // All 12 responses are in b.administeredResponses (activity 0–5, diet 6–11). B1 has no ceremony and no Grinta
    // move — it just closes on the forward-looking reflection. The ACTION scores the SDT profile + stores it (RB-1).
    b.stage = 'complete';
    b.complete = true;
    b.reply = B1_CLOSE;
  },
});

export const REBUILD_B1_ARC: ArcConfig = {
  id: 'rebuild-b1',
  stageOrder: ['why'],
  stages: { why: whyStage },
  onComplete: () => B1_CLOSE,
};

export function applyRebuildB1Turn(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  // B1 is ADMINISTERED (deterministic Likert parse) — no model call needed; the action passes empty text.
  return runArcTurn(REBUILD_B1_ARC, state, history, memberMessage, { text: '' });
}

export function rebuildB1Opening(): Turn {
  return { reply: whyOpener(), state: { stage: 'why', collected: {} }, complete: false };
}

export function liveTurnRebuildB1(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRebuildB1Turn(state, history, memberMessage);
}
