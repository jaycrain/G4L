// Rebuild (v2.4, Phase 3 — Control / Fitness, "the body"). Config #4 on the shared arc kernel (runArcTurn). Spec of
// record: G4L_Rebuild_Build_Approach_v0.1 + Greg's Rebuild Gated Assets V4. SLICE 1 = B1 · "What is Your Why?" — the
// Foundation asset: a 12-item Self-Determination (SDT) instrument on a 1–7 scale (activity, then eating), ADMINISTERED
// (deterministic, off the depth kernel — a validated construct is never "drawn out"). Per RB-1 the numeric profile is
// STORED but NOT displayed; the member gets the reflective experience + a forward-looking reflection at the close.
// This is a parallel motivation register — NEVER folded into Grinta (that's B4's Control component, a later slice).
// Flag-gated by REBUILD (Decision JJ — additive per-Phase) — OFF by default; prod stays v2.3 until the v2.4 flip.

import { MEMBER_AGENT_GOVERNED_CORE } from './system-prompt.ts';
import { runArcTurn, administeredStage, engagementStage, engagementOpening, elicitationStage, didacticStage, checkpointEngagement, receiveThen, AGREEMENT_1_5, AGREEMENT_1_5_HINT, scaleExpects, type ArcConfig, type StageDef, didNotAnswer, withQuestion, heldOnceIfLost} from './onboarding-staged.ts';
import { withScriptedBeat } from './rewire.ts'; // "model reflects, engine carries the turn forward — never both, never a dead-end"
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';
import { identityLabel } from '../member/identity.ts';
import { WHY_ITEMS, WHY_PROMPTS, WHY_SCALE_MAX, WHY_ITEM_COUNT, WHY_DOMAIN_SPLIT } from '../rebuild/why-instrument.ts';
import {
  SKILL_ITEMS,
  SKILLS_ITEM_COUNT,
  SKILLS_DOMAIN_SPLIT,
  SKILLS_SCALE_MAX,
  SKILLS_SCALE_ANCHORS,
  SKILLS_SCALE_REPROMPT,
  SKILLS_AGREEMENT,
  scoreSkills,
  skillHighlights,
  skillLabel,
} from '../rebuild/skills-instrument.ts';
import { grintaStem, CHECKPOINT_CONTROL_ITEMS } from '../grinta/survey/instrument.ts';
import { confirmsProposal } from './onboarding-intent.ts';
import { proposalSignature, shouldPropose, markProposed, confirmOutranksRerecord, markRevisionAsked, type CoachGate } from './coach-gate.ts';
import { SESSION_LIMITS } from './session-limits.ts';

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
  // Greg's framing prompt leads each domain — restored 2026-08-30, exactly as it stood before the 7/27 walk batch.
  if (index === 0) return `${WHY_PROMPTS.activity}\n\n${item.stem}`;
  if (index === WHY_DOMAIN_SPLIT) return `${B1_DIET_TURN}\n\n${WHY_PROMPTS.diet}\n\n${item.stem}`;
  return item.stem;
}
function whyOpener(): string {
  return `${B1_OPEN}\n\n${whyDeliver(0)}`;
}

/**
 * B1's OPENING BEAT — Greg's Stage 1, which his spec has specified since it was written.
 *
 * B1.md:257 declares a five-stage sequence — engagement → activity elicitation → eating elicitation → didactic
 * informing → consolidation — and B1.md:264 spells the first one out: "Stage 1: Engagement — Present opening
 * frame / Acknowledge the shift from [Rewire] to [Rebuild] / Set the stance: honest self-assessment, not a
 * performance" (his camel-case house style normalised). We shipped stage 2 onward, so the Session opened on item
 * 1 of a twelve-item instrument.
 *
 * This is the engagement beat only; the elicitation and didactic stages are still to come. It is worth landing on
 * its own because the shift it names is real: a member arrives here straight out of Rewire's self-talk work.
 *
 * THE QUESTION DELIBERATELY ISN'T "why do you want to be active" — that framing prompt sat on item 0 and Donna
 * had it cut, and the twelve items ask exactly that anyway. It asks for the Rewire→Rebuild bridge instead: the
 * story they caught themselves telling. That is context the instrument cannot produce, and it is what Greg means
 * by acknowledging the shift rather than announcing it.
 */
const B1_ENGAGE_FRAME =
  'Rewire was your head — the lies, the picture, the protocol. Rebuild is your body: how you move, how you eat, ' +
  'how you sleep.' + BEAT_SEP +
  'What comes next is a read on where your motivation actually sits today. Answer it the way things are, rather ' +
  'than the way they ought to be — a starting mark is only worth having if it is honest.';
const B1_ENGAGE_Q =
  'First, though: coming out of Rewire, what is the story you catch yourself telling about your body?';

const b1Engage = {
  id: 'why-open',
  next: 'why-activity-talk',
  frame: () => B1_ENGAGE_FRAME,
  question: () => B1_ENGAGE_Q,
  handIn: () => whyOpener(),
};

// ── GREG'S FIVE STAGES (B1.md:257) ────────────────────────────────────────────────────────────────────────────
//
//   engagement → activity elicitation → eating elicitation → didactic informing → consolidation
//
// The twelve items are NOT a sixth stage. They run INSIDE the two elicitation beats — the six activity items with
// the activity talk, the six eating items with the eating talk — which is why Greg's list names elicitation and
// never names the instrument. He is describing one motion: say it in your own words, then rate the statements.
//
// So the instrument is SPLIT across two administered stages using the itemCount/displayTotal contract already
// built for C2: `itemCount` is CUMULATIVE (6, then 12) because it is compared against the shared response bag,
// while `displayTotal` keeps the member-facing count at "of 12" in both halves.
//
// WHERE GREG'S FOUR PERMITTED DIDACTIC POINTS LAND. He authorises four (B1-12..15) and gives sample phrasing for
// each. Delivering all four in one block would be the lecture this Session must not become, so two go to the
// didactic stage and two go to the seam each one is actually about:
//
//   B1-12  quality vs amount of motivation  → stage 4, first point
//   B1-13  the motivational shift principle → stage 4, second point (Greg singles this one out as must-be-available)
//   B1-15  dual-domain (activity ≠ eating)  → the eating elicitation's opening line, where the member is crossing
//                                             exactly that boundary and the point explains what just happened
//   B1-14  process-product (CFW)            → consolidation, which is where "why we started here" belongs
//
// All four are authored in his words. None is left as "available to the model", which is how a permitted point
// becomes an unreachable one. [[no-unreachable-rules]]

const B1_ACTIVITY_PROBES = [
  'What makes you want to move — not the reason you would give someone else, the one that is actually yours?',
  'Is there a version of that which is about how it feels rather than what it produces?',
  'Anything in there you would be embarrassed to say out loud? That one usually matters.',
];
const B1_EATING_PROBES = [
  'And eating — what is driving that one for you?',
  'Does that reason feel like yours, or like one you inherited?',
];

// B1-15, VERBATIM SENSE: "activity and eating are related but distinct, and motivation may differ across them."
// Placed at the crossing rather than in the teaching block — a point about a boundary lands as the member steps
// over it, and as a line in a lecture it is abstract.
const B1_DUAL_DOMAIN =
  "It's common to have different reasons for eating than for moving. They're connected, but they pull on " +
  'different things for different people. We look at both because they each matter.';

// The hand-in to the eating half. It DELEGATES the item itself to whyDeliver rather than composing a second copy:
// it used to build `B1_DIET_TURN + stem` on its own, which is the same thing whyDeliver already does for this
// index — and when Greg's domain prompt was restored to whyDeliver on 2026-08-30, the activity half got it (its
// opener delegates) and the eating half silently did not. One fact, two sites, and only one of them fixed.
function b1EatingHandIn(): string {
  return `${B1_DUAL_DOMAIN}${BEAT_SEP}${whyDeliver(WHY_DOMAIN_SPLIT)}`;
}

const whyActivityStage: StageDef = administeredStage({
  id: 'why-activity',
  itemCount: WHY_DOMAIN_SPLIT, // 6 — the activity half
  displayTotal: WHY_ITEM_COUNT, // ...but the member is answering "of 12" throughout
  scaleMax: WHY_SCALE_MAX, // 7 — the SDT scale (parameterized; every Grinta/IDQ caller stays 1–5)
  minLabel: 'not at all true', // W-24: chip anchors — match the re-prompt copy
  maxLabel: 'very true',
  opener: () => whyOpener(),
  deliverItem: (n) => whyDeliver(n),
  reprompt: (n) => `A number from 1 to 7 — 1 is “not at all true for you,” 7 is “very true for you.”\n\n${whyDeliver(n)}`,
  onComplete: (b) => {
    // The activity half is in. Back to conversation for the eating domain before its six items.
    b.stage = 'why-eating-talk';
    b.reply = B1_EATING_PROBES[0]!;
  },
});

const whyEatingStage: StageDef = administeredStage({
  id: 'why-eating',
  itemCount: WHY_ITEM_COUNT, // 12 — CUMULATIVE against the shared bag, not "six more"
  displayTotal: WHY_ITEM_COUNT,
  scaleMax: WHY_SCALE_MAX,
  minLabel: 'not at all true',
  maxLabel: 'very true',
  opener: () => b1EatingHandIn(),
  deliverItem: (n) => whyDeliver(n),
  reprompt: (n) => `A number from 1 to 7 — 1 is “not at all true for you,” 7 is “very true for you.”\n\n${whyDeliver(n)}`,
  onComplete: (b) => {
    // All 12 are in (activity 0–5, diet 6–11). The ACTION scores the SDT profile + stores it (RB-1); the
    // conversation goes on to the teaching beat rather than closing here.
    b.stage = 'why-teach';
    b.reply = B1_TEACH_OPEN;
  },
});

// Greg's sample phrasing, close to verbatim, each handing the floor straight back. The `then` line is the rail:
// a didactic point that does not end by returning the turn is a lecture with a question mark.
const B1_TEACH_OPEN =
  "That's the twelve. Before we close it out — one thing worth knowing about what you just rated, if you want it.";
const B1_POINTS = [
  {
    id: 'quality-vs-amount',
    // THREE SENTENCES, because Greg's delivery rule is "one to three sentences and then return to a question"
    // (B1-12's testable-as). The first draft was four and the test caught it — the rule is only a rail if the
    // authored copy is held to it too, not just the model.
    text:
      "Motivation isn't just about how much you have — it also has a quality to it. Some reasons feel like " +
      "they're truly yours, and some feel like they come from outside. Both are real, and the ones that feel " +
      'more your own tend to hold up better over time.',
    then: 'Reading back what you told me, which of your reasons feels most like yours?',
  },
  {
    id: 'shift-principle',
    text:
      'Wherever you are right now is a starting point. A lot of people find their motivation shifts as they get ' +
      "into the behaviors — not because they're made to, but because they start feeling the benefits.",
    then: 'Has that happened to you before with something else?',
  },
];

// B1-14, at consolidation — "why we started here" is a closing thought, not an opening one.
const B1_PROCESS_PRODUCT =
  'In this program we treat moving and eating as the process, and fitness, health and wellness as what that ' +
  'process produces. Your motivation is what connects the two. That is why we started here.';
const B1_CONSOLIDATE_ASK =
  'Last thing: of everything you have said, which reason would you want to still be true a year from now?';

// ONE TURN. Consolidation reflects and closes; it does not interrogate. The model's receipt of their answer
// carries the personalisation, then the authored close lands — process-product (B1-14), then the baseline framing.
const b1Consolidate = (b: { stage: string; complete: boolean; reply: string; modelText?: string }): void => {
  b.stage = 'complete';
  b.complete = true;
  b.reply = receiveThen(b.modelText, `${B1_PROCESS_PRODUCT}${BEAT_SEP}${B1_CLOSE}`);
};
const whyCloseStage: StageDef = {
  id: 'why-close',
  mode: 'drawout',
  opener: () => B1_CONSOLIDATE_ASK,
  offersSubstance: () => true,
  gather: b1Consolidate,
  confirm: b1Consolidate,
};

export const REBUILD_B1_ARC: ArcConfig = {
  id: 'rebuild-b1',
  stageOrder: ['why-open', 'why-activity-talk', 'why-activity', 'why-eating-talk', 'why-eating', 'why-teach', 'why-close'],
  stages: {
    'why-open': engagementStage(b1Engage),
    'why-activity-talk': elicitationStage({
      id: 'why-activity-talk',
      next: 'why-activity',
      probes: B1_ACTIVITY_PROBES,
      floor: 2,
      handIn: () => whyOpener(),
    }),
    'why-activity': whyActivityStage,
    'why-eating-talk': elicitationStage({
      id: 'why-eating-talk',
      next: 'why-eating',
      probes: B1_EATING_PROBES,
      floor: 1, // shorter than the activity beat on purpose — the ground is laid, and this is the second pass
      handIn: () => b1EatingHandIn(),
    }),
    'why-eating': whyEatingStage,
    'why-teach': didacticStage({
      id: 'why-teach',
      next: 'why-close',
      points: B1_POINTS,
      maxShared: 2,
      handOff: () => B1_CONSOLIDATE_ASK,
    }),
    'why-close': whyCloseStage,
  },
  onComplete: () => B1_CLOSE,
};

// ── B1'S LIVE PROMPT ──────────────────────────────────────────────────────────────────────────────────────────
//
// GOVERNANCE IS IN THE CODE, NOT HERE. The steering below shapes voice and rhythm; what the Companion may not do
// is enforced by the stage machine — the model cannot deliver a didactic point (those are authored constants), it
// cannot advance a stage, and it never sees an administered turn at all. [[founder-console-companion]]
const B1_SYSTEM = `${MEMBER_AGENT_GOVERNED_CORE}

YOU ARE RUNNING B1 — "What is Your Why?", the first Session of Rebuild.

WHAT THIS SESSION IS. The member has just come out of Rewire, which was mental — the lies they tell themselves,
the picture they built, the protocol they wrote. Rebuild is the body. B1 asks what actually drives them to move
and to eat well, and pairs their own words with a twelve-item measure of motivation quality.

YOUR JOB IS TO ELICIT, NOT TO EXPLAIN. Reflect what they said, in their words, and ask ONE question. Their reasons
are the material; you are not here to improve them, rank them, or push them toward better-sounding ones.

NEVER GRADE A REASON. "I want to look better in photos" and "I want to be there for my kids" are both real
motivations, and a member who senses the second scores higher will start performing the second. Take what they
give you at face value.

DO NOT TEACH. Everything this Session teaches is written and delivered by the engine at the right moment. If you
find yourself explaining intrinsic versus extrinsic motivation, stop and ask a question instead — the teaching
beat is coming and you will step on it.

DO NOT ANNOUNCE WHAT IS NEXT, and never say a number of questions is coming. The engine hands into the items.

ONE QUESTION PER TURN. Two or three sentences. Plain, level, unhurried.`;

function b1Context(c: Collected): string {
  const who = identityLabel(c.identityNoun);
  const parts = [
    who ? `WHO THEY ARE RECLAIMING: ${who}. Do NOT address them by it.` : '',
    c.gap ? `THE GAP, IN THEIR WORDS: "${c.gap}"` : '',
    c.reclaimList?.length ? `THEIR RECLAIM LIST: ${c.reclaimList.join(' · ')}` : '',
  ].filter(Boolean);
  return parts.length ? `\n\nWHAT YOU ALREADY KNOW ABOUT THEM:\n${parts.join('\n')}` : '';
}

function b1StageNote(state: ConvState): string {
  switch (String(state.stage ?? '')) {
    case 'why-open':
      return '\n\nWHERE YOU ARE: the opening. They are telling you the story they catch themselves telling about ' +
        'their body. Receive it — do not fix it, and do not reassure. One short acknowledgment is enough.';
    case 'why-activity-talk':
      return '\n\nWHERE YOU ARE: drawing out why they want to MOVE, before any rating. Get past the first, most ' +
        'presentable answer to one that sounds like them. Reflect, then ask one question.';
    case 'why-eating-talk':
      return '\n\nWHERE YOU ARE: the same, for EATING. It is normal for this to differ from movement — if it ' +
        'does, that is worth noticing out loud, briefly.';
    case 'why-teach':
      return '\n\nWHERE YOU ARE: the engine has just delivered a short teaching point and asked them something. ' +
        'Respond to their answer only. Do NOT add to the teaching or restate it.';
    case 'why-close':
      return '\n\nWHERE YOU ARE: the close. They have named the reason they want still to be true in a year. ' +
        'Reflect it back in their own words, warmly and briefly. The engine says what happens next — you do not.';
    default:
      return '';
  }
}

// `model` is now a PARAMETER rather than a hardcoded `{ text: '' }`. B1 was fully administered until Greg's five
// stages landed (2026-08-28); three of them are conversational, and a stage that needs the model cannot be handed
// a permanently empty turn. Defaulted so every existing administered-only caller and fixture is unchanged.
export function applyRebuildB1Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(REBUILD_B1_ARC, state, history, memberMessage, model);
}

export function rebuildB1Opening(): Turn {
  // Opens on Greg's Stage 1; the 1–7 chips belong to the instrument, two stages later.
  return { reply: engagementOpening(b1Engage), state: { stage: 'why-open', collected: {} }, complete: false };
}

/** Which stages of B1 need a live model — the conversational three. The rest are deterministic and must stay so. */
const B1_TALKING_STAGES = new Set(['why-open', 'why-activity-talk', 'why-eating-talk', 'why-teach', 'why-close']);

export async function liveTurnRebuildB1(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  carryForward?: string | null,
): Promise<Turn> {
  // THE INSTRUMENT NEVER CALLS THE MODEL. The administered halves parse a number deterministically, and paying a
  // model round-trip to do that would be both slower and a way for generated text to appear beside a validated
  // item. Only the conversational stages get a live turn. [[capture-model-opus]] does not apply here — these are
  // reflections, not captures.
  if (!B1_TALKING_STAGES.has(String(state.stage ?? ''))) {
    return applyRebuildB1Turn(state, history, memberMessage);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    // Cached prefix / volatile suffix — same contract as W1 and B3: the governed core plus B1's own instructions
    // are byte-identical every turn and carry the breakpoint; member context and the stage note come after.
    system: [
      { type: 'text' as const, text: B1_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: b1Context(state.collected) + b1StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyRebuildB1Turn(state, history, memberMessage, { text });
}

// ══ B2 · Appreciating Your Strengths and Weaknesses ═══════════════════════════════════════════════════════════
// The Structure asset: an ADMINISTERED 24-item self-management assessment (12 skills × activity/diet, 4-point scale),
// then Part B — a week of NOTICING which skills help/hinder (rides the practice-week scaffold; not behavior change).
// The profile is stored (self_management_reading) and reflected back in plain language at the close (strongest skill
// + growth edge — never a table of numbers). COPY: directional placeholder (Cowork wordsmiths), built from Greg's
// member-shown intro. The action scores + stores the reading and opens the noticing week on completion.
// B2's SET-UP, restored from Greg's own "Introduction (Shown to Member)".
//
// DONNA, 2026-08-23: the Rebuild Sessions "don't feel as developed as Reconnect and Rewire... don't have any
// set-up. Especially Strengths and Weaknesses — the content is good, it just needs more context."
//
// She is describing a placeholder. The comment on this constant said so itself — "COPY: directional placeholder
// (Cowork wordsmiths), built from Greg's member-shown intro" — and it never got wordsmithed. What survived was two
// sentences; what he wrote carries four things they dropped, each of which is the reason a member would answer
// honestly rather than tidily:
//
//   1. WHAT these skills are, and why they matter — "these are the skills that will get you were you want to go".
//   2. That a skill is PRACTISED, not owned — "as with learning any skill, you need to practice it to improve it".
//      Without it, twenty-four items rating your own capability read as a verdict on the person.
//   3. The SCOPE — twelve skills, rated twice. Nobody consented to a 24-item form they could not see the end of.
//   4. What happens NEXT — "you will evaluate your use of these skills... The focus is not on monitoring your
//      behaviors but rather to notice the self-management skills that help or hinder your efforts." That framing
//      only existed in the close, which is a strange place to learn what you agreed to.
//
// HIS CONTENT, OUR VOICE. Not pasted: his prose is a research introduction ("Thus, the next step is to take
// stock...") and the Companion does not talk like that. Same call as W3_STAGE3, where his three expectations were
// "his phrasing tightened to fit one beat".
//
// BEAT_SEP, NOT \n\n. B3 opens on three paced bubbles and B2 opened on one dense block, which is a second reason
// it read as thinner than its neighbours. The frame arrives at the speed a person reads it.
const B2_OPEN =
  // DOES NOT RE-ARGUE THE CARD. "Why this matters" sits directly above this and already makes the case that the
  // practical skills are what create change. Opening by saying it again is the same fault as the Reclaim recap
  // reading her list twice — two surfaces, one point, and the second one reads as the product not knowing what it
  // already said. This bridges from the card into the act instead.
  "So before you change anything: which of those skills are already yours, and which are thin?" + BEAT_SEP +
  "They aren't fixed. A skill is something you practice and get better at, so where you stand today is a starting " +
  "mark rather than a verdict on you." + BEAT_SEP +
  `There are twelve of them. You'll rate each one twice — once for movement, once for eating — from ${SKILLS_SCALE_ANCHORS}. ` +
  "Answer honestly rather than well; none of it is graded." + BEAT_SEP +
  // NOT "which ones carry you" — b2Close already says "when a strong skill carries you", and carry/carrying is one
  // of the four words Donna flagged as reading like AI (2026-08-22). One use in a Session is voice; the same word
  // opening and closing it is the density she reported.
  "Then this week you'll watch them turn up in your actual life. Not changing anything yet — just noticing which " +
  "ones help and which ones get in your way.";
const B2_DIET_TURN = "That's movement. Same skills now, for eating.";
// HAND THEM TO THE WEEK THIS CLOSE JUST OPENED. It used to end "you can find it at the top of your Dashboard",
// which was true until 2026-08-08, when the practice week moved to the Playbook's This week tab — so the close
// went on pointing at a place the thing is not. A member who follows the instruction and finds nothing concludes
// the tool is broken, and they are not wrong.
function b2Close(strongest: string, growthEdge: string): string {
  return (
    `Right now it looks like ${strongest.toLowerCase()} is a strength of yours. The skill with the most room to grow ` +
    `is ${growthEdge.toLowerCase()}. Neither is fixed; a skill is just something you practice and improve. This week ` +
    `you don't have to change anything — just notice these showing up: when a strong skill carries you, and when a ` +
    `weaker one trips you. That's the work. Just notice. Open This week in your Playbook each day and tick the ` +
    `days you catch one.`
  );
}

// Deliver the framed item: the activity intro on item 0, the diet-pass frame on item 12, the skill-labelled stem
// otherwise (the skill name orients the member; the statement IS the ask — administered, no draw-out).
function skillsDeliver(index: number): string {
  const item = SKILL_ITEMS[index]!;
  // THE HEADER IS THE MEMBER'S WORD FOR THE SKILL, not Greg's construct name (Jay, 2026-08-23). She rated
  // "Consumer skills" here and her Playbook map later called the same thing "Finding good information"; nothing
  // told her they were one skill. The STEM is untouched verbatim science and the scoring is unaffected — only the
  // label above it changes. Greg's construct name stays on the item, in the codes, and in every stored score.
  const line = `${skillLabel(item.skillNo, item.skill)}: ${item.stem}`;
  if (index === 0) return `Movement first.\n\n${line}`;
  if (index === SKILLS_DOMAIN_SPLIT) return `${B2_DIET_TURN}\n\n${line}`;
  return line;
}
function skillsOpener(): string {
  // BEAT_SEP: the frame and the first item are separate bubbles. (The old join also said "Let's start with
  // Movement." one line above skillsDeliver's "Movement first." — the member was told twice.)
  return `${B2_OPEN}${BEAT_SEP}${skillsDeliver(0)}`;
}

/**
 * B2's OPENING BEAT — Greg's Stage 1, per B2.md:448: "Stage 1 Engagement: present opening frame, acknowledge that
 * self-assessment requires honesty, set the stance as development map not verdict."
 *
 * Jay walked this one and said it plainly: "This Session can't just start with an assessment." Twenty-four items
 * of self-rating is the longest grind in Rebuild, and it began with item 1.
 *
 * The question asks for a skill they have ALREADY used — which is the same construct the instrument measures,
 * approached from the side the member can actually see. It also gives the close something true to work with: a
 * member who has just described making something stick reads "this is a strength of yours" as a description
 * rather than a compliment.
 */
const B2_ENGAGE_FRAME =
  'These are the practical skills — the ones that decide whether a good intention survives a bad week.' + BEAT_SEP +
  'Rating yourself on them only works if you are straight about it. What comes out is a map of what to build ' +
  'next, and a map drawn generously takes you somewhere you are not.';
const B2_ENGAGE_Q = 'Before that: think of something you made stick once. What did you actually do to hold it?';

const b2Engage = {
  id: 'skills-open',
  next: 'skills',
  frame: () => B2_ENGAGE_FRAME,
  question: () => B2_ENGAGE_Q,
  handIn: () => skillsOpener(),
};

const skillsStage: StageDef = administeredStage({
  id: 'skills',
  itemCount: SKILLS_ITEM_COUNT, // 24
  scaleMax: SKILLS_SCALE_MAX, // 4 (strongly disagree → strongly agree)
  ...SKILLS_AGREEMENT, // W-24: chip anchors — the same words as the opener prose, by construction
  opener: () => skillsOpener(),
  deliverItem: (n) => skillsDeliver(n),
  reprompt: (n) => `A number from ${SKILLS_SCALE_REPROMPT}.\n\n${skillsDeliver(n)}`,
  onComplete: (b) => {
    // All 24 responses are in b.administeredResponses (activity 0–11, diet 12–23). The SCORING now happens at
    // consolidation, not here: Greg's evocation stage comes between, and reading a member their profile before
    // asking what they noticed would answer the question the evocation exists to ask. The ACTION still stores the
    // full profile + opens the noticing week off the completing turn.
    b.stage = 'skills-evoke';
    b.reply = B2_EVOKE_PROBES[0]!;
  },
});

// ── GREG'S FIVE STAGES FOR B2 (B2.md:441) ─────────────────────────────────────────────────────────────────────
//
//   engagement → assessment support → evocation → didactic informing → consolidation
//
// DIFFERENT SHAPE FROM B1'S, on purpose. B1 elicits BEFORE each half of its instrument, because the thing being
// measured (why you move) is something a member can say in their own words cold. B2 measures twelve skills a
// member has no vocabulary for until they have been walked through them — so Greg puts the whole assessment
// second ("assessment support") and the drawing-out AFTER it ("evocation"), where the member now has language.
// Reading a member's skills back to them before they had rated anything would be us supplying the answer.
//
// GREG GRANTS B2 ITS OWN DIDACTIC LATITUDE (B2.md:294, "didactic_latitude = true (B2-specific)"). Worth recording
// because B1.md:85 says latitude is "true for B1 and W1 only among the gated assets specified so far" — that was
// written before B2 was specified, and the per-asset doc governs its own asset. [[greg-doc-precedence-and-levels]]
const B2_EVOKE_PROBES = [
  'Looking at how you answered — which of those felt truest about you?',
  'And was there one you wanted to rate higher than you honestly could?',
];

// Greg's four permitted points (B2.md:371), in his approved phrasing (B2-56, B2-57, B2-58, B2-60). Two are
// delivered; the ledger and maxShared keep it from becoming a lecture, exactly as in B1.
// NO OFFER — SERVE IT (Donna, 2026-08-30). This ended "…if you want them", and she answered "nah" once just to see
// what happened. Her diagnosis: it "leaves things hanging for the member to keep it moving forward", and "the
// information that comes after that isn't much of a payoff. Just serve it up."
//
// She is right on both counts, and the second is the sharper one — an offer implies the thing offered is optional
// extra, which sets a bar these two points do not need to clear. They are short, they are Greg's, and they land
// better as something said than as something granted.
//
// v3.5.79 added a prompt rule telling the Companion never to say "if you want them". This string is AUTHORED, so
// the rule never reached it: we gated the model against a sentence we hardcode. Same shape as "no right or wrong
// answers" in the Reconnect opener, in the same release. [[one-fact-many-sites]]
const B2_TEACH_OPEN = "That's the twenty-four. Two things worth knowing about what you just rated.";
const B2_POINTS = [
  {
    id: 'skills-not-traits',
    // B2-56, verbatim.
    text: "One thing that's useful to know: these aren't personality traits. They're skills. And skills can be developed.",
    then: 'Does any of them feel more learnable than it did ten minutes ago?',
  },
  {
    id: 'weakness-is-information',
    // B2-58, verbatim. Paired deliberately with the point above — a member who has just rated themselves low on
    // six things needs this one, and it is the half of the pair that does the protective work.
    text: "A weakness here isn't a flaw. It's just information about where you might want to focus your effort.",
    then: 'Which one would you actually want to put effort into first?',
  },
];

// B2-57's three-factor framework, at consolidation — it explains the MAP she is about to be shown, so it belongs
// beside the map rather than in the middle of the teaching beat.
const B2_THREE_FACTOR =
  'In this framework we group the skills into three categories — Predisposing, Enabling and Reinforcing — ' +
  'because different skills tend to matter at different points in the change process.';
const B2_CONSOLIDATE_ASK = 'Before we close: which skill would you want to be better at by the end of Rebuild?';

// B2-60 — the CFW bridge, delivered at the close where it hands into B3 (Greg's fourth permitted point is "the
// connection to B3", and this is that connection stated as the principle rather than as a signpost).
const B2_BRIDGE =
  'Self-management is the bridge between wanting something and doing it — which is exactly what the pilot in ' +
  'your next Session is for.';

const b2ConsolidateStage: StageDef = {
  id: 'skills-close',
  mode: 'drawout',
  opener: () => B2_CONSOLIDATE_ASK,
  offersSubstance: () => true,
  gather: (b) => {
    // ONE HOLD IF SHE DID NOT ANSWER — and exactly one.
    //
    // This closed unconditionally, so a member who said "I don't understand what you mean" at the last beat had
    // her question answered by the Session ending. The session eval caught it (B2, turn 37, skills-close →
    // complete), and it is the shape Donna described at the False Start Protocol: "It answers my question then
    // moves on without allowing me to close out. I feel left hanging."
    //
    // BOUNDED AT ONE, DELIBERATELY. A close whose exit depends on the member answering correctly is a trap, and
    // the eval's probe fires on a cadence — an unbounded hold would have kept a finished Session open forever.
    // So: her question is answered, the ask is re-posed once, and the next turn closes whatever she says.
    if (heldOnceIfLost(b, B2_CONSOLIDATE_ASK)) return;
    // One turn: receive their answer, then the authored close — the profile reflection, the framework that names
    // its three groups, and the bridge into B3.
    const responses = b.administeredResponses.slice(0, SKILLS_ITEM_COUNT);
    const { strongest, growthEdge } = skillHighlights(scoreSkills(responses));
    b.stage = 'complete';
    b.complete = true;
    b.reply = receiveThen(b.modelText, `${B2_THREE_FACTOR}${BEAT_SEP}${b2Close(strongest, growthEdge)}${BEAT_SEP}${B2_BRIDGE}`);
  },
  confirm: (b) => b2ConsolidateStage.gather(b),
};

export const REBUILD_B2_ARC: ArcConfig = {
  id: 'rebuild-b2',
  stageOrder: ['skills-open', 'skills', 'skills-evoke', 'skills-teach', 'skills-close'],
  stages: {
    'skills-open': engagementStage(b2Engage),
    skills: skillsStage,
    'skills-evoke': elicitationStage({
      id: 'skills-evoke',
      next: 'skills-teach',
      probes: B2_EVOKE_PROBES,
      floor: 2,
      handIn: () => B2_TEACH_OPEN,
    }),
    'skills-teach': didacticStage({
      id: 'skills-teach',
      next: 'skills-close',
      points: B2_POINTS,
      maxShared: 2,
      handOff: () => B2_CONSOLIDATE_ASK,
    }),
    'skills-close': b2ConsolidateStage,
  },
  onComplete: () => B2_OPEN,
};

export function applyRebuildB2Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn = { text: '' }): Turn {
  return runArcTurn(REBUILD_B2_ARC, state, history, memberMessage, model);
}

export function rebuildB2Opening(): Turn {
  // Opens on Greg's Stage 1; the 1–4 chips belong to the instrument, one turn later.
  return { reply: engagementOpening(b2Engage), state: { stage: 'skills-open', collected: {} }, complete: false };
}

// ── B2'S LIVE PROMPT ──────────────────────────────────────────────────────────────────────────────────────────
//
// THE FORBIDDEN FORMULATIONS ARE GREG'S, VERBATIM (B2-59). All three are the same move — turning a self-rating
// into a verdict about the person — which is the exact failure this Session is most exposed to, because a member
// has just rated themselves low on several things and is waiting to be told what it means about them.
const B2_SYSTEM = `${MEMBER_AGENT_GOVERNED_CORE}

YOU ARE RUNNING B2 — "Appreciating Your Strengths and Weaknesses", the second Session of Rebuild.

WHAT JUST HAPPENED. The member rated themselves on twelve self-management skills, twice over — once for movement,
once for eating. Twenty-four judgments about themselves, in a row. Some of them will have been uncomfortable.

YOUR JOB IS TO DRAW OUT WHAT THEY NOTICED, not to interpret their answers. They have the language for these
skills now, which they did not have twenty minutes ago; that is what makes this the moment to ask.

NEVER SAY, OR SAY ANYTHING SHAPED LIKE:
  · "You need to improve your Reinforcing skills."
  · "Your Predisposing scores are low, so you're not ready to change."
  · "Self-management is what separates people who succeed from those who don't."
The first prescribes, the second diagnoses readiness, the third makes a skill rating into a claim about their
character. A weakness here is information about where to put effort. Nothing more.

DO NOT NAME A SCORE, A PERCENTAGE, OR A CATEGORY TOTAL. The engine reflects the profile in plain language at the
close. If they ask how they did, tell them what they said, not what it computed.

DO NOT TEACH. The teaching points are written and delivered by the engine at the right moment.

ONE QUESTION PER TURN. Two or three sentences.`;

function b2StageNote(state: ConvState): string {
  switch (String(state.stage ?? '')) {
    case 'skills-open':
      return '\n\nWHERE YOU ARE: the opening. They have just described something they once made stick. Receive ' +
        'it — that is a skill they already own, and naming it as one is enough.';
    case 'skills-evoke':
      return '\n\nWHERE YOU ARE: drawing out what they noticed while rating themselves. Ask about their ' +
        'EXPERIENCE of answering, not about what the answers mean. Do not interpret, rank, or total anything.';
    case 'skills-teach':
      return '\n\nWHERE YOU ARE: the engine has just delivered a short teaching point and asked them something. ' +
        'Respond to their answer only. Do NOT add to the teaching or restate it.';
    case 'skills-close':
      return '\n\nWHERE YOU ARE: the close. They have named the skill they want to be better at. Reflect it ' +
        'back in their words, briefly. The engine says what the profile shows and what comes next — you do not.';
    default:
      return '';
  }
}

/** Which stages of B2 need a live model — the conversational ones. The 24 items stay deterministic. */
const B2_TALKING_STAGES = new Set(['skills-open', 'skills-evoke', 'skills-teach', 'skills-close']);

export async function liveTurnRebuildB2(
  state: ConvState,
  history: ConvMessage[],
  memberMessage: string,
  carryForward?: string | null,
): Promise<Turn> {
  // Same wall as B1: the instrument never calls the model.
  if (!B2_TALKING_STAGES.has(String(state.stage ?? ''))) {
    return applyRebuildB2Turn(state, history, memberMessage);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    system: [
      { type: 'text' as const, text: B2_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: b1Context(state.collected) + b2StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyRebuildB2Turn(state, history, memberMessage, { text });
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
// FROM GREG'S "Companion AI setup script" (B3), which existed verbatim and had never been used. Two lines of his
// were doing work ours wasn't:
//   "realistic enough to practice on a normal week, not just on your best week" — the sentence that stops a member
//   designing for the version of themselves who is well rested and free on Thursday, and
//   "We're not looking for a full overhaul... two small changes that will help you notice how healthier decisions
//   actually happen in your life" — which says what the week is FOR. Ours said what to do and never why.
const B3_OPEN_2 =
  "You'll pick one small movement change and one small healthier eating change to try for a week. Two things you're " +
  "not already doing — and realistic on a normal week, not just on your best one.";
const B3_OPEN_3 =
  "This isn't an overhaul. Two small changes are enough to show you how healthier decisions actually happen in your " +
  "life.";
const B3_OPEN_4 = "We'll start with movement — what's one small change you could try this week?";
function b3Opening(): string {
  return `${B3_OPEN_1}${BEAT_SEP}${B3_OPEN_2}${BEAT_SEP}${B3_OPEN_3}${BEAT_SEP}${B3_OPEN_4}`;
}

const B3_PLAN_CONFIRMED_1 =
  "Your Lifestyle Pilot is locked in. You've committed to one small change in movement, one in eating, for next week.";
// THIS USED TO PROMISE "I'll check in on you every day." We don't. The daily nudge needs a browser push opt-in most
// members never give, holds a 72-hour cooldown, and deliberately skips anyone active in the last 24 hours — so for
// someone actually working the program it can never arrive. Greg finished B3 and waited for it (2026-08-06). A
// member who is told to expect contact and gets none reads it as being dropped, and we did that to them.
// So: tell them what to do, where, and when — the shape W3's close already uses — and promise nothing we don't send.
const B3_PLAN_CONFIRMED_2 =
  "Start tomorrow. Open This week in your Playbook each day and log how it went — a good call, a false " +
  "start, or on track. It's a good time to talk with other Community members too. After a week of it, the Rebuild " +
  "Checkpoint is where this Phase closes.";
// Said when the plan is locked and UNCHANGED since we showed it — see coach-gate.ts. Nothing new to put on
// screen, so say that plainly instead of reprinting the plan.
const PILOT_HOLD_NUDGE = "That's your week as it stands. Change either one, or tell me to lock it in.";

// The engine-owned plan reflection (propose-confirm) — reflects BOTH changes back in the member's words, then the
// confirm gate. Not the model's text: the plan is shown consistently, from what was locked.
function proposePlan(activity: string, diet: string, activityDays?: number, dietDays?: number): string {
  // The target reads as the member's own aim, appended only when they gave one — never a default we supplied.
  const aim = (n?: number) => (n ? ` — ${n} ${n === 1 ? 'day' : 'days'}` : '');
  return (
    `Here's your week, then — small and yours:\n\nMovement: ${activity}${aim(activityDays)}\nEating: ${diet}${aim(dietDays)}\n\n` +
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
// The commit gate now uses the SHARED confirm vocabulary (confirmsProposal). This regex was local, and was forked
// into Reclaim twice; each copy drifted and each had different holes. Greg's walk (2026-08-06) died on "lock in" —
// the bare form with no object — which this gate missed even though the Companion had just offered "Want to lock
// them in, or tweak one?". He was answered with "tell me what you'd change", and looped. See
// tests/confirm-corpus.test.ts, which asserts one corpus against every gate so the forks can't drift again.
export function pilotConfirms(msg: string): boolean {
  return confirmsProposal(msg);
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
    const sc = b.scratch as CoachGate;
    // Accumulate the model's locked fields (a field appears only once the model judged it specific + right-sized).
    if (b.model.plan?.activityChange) b.collected.pilotActivity = b.model.plan.activityChange.trim();
    if (b.model.plan?.dietChange) b.collected.pilotDiet = b.model.plan.dietChange.trim();
    if (b.model.plan?.activityDays) b.collected.pilotActivityDays = b.model.plan.activityDays;
    if (b.model.plan?.dietDays) b.collected.pilotDietDays = b.model.plan.dietDays;
    if (b.model.plan?.activityBackup) b.collected.pilotActivityBackup = b.model.plan.activityBackup.trim();
    if (b.model.plan?.dietBackup) b.collected.pilotDietBackup = b.model.plan.dietBackup.trim();
    if (b.model.plan?.obstacles) b.collected.pilotObstacles = b.model.plan.obstacles.trim();
    const activity = (b.collected.pilotActivity ?? '').trim();
    const diet = (b.collected.pilotDiet ?? '').trim();
    const activityDays = b.collected.pilotActivityDays;
    const dietDays = b.collected.pilotDietDays;

    // CHANGE FIRST, then the confirm gate — see coach-gate.ts on why this order is load-bearing. A plan the
    // member has already seen is NEVER printed again; only a genuinely different one earns a fresh proposal.
    // CONFIRM FIRST — before the change-check. Greg's live walk (8/7): shown his plan, he said "Lock them in" and the
    // model re-called record_plan on that same turn with a paraphrase of its own capture. The signature moved, the
    // change-check fired, and he was handed the plan again — his original complaint, reintroduced by its own fix.
    // His words outrank a model re-record. A genuine edit isn't a confirm (revision tails fail pilotConfirms), so it
    // still falls through and re-proposes below.
    const sig = proposalSignature({ activity, diet, activityDays, dietDays });
    if (confirmOutranksRerecord(sc, pilotConfirms(b.memberMessage), sig)) {
      b.stage = 'complete';
      b.complete = true;
      b.reply = `${B3_PLAN_CONFIRMED_1}${BEAT_SEP}${B3_PLAN_CONFIRMED_2}`;
      return;
    }

    // The days are IN the signature: without them, a member changing "5 days" to "4" would alter the plan and never
    // see it put back to them — the silent-drop direction the coach gate exists to prevent.
    if (shouldPropose(sc, !!(activity && diet), sig)) {
      markProposed(sc, sig);
      b.reply = proposePlan(activity, diet, activityDays, dietDays);
      return;
    }

    if (sc.proposed) {
      // Awaiting the member's confirm on the whole plan.
      if (pilotConfirms(b.memberMessage)) {
        b.stage = 'complete';
        b.complete = true;
        b.reply = `${B3_PLAN_CONFIRMED_1}${BEAT_SEP}${B3_PLAN_CONFIRMED_2}`;
        return;
      }
      // Not a confirm — a tweak the model hasn't recorded yet, or a question. Let the model carry the turn and
      // KEEP THE GATE OPEN: closing it here is what made Greg say "lock in" to a Companion that had stopped
      // listening for it. Anything he changes re-proposes above; anything he asks gets answered here.
      //
      // If it was an ASK for a change (not merely a question), remember it: their next "that works" is agreeing to
      // a revision they've only heard described, so it must be re-proposed rather than committed behind them.
      markRevisionAsked(sc);
      b.reply = (b.modelText || PILOT_HOLD_NUDGE).trim();
      return;
    }

    // Still coaching — the model's turn IS the reply (its next question / examples). But the moment it LOCKS the first
    // change it tends to end on a terminal "Locked in." with no next question (Jay's walk: "creates a dead end" — the
    // eating change is waiting and the thread just stops). withScriptedBeat carries the turn forward to whichever change
    // is still open UNLESS the model already asked its own question — the same "reflect / ask, never both" discipline as
    // the Rewire beats. Empty model → the scripted nudge stands alone.
    b.reply = withScriptedBeat((b.modelText ?? '').trim(), pilotCoachNudge(activity, diet));
  },

  // CAT-35 — THE WAY OUT. Coach mode had no liveness floor: if the model never locked both plan fields (member
  // stonewalls, or it simply never calls record_plan) the stage never proposed and never completed, so B3 looped
  // forever and blocked B3→B4. Reproduced at 30 turns of "I don't know" still sitting in 'pilot'.
  //
  // Only reachable at the ABSOLUTE ceiling — coaching is legitimately slow and circular, and nobody gets hurried
  // out of thinking. Governed at the exit: we do NOT invent a plan they never agreed to. Whatever they DID land
  // is kept, the rest stays open, and they leave with their place held rather than trapped in a session that
  // cannot end. Normalising, not a scold — a hard week is a hundred reasonable decisions, not a failure to plan.
  forceProgress(b) {
    const activity = (b.collected.pilotActivity ?? '').trim();
    const diet = (b.collected.pilotDiet ?? '').trim();
    b.stage = 'complete';
    b.complete = true;
    b.reply =
      activity || diet
        ? `Let's leave it there for today — you've got ${activity && diet ? 'both pieces' : 'one piece'} down` +
          `${activity ? `: ${activity}` : ''}${activity && diet ? `, and ${diet}` : diet ? `: ${diet}` : ''}. ` +
          `The rest can wait until it's clearer. I'll keep this with me and we can pick it up whenever you want.`
        : `Let's leave this one for now — nothing's lost. ` +
          `Come back to it when something occurs to you; I'll be here and I'll still have the thread.`;
    // Mutate only — the kernel builds the Turn (it owns beatState).
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
export const B3_SYSTEM =
  // GOVERNED (2026-08-27). This prompt was a standalone string, so the Companion ran this Session with none of the
  // shared rules — privacy, never-name-a-real-person, never-infer-gender, the AI-tell word list, the locked
  // vocabulary, identity-is-not-an-address, what-you-are, reflect-and-route, never-narrate-the-machinery. Each was
  // written because it had already reached a real member once, and the costliest is privacy: the block's own
  // header records a member being assured "this is between us" by something with no knowledge of how her data is
  // held. Rewire was governed on 8/26 and verified live — asked the privacy question, it refused the between-us
  // promise, named the Founders and offered to escalate.
  //
  // The AI-disclosure trailer is excluded by MEMBER_AGENT_GOVERNED_CORE, deliberately: it reads "first line of a
  // member's first conversation, verbatim", and dropped here it would re-disclose forty minutes into a Session.
  MEMBER_AGENT_GOVERNED_CORE + '\n\n' +
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
  "drop the exercise and route to support (988 US / local) and a human — always on.\n\n" +
  // GREG'S OWN "Companion tone and stance" FOR REBUILD (Gated Assets V4, B3), which had never reached a prompt.
  //
  // Donna, 2026-08-23: the Rebuild Sessions "don't feel as conversational or warm" as Reconnect and Rewire. Part of
  // that is structural and correct — B1 and B2 are administered instruments and B4 is deterministic, so B3 is the
  // ONLY place a model speaks in this whole phase. Which makes it the only place the phase's warmth can come from,
  // and it was running on the generic stance while Rewire's warmth is hand-written into nine conversational beats.
  //
  // He wrote the answer and we never used it. Carried close to verbatim because it is a STANCE, not prose a member
  // reads — the reason to tighten his wording elsewhere does not apply.
  "TONE AND STANCE (Greg's, for this phase). Be practical, steady, curious, encouraging, non-shaming.\n" +
  "AVOID: all-or-nothing interpretations; moralizing around food; treating a miss as failure; making the member " +
  "feel graded.\n" +
  "REINFORCE: small wins matter; backup versions still count; false starts are information; reset moves are part " +
  "of success; awareness is the skill being built." + SESSION_LIMITS;

const RECORD_PLAN_TOOL = {
  name: 'record_plan',
  description:
    "Lock a plan field once it is specific, right-sized, and the member has affirmed it. Pass activityChange for the " +
    "movement change and/or dietChange for the eating change, each in the member's own words. Once a change is " +
    "locked, ask how many days that week they're aiming for and pass activityDays / dietDays — THEIR number, never " +
    "one you suggest. If they'd rather not put a number on it, leave it out and move on; it is optional.",
  input_schema: {
    type: 'object' as const,
    properties: {
      activityChange: { type: 'string', description: "The member's committed small movement change — specific + trackable." },
      dietChange: { type: 'string', description: "The member's committed small eating change — specific + trackable." },
      activityDays: { type: 'integer', description: "Days this week the member is aiming for on the movement change (1-7). Their number. Omit if they didn't give one." },
      dietDays: { type: 'integer', description: "Days this week the member is aiming for on the eating change (1-7). Their number. Omit if they didn't give one." },
      activityBackup: { type: 'string', description: "The member's smaller fallback for the MOVEMENT change — what they'd do on a bad day instead of nothing. Their words. Omit if they'd rather not name one." },
      dietBackup: { type: 'string', description: "The member's smaller fallback for the EATING change, same rule." },
      obstacles: { type: 'string', description: "What the member expects to get in the way this week, in their own words. Omit if they don't name anything." },
    },
  },
};

// The B3 coaching plan ladders to the Reclaim List (Rebuild commitments serve reclaim outcomes), so the coach must
// KNOW it — same backbone rule as the other arcs (the model should never say it can't see the member's own list).
function b3Context(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const reclaim = (c.reclaimList ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  const lines = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    reclaim.length ? `Their Reclaim List (what they're taking back — you HAVE this; never say you can't see it): ${reclaim.join('; ')}` : '',
  ].filter(Boolean);
  return lines.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${lines.join('\n')}` : '';
}

function b3StageNote(state: ConvState): string {
  const activity = (state.collected?.pilotActivity ?? '').trim();
  const diet = (state.collected?.pilotDiet ?? '').trim();
  const activityDays = state.collected?.pilotActivityDays;
  const dietDays = state.collected?.pilotDietDays;
  // The day target is named HERE, in the per-turn steering, not only in the tool description. A live walk (8/7) had
  // the model ask for the movement target and silently skip the eating one — the instruction existed, but only in a
  // place it wasn't reading at the moment it mattered. Per-turn state belongs in the per-turn note.
  if (!activity)
    return "\n\nRIGHT NOW: coach the MOVEMENT change — one small, specific, trackable thing they're not already doing. When it's real and they've affirmed it, call record_plan(activityChange), and ask in the same breath how many days this week they're aiming for. Then DON'T STOP — briefly acknowledge it and move straight into coaching the EATING change (there are two; never end your turn on just an acknowledgment).";
  if (!diet)
    return `\n\nRIGHT NOW: the movement change is locked${activityDays ? ` at ${activityDays} days` : ''}. Now coach the EATING change — one small upgrade. When it's real and affirmed, call record_plan(dietChange) AND ask how many days they're aiming for, the same way you did for movement. Don't skip the number — but if they'd rather not give one, take that and move on.`;
  if (!dietDays && !activityDays)
    return "\n\nRIGHT NOW: both changes are locked but neither has a day target. In ONE short question, ask how many days a week they're aiming for — theirs to choose, and fine to decline.";
  if (!dietDays || !activityDays)
    return `\n\nRIGHT NOW: both changes are locked. One is still missing its day target — the ${!activityDays ? 'MOVEMENT' : 'EATING'} one. Ask for that number in one short question; theirs to choose, and fine to decline.`;
  // GREG'S STEP THAT WE SKIPPED. His scaffolding #3: "define backup versions, and anticipate likely obstacles —
  // this increases the odds that the plan can survive a normal week instead of only an ideal one." Placed HERE, in
  // the per-turn steering, for the reason the day-target note records: an instruction the model only meets in a
  // tool description is one it skips at the moment it matters (a live walk on 8/7 lost the eating target that way).
  const backups = state.collected?.pilotActivityBackup || state.collected?.pilotDietBackup;
  if (!backups)
    return "\n\nRIGHT NOW: both changes are locked with their day targets. Before you close, ask for the BACKUP — the smaller version of each they'd do on a bad day instead of nothing. One short question covering both. Frame it as what keeps the week alive after a miss, never as doubt they'll manage. Call record_plan(activityBackup / dietBackup). If they'd rather not name one, take that and move on.";
  if (!state.collected?.pilotObstacles)
    return "\n\nRIGHT NOW: the backups are down. Ask ONE short question about what they expect to get in the way this week — theirs to name, no list from you, and fine to decline. Call record_plan(obstacles). Then you're done.";
  return "\n\nRIGHT NOW: the plan is complete — changes, day targets, backups and what might get in the way. Give a brief warm acknowledgment; the app will show the plan to confirm.";
}

// Parse an Anthropic response into a ModelTurn (prose + any record_plan locks). Pure below this line lives in the arc.
// Exported for tests: the 1-7 target guard lives HERE, at the tool boundary, and a unit test over the arc would
// never exercise it.
export function parseB3Model(content: readonly unknown[]): ModelTurn {
  let text = '';
  const plan: { activityChange?: string; dietChange?: string; activityDays?: number; dietDays?: number;
    activityBackup?: string; dietBackup?: string; obstacles?: string } = {};
  // A target outside 1-7 is not a target for a seven-day week — drop it rather than store a number the grid can't
  // draw. Silently ignoring a bad value is right here: the plan itself is still good, and nagging the member about
  // the model's arithmetic would be absurd.
  const days = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : undefined;
  };
  for (const raw of content) {
    const bl = raw as { type: string; text?: string; name?: string; input?: Record<string, unknown> };
    if (bl.type === 'text') text += bl.text ?? '';
    if (bl.type === 'tool_use' && bl.name === 'record_plan') {
      for (const k of ['activityBackup', 'dietBackup', 'obstacles'] as const) {
        const v = bl.input?.[k];
        if (typeof v === 'string' && v.trim()) plan[k] = v.trim();
      }
      if (typeof bl.input?.activityChange === 'string') plan.activityChange = bl.input.activityChange;
      if (typeof bl.input?.dietChange === 'string') plan.dietChange = bl.input.dietChange;
      const ad = days(bl.input?.activityDays); if (ad) plan.activityDays = ad;
      const dd = days(bl.input?.dietDays); if (dd) plan.dietDays = dd;
    }
  }
  const any = plan.activityChange || plan.dietChange || plan.activityDays || plan.dietDays;
  return { text: text.trim(), ...(any ? { plan } : {}) };
}

/**
 * @param carryForward What B1, B2 and W3 retained for this member (lib/curriculum/retention.ts), already rendered
 * as a context block, or null. Passed IN rather than read here so the engine stays pure and replayable — the DB
 * read belongs at the action boundary, like every other stored input to this arc. Null when none of the three has
 * been done, and null must add NOTHING: Rewire and Rebuild run in parallel by design, so an absent W3 is a
 * choice the member made, never a gap to point at.
 */
export async function liveTurnRebuildB3(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 1,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = [
    ...history.map((m) => ({ role: (m.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
    { role: 'user' as const, content: memberMessage },
  ];
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 400,
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own text is byte-identical every
    // turn and carries the breakpoint; context, stage note and carry-forward move AFTER it, because a single
    // varying byte inside a cached block invalidates the whole thing and pays the 1.25x write premium for
    // nothing. The prompt was ~650 tokens ungoverned — BELOW Sonnet's 1024-token cache minimum, so it could
    // never cache at any price. Governed it clears the bar, and a Session is cheaper than it was before.
    system: [
      { type: 'text' as const, text: B3_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: b3Context(state.collected) + b3StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
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
// FROM GREG'S B4 "Introduction (Shown to Member)", which had never been used.
//
// Ours opened on mechanics — "a quick read on where your control sits now" — and skipped the part that tells a
// member what they are about to do and why it is not a weigh-in. His introduction carries three things ours did
// not: that four weeks of change is easy to under-notice, that this checkpoint asks whether Rebuild went BEYOND
// the numbers, and what the move into Reclaim actually is — "not about hitting a target weight or completing a
// specific event... the moment you realize your world has gotten bigger because you changed."
//
// ONE DEPARTURE FROM HIS WORDS: he opens "You pedal." Kept as "you move" — Movement here is walking and lifting
// and the rest, and a member who does not cycle should not read the phase's closing beat as addressed to someone
// else. The cycling metaphor stays where it is earned, at Clip in.
// THE RECAP (the doorway's frame) — orientation, not part of the ask. Split from the instrument's framing on
// 2026-08-28 so the member answers CHECKPOINT_ENGAGE_Q between them. See checkpointEngagement().
const B4_CHECKPOINT_RECAP =
  "Rebuilding is physical. You move, you eat better, you watch the numbers change. It's hard, but it's tangible." +
  BEAT_SEP +
  "Four weeks in, the easiest thing to miss is what changed underneath the numbers — your motivation, your habits, " +
  "the things you've stopped having to decide." + BEAT_SEP +
  "So this checkpoint asks whether Rebuild went past the numbers. The move into Reclaim isn't hitting a target " +
  "weight or finishing an event; it's the point where you notice your world got bigger because you changed.";
const B4_CHECKPOINT_OPEN =
  // SIX, NOT "A DOZEN" (Jay, 2026-08-26: "I believe it skipped some dietary questions at the end of the session,
  // there was only one before it closed me out"). He was right to distrust it, and the fault was this sentence.
  // Greg's V5 cut B4 from twelve activity/diet halves to six single items on 2026-08-14 — the items changed, the
  // scoring changed, and this line did not. So the Companion promised twelve, delivered six, and closed. A member
  // who is told a number and gets half of it does not conclude the copy is stale; they conclude the product lost
  // their answers, and at a CHECKPOINT that doubt lands on the measurement itself.
  //
  // Rewire and Reclaim have always said "Six of these", so this also stops Rebuild being the odd one of the three.
  "Six of these, one to five. They set your Rebuild read, and you'll see how it moved your Grinta Index at the " +
  "close.";
const B4_CHECKPOINT_CLOSE = "That's the read. Hold on — let me show you what you just built.";
function rebuildCheckpointDeliver(index: number): string {
  return grintaStem(CHECKPOINT_CONTROL_ITEMS[index]!);
}
function rebuildCheckpointOpener(): string {
  return `${B4_CHECKPOINT_OPEN}${BEAT_SEP}${rebuildCheckpointDeliver(0)}`;
}

const rebuildCheckpointStage: StageDef = administeredStage({
  id: 'checkpoint',
  itemCount: CHECKPOINT_CONTROL_ITEMS.length, // 6 since Greg's V5 (was 12 activity/diet pairs); scaleMax defaults to 5
  ...AGREEMENT_1_5, // Greg's verbatim 1–5 anchors, one definition (onboarding-staged.ts)
  opener: () => rebuildCheckpointOpener(),
  deliverItem: (n) => rebuildCheckpointDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel right now?\n\n${rebuildCheckpointDeliver(n)}`,
  onComplete: (b) => {
    // The six control responses are in b.administeredResponses. Hand into the ceremony; the ACTION scores the
    // Control component (Ave1→Ave2), persists the Checkpoint reading, and sets the phase gate.
    //
    // IT NO LONGER AVERAGES 12→6, and this comment said it did until 2026-08-26. The scoring itself was already
    // correct — it slices to CHECKPOINT_CONTROL_ITEMS.length and pairwiseAverage was deleted with V5 — so this
    // was a comment describing a step that no longer exists, sitting next to the one that does.
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

const rebuildCheckpointEngage = checkpointEngagement({
  next: 'checkpoint',
  recap: B4_CHECKPOINT_RECAP,
  handIn: () => rebuildCheckpointOpener(),
});

export const REBUILD_CHECKPOINT_ARC: ArcConfig = {
  id: 'rebuild-checkpoint',
  stageOrder: ['checkpoint-open', 'checkpoint', 'ceremony'],
  stages: {
    'checkpoint-open': engagementStage(rebuildCheckpointEngage),
    checkpoint: rebuildCheckpointStage,
    ceremony: rebuildCeremonyStage,
  },
  onComplete: () => REBUILD_CEREMONY_LEAD,
};

export function applyRebuildCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REBUILD_CHECKPOINT_ARC, state, history, memberMessage, model);
}

export function rebuildCheckpointOpening(): Turn {
  // Opens on the doorway; the 1–5 chips belong to the instrument, one turn later.
  return { reply: engagementOpening(rebuildCheckpointEngage), state: { stage: 'checkpoint-open', collected: {} }, complete: false };
}

// The Checkpoint is ADMINISTERED (deterministic Likert parse) — no model call needed. The action passes empty text.
export function liveTurnRebuildCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRebuildCheckpointTurn(state, history, memberMessage, { text: '' });
}
