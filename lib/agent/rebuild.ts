// Rebuild (v2.4, Phase 3 — Control / Fitness, "the body"). Config #4 on the shared arc kernel (runArcTurn). Spec of
// record: G4L_Rebuild_Build_Approach_v0.1 + Greg's Rebuild Gated Assets V4. SLICE 1 = B1 · "What is Your Why?" — the
// Foundation asset: a 12-item Self-Determination (SDT) instrument on a 1–7 scale (activity, then eating), ADMINISTERED
// (deterministic, off the depth kernel — a validated construct is never "drawn out"). Per RB-1 the numeric profile is
// STORED but NOT displayed; the member gets the reflective experience + a forward-looking reflection at the close.
// This is a parallel motivation register — NEVER folded into Grinta (that's B4's Control component, a later slice).
// Flag-gated by REBUILD (Decision JJ — additive per-Phase) — OFF by default; prod stays v2.3 until the v2.4 flip.

import { runArcTurn, administeredStage, scaleExpects, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { withScriptedBeat } from './rewire.ts'; // "model reflects, engine carries the turn forward — never both, never a dead-end"
import { BEAT_SEP, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';
import { WHY_ITEMS, WHY_SCALE_MAX, WHY_ITEM_COUNT, WHY_DOMAIN_SPLIT } from '../rebuild/why-instrument.ts';
import {
  SKILL_ITEMS,
  SKILLS_ITEM_COUNT,
  SKILLS_DOMAIN_SPLIT,
  SKILLS_SCALE_MAX,
  scoreSkills,
  skillHighlights,
} from '../rebuild/skills-instrument.ts';
import { grintaStem, CHECKPOINT_CONTROL_ITEMS } from '../grinta/survey/instrument.ts';

export function rebuildEnabled(): boolean {
  return process.env.REBUILD === 'staged';
}

// ══ B1 · What is Your Why? ════════════════════════════════════════════════════════════════════════════════════
// The warm frame (ours), then Greg's activity prompt + item 0. Sets the honesty posture: no right answers, nothing
// to pass, not a score — a starting mark to watch move.
const B1_OPEN =
  "There's a simple place to start — your why. The reasons that are actually yours. Answer a few questions to get a " +
  "read on where you stand today. For each statement, tell me how true it feels — 1 (not at all true for you) to 7 " +
  "(very true for you).";
// The domain transition (ours) — shown when the diet items begin (index 6).
const B1_DIET_TURN = "That's movement. Now the other half of it — eating.";
// The forward-looking close (ours, RB-1): frame the baseline as a promise, not a verdict. No number is shown.
const B1_CLOSE =
  "That's your starting why. Some of it is already yours; some of it might still be the shoulds — and that's exactly " +
  "the point. We're not grading it. We're marking where you stand today, so when you come back to these same " +
  "questions down the road, you can watch your why become more your own. That shift is the real work of Rebuild. Your " +
  "next step is on your dashboard.";

// Deliver the framed item at 0-based index: activity prompt on item 0, the diet-domain frame + prompt on item 6, the
// bare stem otherwise (the item IS the ask — the administered wall, no draw-out).
function whyDeliver(index: number): string {
  const item = WHY_ITEMS[index]!;
  // The "Why do you want to be physically active regularly?" framing prompt is removed (Donna) — the member answers
  // the statements as they see fit. The eating half keeps its light transition (B1_DIET_TURN).
  if (index === WHY_DOMAIN_SPLIT) return `${B1_DIET_TURN}\n\n${item.stem}`;
  return item.stem;
}
function whyOpener(): string {
  return `${B1_OPEN}\n\n${whyDeliver(0)}`;
}

const whyStage: StageDef = administeredStage({
  id: 'why',
  itemCount: WHY_ITEM_COUNT, // 12
  scaleMax: WHY_SCALE_MAX, // 7 — the SDT scale (parameterized; every Grinta/IDQ caller stays 1–5)
  minLabel: 'not at all true', // W-24: chip anchors — match the re-prompt copy
  maxLabel: 'very true',
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
  return { reply: whyOpener(), state: { stage: 'why', collected: {} }, complete: false, expects: scaleExpects(REBUILD_B1_ARC, 'why', false) };
}

export function liveTurnRebuildB1(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRebuildB1Turn(state, history, memberMessage);
}

// ══ B2 · Appreciating Your Strengths and Weaknesses ═══════════════════════════════════════════════════════════
// The Structure asset: an ADMINISTERED 24-item self-management assessment (12 skills × activity/diet, 4-point scale),
// then Part B — a week of NOTICING which skills help/hinder (rides the practice-week scaffold; not behavior change).
// The profile is stored (self_management_reading) and reflected back in plain language at the close (strongest skill
// + growth edge — never a table of numbers). COPY: directional placeholder (Cowork wordsmiths), built from Greg's
// member-shown intro. The action scores + stores the reading and opens the noticing week on completion.
const B2_OPEN =
  "During the Rebuild phase, we'll practice what makes a healthy life actually stick. But before you change anything, " +
  "let's take stock of your current state. Review these statements and rate each one 1-strongly disagree to 4-strongly " +
  "agree.\n\nLet's start with Movement.";
const B2_DIET_TURN = "That's movement. Same skills now, for eating.";
function b2Close(strongest: string, growthEdge: string): string {
  return (
    `Right now it looks like ${strongest.toLowerCase()} is a strength of yours. The skill with the most room to grow ` +
    `is ${growthEdge.toLowerCase()}. Neither is fixed; a skill is just something you practice and improve. This week ` +
    `you don't have to change anything — just notice these showing up: when a strong skill carries you, and when a ` +
    `weaker one trips you. That's the work. Just notice. We'll kick that off in your next step. You can find it at the ` +
    `top of your Dashboard.`
  );
}

// Deliver the framed item: the activity intro on item 0, the diet-pass frame on item 12, the skill-labelled stem
// otherwise (the skill name orients the member; the statement IS the ask — administered, no draw-out).
function skillsDeliver(index: number): string {
  const item = SKILL_ITEMS[index]!;
  const line = `${item.skill}: ${item.stem}`;
  if (index === 0) return `Movement first.\n\n${line}`;
  if (index === SKILLS_DOMAIN_SPLIT) return `${B2_DIET_TURN}\n\n${line}`;
  return line;
}
function skillsOpener(): string {
  return `${B2_OPEN}\n\n${skillsDeliver(0)}`;
}

const skillsStage: StageDef = administeredStage({
  id: 'skills',
  itemCount: SKILLS_ITEM_COUNT, // 24
  scaleMax: SKILLS_SCALE_MAX, // 4 (strongly disagree → strongly agree)
  minLabel: 'strongly disagree', // W-24: chip anchors
  maxLabel: 'strongly agree',
  opener: () => skillsOpener(),
  deliverItem: (n) => skillsDeliver(n),
  reprompt: (n) => `A number from 1 to 4 — 1 is strongly disagree, 4 is strongly agree.\n\n${skillsDeliver(n)}`,
  onComplete: (b) => {
    // All 24 responses are in b.administeredResponses (activity 0–11, diet 12–23). Score + reflect the strongest /
    // growth-edge skill in-engine (pure fns, no DB) so the close names skills, not numbers. The ACTION stores the
    // full profile + opens the noticing week.
    const responses = b.administeredResponses.slice(0, SKILLS_ITEM_COUNT);
    const { strongest, growthEdge } = skillHighlights(scoreSkills(responses));
    b.stage = 'complete';
    b.complete = true;
    b.reply = b2Close(strongest, growthEdge);
  },
});

export const REBUILD_B2_ARC: ArcConfig = {
  id: 'rebuild-b2',
  stageOrder: ['skills'],
  stages: { skills: skillsStage },
  onComplete: () => B2_OPEN,
};

export function applyRebuildB2Turn(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return runArcTurn(REBUILD_B2_ARC, state, history, memberMessage, { text: '' });
}

export function rebuildB2Opening(): Turn {
  return { reply: skillsOpener(), state: { stage: 'skills', collected: {} }, complete: false, expects: scaleExpects(REBUILD_B2_ARC, 'skills', false) };
}

export function liveTurnRebuildB2(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRebuildB2Turn(state, history, memberMessage);
}

// ══ B3 · The Lifestyle Pilot (the marquee — COACH mode, Decision PP) ═══════════════════════════════════════════
// The Elevation asset: the member commits to ONE small activity change + ONE small diet change, the Companion COACHES
// them to a doable plan, then a week of daily logging + journaling (Part B). This is the first use of the third
// Companion mode: the MODEL owns the coaching turn (elicit → make specific → right-size, one at a time); the ENGINE
// holds the plan-COMPLETENESS contract — it never completes until BOTH changes are locked (the model's judgment,
// via record_plan) and the member CONFIRMS the whole plan (propose-confirm, Decision L). Reusable — Reclaim +
// Cycle 2 run on this same mode. COPY: directional placeholder (Cowork wordsmiths), built from Greg's B3 setup script.
const B3_OPEN_1 =
  "You've identified your why, and you've taken stock of your skills. Now we'll put it into practice.";
const B3_OPEN_2 =
  "You'll pick one small movement change, and one small healthier eating change to try for a week. Just two things " +
  "you're not already doing and small enough to actually stick.";
const B3_OPEN_3 = "We'll start with movement — what's one small change you could try this week?";
function b3Opening(): string {
  return `${B3_OPEN_1}${BEAT_SEP}${B3_OPEN_2}${BEAT_SEP}${B3_OPEN_3}`;
}

const B3_PLAN_CONFIRMED_1 =
  "Your Lifestyle Pilot is locked in. You've committed to one small change in movement, one in eating, for next week.";
const B3_PLAN_CONFIRMED_2 =
  "I'll check in on you every day. It's a good time to talk with other Community members too. Your plan's on your dashboard.";
const PILOT_REVISE_NUDGE = "No problem — tell me what you'd change, and we'll adjust it.";

// The engine-owned plan reflection (propose-confirm) — reflects BOTH changes back in the member's words, then the
// confirm gate. Not the model's text: the plan is shown consistently, from what was locked.
function proposePlan(activity: string, diet: string): string {
  return (
    `Here's your week, then — small and yours:\n\nMovement: ${activity}\nEating: ${diet}\n\n` +
    `Both are things you can practice on a normal week, not just your best one. Want to lock them in, or tweak one?`
  );
}
// Fallback coaching nudge (used only if the model returns nothing) — asks for whichever change is still missing.
function pilotCoachNudge(activity: string, diet: string): string {
  if (!activity)
    return (
      "Let's start with movement. One small physical thing you could add this week — something you're not already " +
      "doing. A 10-minute walk after dinner, five minutes of stretching, one short strength session. Small and real."
    );
  // No leading acknowledgment — this often follows the model's own "locked in" beat (see withScriptedBeat below); a
  // second "Good." would double up. Reads clean both appended and standalone.
  return (
    "Now — one small change to how you eat, an upgrade rather than an overhaul. A vegetable at dinner, swapping one " +
    "sugary drink for water, a fruit with breakfast. What feels doable?"
  );
}
// "lock them in" is the natural reply to TWO changes (and the chip the UI offers) — match it, not just "lock it".
const PILOT_CONFIRM_RE =
  /^(yes|yeah|yep|yup|please(?: do)?|go ahead|sure|ok(?:ay)?|lock (?:it|them|'?em)(?: in)?|that'?s it|that works|that'?s good|perfect|good|sounds good|do it|let'?s do it|i'?m in|ready|confirm(ed)?|keep it)\b/i;
function pilotConfirms(msg: string): boolean {
  return PILOT_CONFIRM_RE.test(msg.trim().replace(/[.,!?]+$/, ''));
}

// The coach stage — the model coaches; the engine accumulates the locked fields, proposes the whole plan when both
// are in, and completes only on the member's confirm. Specificity + right-sizing are the MODEL's job; existence +
// both-present + confirm are the engine's contract (the completion-contract lesson — a member never leaves without a plan).
const pilotStage: StageDef = {
  id: 'pilot',
  mode: 'coach',
  opener: () => b3Opening(),
  offersSubstance: () => true,
  gather() {},
  confirm() {},
  coach(b) {
    const sc = b.scratch as { proposed?: boolean };
    // Accumulate the model's locked fields (a field appears only once the model judged it specific + right-sized).
    if (b.model.plan?.activityChange) b.collected.pilotActivity = b.model.plan.activityChange.trim();
    if (b.model.plan?.dietChange) b.collected.pilotDiet = b.model.plan.dietChange.trim();
    const activity = (b.collected.pilotActivity ?? '').trim();
    const diet = (b.collected.pilotDiet ?? '').trim();

    if (sc.proposed) {
      // Awaiting the member's confirm on the whole plan.
      if (pilotConfirms(b.memberMessage)) {
        b.stage = 'complete';
        b.complete = true;
        b.reply = `${B3_PLAN_CONFIRMED_1}${BEAT_SEP}${B3_PLAN_CONFIRMED_2}`;
        return;
      }
      // Not a confirm → the member is tweaking. Re-open coaching; the model re-locks the changed field next turn.
      sc.proposed = false;
      b.reply = (b.modelText || PILOT_REVISE_NUDGE).trim();
      return;
    }

    if (activity && diet) {
      // Both changes locked → PROPOSE the whole plan (engine-owned reflection).
      sc.proposed = true;
      b.reply = proposePlan(activity, diet);
      return;
    }

    // Still coaching — the model's turn IS the reply (its next question / examples). But the moment it LOCKS the first
    // change it tends to end on a terminal "Locked in." with no next question (Jay's walk: "creates a dead end" — the
    // eating change is waiting and the thread just stops). withScriptedBeat carries the turn forward to whichever change
    // is still open UNLESS the model already asked its own question — the same "reflect / ask, never both" discipline as
    // the Rewire beats. Empty model → the scripted nudge stands alone.
    b.reply = withScriptedBeat((b.modelText ?? '').trim(), pilotCoachNudge(activity, diet));
  },
};

export const REBUILD_B3_ARC: ArcConfig = {
  id: 'rebuild-b3',
  stageOrder: ['pilot'],
  stages: { pilot: pilotStage },
  onComplete: () => B3_PLAN_CONFIRMED_1,
};

export function applyRebuildB3Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REBUILD_B3_ARC, state, history, memberMessage, model);
}

export function rebuildB3Opening(): Turn {
  return { reply: b3Opening(), state: { stage: 'pilot', collected: {} }, complete: false };
}

// ── the live surface — the model COACHES to a plan and LOCKS each change via record_plan (specific + right-sized) ──
const B3_SYSTEM =
  "You are the G4L Companion running B3, the Lifestyle Pilot, in Rebuild (Phase 3). Your job is to COACH the member to " +
  "a small, doable, member-owned plan: ONE small new physical-activity change and ONE small new dietary change for the " +
  "coming week. This is coaching, not therapy and not a survey — help them make a plan; don't excavate feelings or " +
  "grade them. Plain, measured, warm, no hype.\n\n" +
  "HOW TO COACH: one change at a time — movement first, then eating. One question per turn. Elicit their idea; if it's " +
  "vague ('exercise more', 'eat better'), sharpen it WITH them into something specific and trackable ('a 10-minute walk " +
  "after dinner, 3 days'). If they have nothing to reach for, OFFER concrete examples (a 10-minute walk after dinner; " +
  "five minutes of morning stretching; adding a vegetable at dinner; swapping one sugary drink for water). RIGHT-SIZE: " +
  "if they over-commit ('run every day', 'cut out all sugar'), gently dial it back — small and new beats ambitious and " +
  "abandoned. Play their own words back; never impose a plan.\n\n" +
  "LOCKING A CHANGE: the moment a change is specific, right-sized, AND the member has affirmed it, call record_plan for " +
  "that field (activityChange for movement, dietChange for eating) — the change in their own words. Do NOT call " +
  "record_plan for a vague or oversized change; keep coaching until it's real. After you lock the FIRST change, keep " +
  "the turn going in the same reply — acknowledge it in a few words and pivot straight to coaching the other change; " +
  "never end your turn on just an acknowledgment while a change is still open. Once BOTH are locked, stop and give a " +
  "brief warm acknowledgment — the app shows the member their plan to confirm. If a distress or crisis signal appears, " +
  "drop the exercise and route to support (988 US / local) and a human — always on.";

const RECORD_PLAN_TOOL = {
  name: 'record_plan',
  description:
    "Lock a plan field once it is specific, right-sized, and the member has affirmed it. Pass activityChange for the " +
    "movement change and/or dietChange for the eating change, each in the member's own words.",
  input_schema: {
    type: 'object' as const,
    properties: {
      activityChange: { type: 'string', description: "The member's committed small movement change — specific + trackable." },
      dietChange: { type: 'string', description: "The member's committed small eating change — specific + trackable." },
    },
  },
};

function b3StageNote(state: ConvState): string {
  const activity = (state.collected?.pilotActivity ?? '').trim();
  const diet = (state.collected?.pilotDiet ?? '').trim();
  if (!activity)
    return "\n\nRIGHT NOW: coach the MOVEMENT change — one small, specific, trackable thing they're not already doing. When it's real and they've affirmed it, call record_plan(activityChange). Then DON'T STOP — in the same reply, briefly acknowledge it and move straight into coaching the EATING change (there are two; never end your turn on just an acknowledgment).";
  if (!diet)
    return "\n\nRIGHT NOW: the movement change is locked. Now coach the EATING change — one small upgrade. When it's real and affirmed, call record_plan(dietChange).";
  return "\n\nRIGHT NOW: both changes are locked. Give a brief warm acknowledgment; the app will show the plan to confirm.";
}

// Parse an Anthropic response into a ModelTurn (prose + any record_plan locks). Pure below this line lives in the arc.
function parseB3Model(content: readonly unknown[]): ModelTurn {
  let text = '';
  const plan: { activityChange?: string; dietChange?: string } = {};
  for (const raw of content) {
    const bl = raw as { type: string; text?: string; name?: string; input?: { activityChange?: unknown; dietChange?: unknown } };
    if (bl.type === 'text') text += bl.text ?? '';
    if (bl.type === 'tool_use' && bl.name === 'record_plan') {
      if (typeof bl.input?.activityChange === 'string') plan.activityChange = bl.input.activityChange;
      if (typeof bl.input?.dietChange === 'string') plan.dietChange = bl.input.dietChange;
    }
  }
  return { text: text.trim(), ...(plan.activityChange || plan.dietChange ? { plan } : {}) };
}

export async function liveTurnRebuildB3(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 2,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 400,
    system: B3_SYSTEM + b3StageNote(state),
    tools: [RECORD_PLAN_TOOL],
    messages,
  });
  return applyRebuildB3Turn(state, history, memberMessage, parseB3Model(res.content));
}

// Compose the pilot plan into one Playbook keeper (the two small changes, the member's own words). §5 keeper candidate.
export function composePilotPlan(activity: string, diet: string): string {
  return `Movement — ${activity}\nEating — ${diet}`;
}

// ══ B4 · The Rebuild Checkpoint ═══════════════════════════════════════════════════════════════════════════════
// The Phase-3 close: an ADMINISTERED beat (12 current-state Control items, 1–5, deterministic — same factory as the
// IDQ/§2e/R4 read) → a hold into the ceremony (the reveal overlay fires from the chat). The ACTION pairwise-averages
// the 12 → 6, scores the Control component (Ave1→Ave2), writes the Checkpoint grinta_reading, and sets the
// rebuild_checkpoint_passed gate (→ Reclaim lit). Items VERBATIM (CHECKPOINT_CONTROL_ITEMS, RB-2 resolved). Copy: B4 doc.
const B4_CHECKPOINT_OPEN =
  "You did the real work of Rebuild — you found your why, took stock of your skills, and ran the pilot in your " +
  "own life. Before we close the Phase, a quick read on where your control sits now. A dozen of these, one to five. No " +
  "passing score — just a gauge of what you've built.";
const B4_CHECKPOINT_CLOSE = "That's the read. Hold on — let me show you what you just built.";
function rebuildCheckpointDeliver(index: number): string {
  return grintaStem(CHECKPOINT_CONTROL_ITEMS[index]!);
}
function rebuildCheckpointOpener(): string {
  return `${B4_CHECKPOINT_OPEN}\n\n${rebuildCheckpointDeliver(0)}`;
}

const rebuildCheckpointStage: StageDef = administeredStage({
  id: 'checkpoint',
  itemCount: CHECKPOINT_CONTROL_ITEMS.length, // 12 (scaleMax defaults to 5)
  minLabel: 'not at all', // W-24: chip anchors — the frozen Grinta 1–5 poles
  maxLabel: 'completely',
  opener: () => rebuildCheckpointOpener(),
  deliverItem: (n) => rebuildCheckpointDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel right now?\n\n${rebuildCheckpointDeliver(n)}`,
  onComplete: (b) => {
    // The 12 control responses are in b.administeredResponses. Hand into the ceremony; the ACTION averages 12→6,
    // scores the Control component (Ave1→Ave2), persists the Checkpoint reading, and sets the phase gate.
    b.stage = 'ceremony';
    b.reply = B4_CHECKPOINT_CLOSE;
  },
});

const REBUILD_CEREMONY_LEAD = 'Hold on — let me show you what you just built.';
const rebuildCeremonyStage: StageDef = {
  id: 'ceremony',
  mode: 'drawout',
  opener: () => REBUILD_CEREMONY_LEAD,
  offersSubstance: () => true,
  gather(b) {
    b.reply = REBUILD_CEREMONY_LEAD;
  },
  confirm(b) {
    b.reply = REBUILD_CEREMONY_LEAD;
  },
};

export const REBUILD_CHECKPOINT_ARC: ArcConfig = {
  id: 'rebuild-checkpoint',
  stageOrder: ['checkpoint', 'ceremony'],
  stages: { checkpoint: rebuildCheckpointStage, ceremony: rebuildCeremonyStage },
  onComplete: () => REBUILD_CEREMONY_LEAD,
};

export function applyRebuildCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REBUILD_CHECKPOINT_ARC, state, history, memberMessage, model);
}

export function rebuildCheckpointOpening(): Turn {
  return { reply: rebuildCheckpointOpener(), state: { stage: 'checkpoint', collected: {} }, complete: false, expects: scaleExpects(REBUILD_CHECKPOINT_ARC, 'checkpoint', false) };
}

// The Checkpoint is ADMINISTERED (deterministic Likert parse) — no model call needed. The action passes empty text.
export function liveTurnRebuildCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRebuildCheckpointTurn(state, history, memberMessage, { text: '' });
}
