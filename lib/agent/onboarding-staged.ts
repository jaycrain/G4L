// Onboarding engine v2.0 — STAGED CAPTURE.  Shape: docs/onboarding-staged-capture-shape.md.
// Built ALONGSIDE the v1 engine (lib/agent/onboarding.ts), selected by the ONBOARDING_ENGINE=staged flag;
// v1 serves prod until the eval clears the cut-over bar (≥87% rita vs the ~50% v1 baseline).
//
// The principle, made structural: the STAGE is the capture context. The agent asks about ONE field per
// stage; the model TAGS each piece via per-field tools (no narrative-shape guessing); the engine sequences
// the stages and gates each transition on a warm member confirmation. That makes the v1 reclaim-as-gap
// (37%) impossible — reclaim can't land in the gap slot because we aren't collecting wants in the gap stage.
//
// Arc:  Stage 0 gate → identity → gap (how it opened) → reclaim → confirmation card.  Ends on hope.
//
// SLICE a builds: the stage machine (authoritative `stage` + `awaitingConfirm`), the confirmed-transition
// engine, and the IDENTITY stage in full (gather → reflect-confirm → advance; skip path; correction
// re-opens). gap/reclaim are stubs here — slices b/c.

import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import {
  isAffirmation,
  stripLeadingDisclosure,
  type Collected,
  type ConvMessage,
  type ConvState,
  type Ctx,
  type ModelTurn,
  type Stage,
  type Turn,
} from './onboarding.ts';

const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// --- stage sequencing ----------------------------------------------------------------------------------
type StagedStage = 'identity' | 'gap' | 'reclaim' | 'complete';
const STAGE_ORDER: StagedStage[] = ['identity', 'gap', 'reclaim', 'complete'];
function nextStagedStage(s: StagedStage): StagedStage {
  return STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(s) + 1, STAGE_ORDER.length - 1)]!;
}

// After this many identity gather-turns without a word, offer the explicit "find it later" skip.
const IDENTITY_SKIP_OFFER_AFTER = 2;

// --- copy (engine-owned forwards; the model leads when it asks a real question) -------------------------
export const STAGED_OPENING =
  "Before we get to any numbers or plans, I want to understand who I'm helping you reclaim — the fullest version of you. " +
  "Let's start by taking a minute to think about who you were back when you felt most like yourself — not the job title, " +
  'the version underneath all that.';

const NAME_PROMPT =
  'If you put that person in a single word — the Runner, the Writer, the Builder, the Friend — what would it be? ' +
  "It's a handle to hold onto, not a label set in stone, and we can change it.";

const SKIP_OFFER =
  "No rush on the perfect word — and you don't have to land it today. If one comes — the Runner, the Builder, the " +
  "Friend — say it. If not, that's completely fine; we'll find it together as you go. Want to leave it for now?";

const SKIP_ACK = "That's completely fine — you'll find her through the work, no rush.";

const REOPEN_IDENTITY = "My mistake — let's get it right. What word feels truer for who she was?";

// The reframe into Stage 2, used the moment we advance out of identity (slice b implements its capture).
const GAP_OPEN =
  'Now, the harder part — and it might matter most. Somewhere, the distance started to open. Sometimes it’s one clear ' +
  'thing — a loss, a diagnosis, a move, a job that swallowed you. More often it’s slower. Tell me how it went for you.';

function reflectIdentity(c: Collected): string {
  const label = capFirst(identityLabel(c.identityNoun) || 'that person');
  return `So — ${label} is who we're bringing back, the one who felt most like you. Did I get her right?`;
}

// --- confirmed-transition detection --------------------------------------------------------------------
// The ONLY signal we need: did the member CORRECT the reflection? Everything else (an affirmation, or an
// ambiguous reply) advances — a reflection with no dispute moves on, so the transition can never trap.
const CORRECTION_RE =
  /\b(no|nope|not (quite|really|it|her|him|that|right)|that'?s not|that wasn'?t|wrong|isn'?t (it|her|right)|actually|what do you mean|doesn'?t (fit|feel|sound|seem))\b/i;
// A correction re-opens the stage. The isAffirmation guard lets the colloquial "yeah no, that's her" (a yes)
// through as NOT a correction, so it advances.
export function correctsReflection(message: string): boolean {
  const m = (message ?? '').replace(/[‘’]/g, "'");
  return CORRECTION_RE.test(m) && !isAffirmation(m);
}

function identityTargetMet(c: Collected): boolean {
  return !!c.athleticPast && (!!c.identityNoun || !!c.identitySkipped);
}

// --- capture merge (the per-field tools' result, merged into Collected) ---------------------------------
// The model's turn carries the per-field captures already merged into a Partial<Collected> (parseStagedTurn
// does this on the live path; fixtures provide it directly). Only the early-beat fields exist in slice a.
function mergeStaged(prev: Collected, rec?: Partial<Collected>): Collected {
  if (!rec) return prev;
  return {
    ...prev,
    ...(rec.athleticPast !== undefined && { athleticPast: rec.athleticPast }),
    ...(rec.identityNoun !== undefined && rec.identityNoun !== '' && { identityNoun: displayIdentityNoun(rec.identityNoun) }),
    ...(rec.identitySkipped === true && { identitySkipped: true }),
  };
}

// --- THE STAGED ENGINE (pure, replayable) --------------------------------------------------------------
export function applyStagedTurn(
  state: ConvState,
  _history: ConvMessage[],
  memberMessage: string,
  model: ModelTurn,
): Turn {
  const collected = mergeStaged({ ...state.collected }, model.record);
  let stage = (state.stage ?? 'identity') as StagedStage;
  let awaitingConfirm = state.awaitingConfirm ?? false;
  let identityTurns = state.identityTurns ?? 0;
  const modelText = stripLeadingDisclosure(model.text).trim();

  let finalReply: string;
  let complete = false;

  if (awaitingConfirm) {
    // Resolving a reflect-confirm: a correction re-opens the stage; anything else advances.
    if (correctsReflection(memberMessage)) {
      awaitingConfirm = false;
      finalReply = stage === 'identity' ? REOPEN_IDENTITY : modelText || 'Tell me more.';
    } else {
      stage = nextStagedStage(stage);
      awaitingConfirm = false;
      finalReply = stage === 'gap' ? GAP_OPEN : `(${stage} stage — slice b/c)`; // gap/reclaim opens land in b/c
    }
  } else if (stage === 'identity') {
    if (collected.identitySkipped) {
      // Skipped — nothing to confirm; acknowledge and advance straight into the gap stage.
      stage = 'gap';
      finalReply = `${SKIP_ACK}\n\n${GAP_OPEN}`;
    } else if (collected.identityNoun) {
      // Named — reflect it back warmly and wait for the member's confirm (the transition).
      finalReply = reflectIdentity(collected);
      awaitingConfirm = true;
    } else {
      // Gather: keep the model's question if it asked one; otherwise drive the identity forward, and after
      // a couple of tries offer the explicit "find it later" skip (the v1 identity-gate intent, staged).
      identityTurns += 1;
      if (modelText && /\?/.test(modelText)) finalReply = modelText;
      else if (!collected.athleticPast) finalReply = STAGED_OPENING;
      else finalReply = identityTurns >= IDENTITY_SKIP_OFFER_AFTER ? SKIP_OFFER : NAME_PROMPT;
    }
  } else if (stage === 'gap') {
    // STUB (slice a): hold the gap open; capture + Doors + confirm land in slice b.
    finalReply = modelText && /\?/.test(modelText) ? modelText : GAP_OPEN;
  } else if (stage === 'reclaim') {
    finalReply = modelText || '(reclaim stage — slice c)';
  } else {
    finalReply = '(complete — card handoff, slice d)';
    complete = true;
  }

  return {
    reply: finalReply,
    state: { stage, collected, awaitingConfirm, identityTurns },
    complete,
  };
}

// --- the public staged turn (opening + governance handled by onboardingNextTurn) -----------------------
export function stagedOpening(): Turn {
  return { reply: STAGED_OPENING, state: { stage: 'identity', collected: {} }, complete: false };
}

// --- live tool surface (used when ONBOARDING_ENGINE=staged on the live path) ---------------------------
// Slice a: the identity-stage tools. set_gap/note_door/add_reclaim_item land in slices b/c.
export const STAGED_TOOLS = [
  {
    name: 'set_past_self',
    description: "Record who the member was at their best, in their own words (the past self).",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'name_identity',
    description: 'Record the confirmed reclaimed-identity word, natural case (e.g. "Athlete"), once the member chooses or coins it.',
    input_schema: { type: 'object' as const, properties: { noun: { type: 'string' } }, required: ['noun'] },
  },
  {
    name: 'skip_identity',
    description: 'Record that the member chose NOT to name an identity yet (they will find it at Identity Excavation).',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
];

// Parse a staged model response (per-field tool calls) into the merged Partial<Collected> the engine reads.
export function parseStagedTurn(content: readonly unknown[]): ModelTurn {
  let text = '';
  const rec: Partial<Collected> = {};
  for (const b of content as Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>) {
    if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'set_past_self' && typeof b.input?.text === 'string') rec.athleticPast = b.input.text;
      if (b.name === 'name_identity' && typeof b.input?.noun === 'string') rec.identityNoun = cleanIdentityNoun(b.input.noun);
      if (b.name === 'skip_identity') rec.identitySkipped = true;
    }
  }
  return { text, record: rec };
}

// Is the staged engine selected? Flag only — defaults OFF, so v1 serves prod until cut-over.
export function stagedEngineEnabled(): boolean {
  return process.env.ONBOARDING_ENGINE === 'staged';
}

// --- live staged turn (slice a: identity stage; gap/reclaim instructions land in b/c) -------------------
const STAGED_SYSTEM = `${MEMBER_AGENT_SYSTEM_PROMPT}

OPERATING MOMENT: Onboarding (v2.0, STAGED capture).
This is a staged conversation. You move through it one stage at a time — identity → how the gap opened →
what they want back — and you only ever ask about the CURRENT stage (named each turn). It still feels like
one warm conversation; the stages are invisible to the member.

CAPTURE WITH TOOLS, never in prose — and never narrate that you saved something:
- set_past_self(text): who they were at their best, in their own words.
- name_identity(noun): the reclaimed-identity word, natural case (e.g. "Athlete"), once they choose or coin it.
- skip_identity(): they chose not to name one yet.
(More tools unlock in later stages.)
If the member volunteers something for a LATER stage (e.g. names what they want back while you're still on
identity), capture it with its tool anyway — never lose it — but keep asking only about the CURRENT stage;
you'll bring it back at its stage.

IDENTITY STAGE: open on who they were when they felt most like themselves — a past self of ANY kind (never
assume athletic). Reflect a specific detail back, then offer a couple of candidate words FROM THEIR OWN
LANGUAGE and invite them to choose or coin one — framed as a changeable HANDLE, not a verdict. Confirm the
word. If they're genuinely not ready, reassure them and call skip_identity — never pressure a name. Record
the word with name_identity in natural case ("Athlete", never "the Athlete").

The AI disclosure was shown on the start page — never repeat it. Reflect first, then exactly ONE warm
question per turn. No meta-narration about the program's mechanics.`;

function stageInstruction(stage?: Stage): string {
  if (stage === 'gap') return '\n\nCURRENT STAGE: how the gap opened — receive their fade story. (Stage-2 capture tools unlock in a later build.)';
  if (stage === 'reclaim') return '\n\nCURRENT STAGE: what they want back. (Stage-3 capture tools unlock in a later build.)';
  return '\n\nCURRENT STAGE: identity — who they were at their best, and the one-word handle (or skip).';
}

export async function liveTurnStaged(
  _ctx: Ctx,
  history: ConvMessage[],
  state: ConvState,
  memberMessage: string,
): Promise<Turn> {
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
    max_tokens: 600,
    system: STAGED_SYSTEM + stageInstruction(state.stage),
    tools: STAGED_TOOLS,
    messages,
  });
  return applyStagedTurn(state, history, memberMessage, parseStagedTurn(res.content));
}

export type { Ctx };
