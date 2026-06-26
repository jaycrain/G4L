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
// SLICE a built: the stage machine (authoritative `stage` + `awaitingConfirm`), the confirmed-transition
// engine, and the IDENTITY stage in full (gather → reflect-confirm → advance; skip path; correction re-opens).
// SLICE b builds: the GAP stage — set_gap/note_door tools, lighter Door posture (receive, don't excavate;
// 0/1/several Doors all valid, never gated on count), the Doors-session forecast, and the stage-scoped gap
// backstop (capture the member's own message as the gap only in-stage when the model failed to tag it).
// reclaim is still a stub — slice c.

import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../member/identity.ts';
import { isDoorSlug, type DoorSlug } from '../doors.ts';
import { gapIsNarrative } from './onboarding-contract.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from './system-prompt.ts';
import {
  augmentDoors,
  isAffirmation,
  memberWantsToWrap,
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

// The reframe into Stage 2 (gap), used the moment we advance out of identity.
const GAP_OPEN =
  'Now, the harder part — and it might matter most. Somewhere, the distance started to open. Sometimes it’s one clear ' +
  'thing — a loss, a diagnosis, a move, a job that swallowed you. More often it’s slower. Tell me how it went for you.';

// Reflect-confirm copy for the gap. We lead with the model's OWN warm reflection of what they just told us
// (it just heard the whole story); the forecast sets the expectation that the specific Doors get a dedicated
// session later (lighter Door posture — receive, don't excavate); one confirm question, never a Y/N gate.
const GAP_REFLECT_LEAD = "Thank you for trusting me with that — that kind of distance rarely opens all at once.";
const GAP_FORECAST_CONFIRM =
  "We'll come back to the specific doors that opened it — there's a session built for exactly that a little " +
  'further on. For now: did I understand the shape of how it went?';
const REOPEN_GAP = "I want to get this right — tell me how it really went, in your own words.";

// The reframe into Stage 3 (reclaim) — the conversation turns toward hope (capture lands in slice c).
const RECLAIM_OPEN =
  'Now the good part — the reason any of this matters. When you picture closing that distance, what do you ' +
  'want back? The things that were yours. Name whatever comes — big or small, there are no wrong answers.';

function reflectIdentity(c: Collected): string {
  const label = capFirst(identityLabel(c.identityNoun) || 'that person');
  return `So — ${label} is who we're bringing back, the one who felt most like you. Did I get her right?`;
}

// The model's same-turn text is its natural reflection of the story it just heard — use it as the lead when
// it isn't itself a question (one-question-per-turn); otherwise fall back to the warm canned lead.
function reflectGap(modelText: string): string {
  const lead = modelText && !modelText.includes('?') ? modelText.trim() : GAP_REFLECT_LEAD;
  return `${lead}\n\n${GAP_FORECAST_CONFIRM}`;
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
    ...(rec.gap !== undefined && rec.gap !== '' && { gap: rec.gap }),
    // Doors accumulate — one note_door call per Door; union with what we already have (never drop one).
    ...(rec.doors !== undefined && { doors: Array.from(new Set<DoorSlug>([...(prev.doors ?? []), ...rec.doors])) }),
    // Reclaim items accumulate in lockstep with their categories. Tools are stage-agnostic for CAPTURE, so an
    // item volunteered early (front-loader) parks here in the moment — never lost, re-surfaced at its stage.
    ...(rec.reclaimList !== undefined && {
      reclaimList: [...(prev.reclaimList ?? []), ...rec.reclaimList],
      reclaimCategories: [
        ...(prev.reclaimCategories ?? []),
        ...rec.reclaimList.map((_, i) => rec.reclaimCategories?.[i] ?? ''),
      ],
    }),
  };
}

// Stage-scoped gap backstop: if the model conversed but never called set_gap, capture the member's OWN
// gap-stage message as the gap — but ONLY while we're in the gap stage and ONLY if it reads as a real fade
// narrative (not a wrap/affirm or a one-liner). Safe by construction: in the gap stage there is no reclaim
// list being collected, so the v1 reclaim-as-gap contamination simply cannot occur here.
const STAGED_GAP_MIN_CHARS = 80;
function shouldCaptureStagedGap(message: string): boolean {
  const m = (message ?? '').trim();
  if (memberWantsToWrap(m) || isAffirmation(m)) return false;
  if (m.length < STAGED_GAP_MIN_CHARS) return false;
  return gapIsNarrative(m, []);
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
      if (stage === 'identity') {
        finalReply = REOPEN_IDENTITY;
      } else if (stage === 'gap') {
        // Re-open the gap: clear the captured story (and the Doors derived from it) so the next gather
        // re-captures the corrected account. Non-trapping — they retell, the card is the final seatbelt.
        collected.gap = undefined;
        collected.doors = [];
        finalReply = REOPEN_GAP;
      } else {
        finalReply = modelText || 'Tell me more.';
      }
    } else {
      stage = nextStagedStage(stage);
      awaitingConfirm = false;
      finalReply = stage === 'gap' ? GAP_OPEN : stage === 'reclaim' ? RECLAIM_OPEN : `(${stage} stage — slice c)`;
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
    // Backstop: model conversed without tagging set_gap — capture their own message as the gap if it's a
    // real fade narrative (safe in-stage; see shouldCaptureStagedGap).
    if (!collected.gap && shouldCaptureStagedGap(memberMessage)) collected.gap = memberMessage.trim();
    if (collected.gap) {
      // Door quality (lighter posture — receive, don't excavate): read any Doors out of the captured gap.
      // 0/1/several are all valid; the stage NEVER gates on Door count. augmentDoors unions, never invents
      // off an empty gap.
      collected.doors = augmentDoors(collected.doors ?? [], collected.gap);
      // Reflect the story back + forecast the dedicated Doors session, then await the member's confirm.
      finalReply = reflectGap(modelText);
      awaitingConfirm = true;
    } else {
      // Gather: keep the model's question if it asked one; otherwise hold the gap open.
      finalReply = modelText && /\?/.test(modelText) ? modelText : GAP_OPEN;
    }
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
  {
    name: 'set_gap',
    description: "Record how the distance opened — the member's own account of the fade story (the gap). Call this once they've told you how it went, in their words.",
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'note_door',
    description:
      'Record a Door that surfaces in the fade story — the life event that opened the distance. Call once per Door (it accumulates). Slugs: ' +
      'career_cliff, aging_parents, empty_nest, vanishing, body, diagnosis, marriage, loss, full_house, grind, load_bearer. ' +
      'Only note a Door the member actually describes — none is a valid outcome; never force one.',
    input_schema: { type: 'object' as const, properties: { slug: { type: 'string' } }, required: ['slug'] },
  },
  {
    name: 'add_reclaim_item',
    description:
      'Record one thing the member wants back (a Reclaim-List item), in their words. Call once per item; it accumulates. ' +
      "If they volunteer one EARLY (before the reclaim stage), capture it here anyway so it's never lost — you'll bring it back at its stage.",
    input_schema: {
      type: 'object' as const,
      properties: { text: { type: 'string' }, category: { type: 'string' } },
      required: ['text'],
    },
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
      if (b.name === 'set_gap' && typeof b.input?.text === 'string') rec.gap = b.input.text;
      if (b.name === 'note_door' && typeof b.input?.slug === 'string' && isDoorSlug(b.input.slug)) {
        (rec.doors ??= []).push(b.input.slug);
      }
      if (b.name === 'add_reclaim_item' && typeof b.input?.text === 'string') {
        (rec.reclaimList ??= []).push(b.input.text);
        (rec.reclaimCategories ??= []).push(typeof b.input.category === 'string' ? b.input.category : '');
      }
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
- set_gap(text): how the distance opened — their fade story, in their words.
- note_door(slug): a life event that opened the distance (one call per Door; none is valid — never force one).
If the member volunteers something for a LATER stage (e.g. names what they want back while you're still on
identity), capture it with its tool anyway — never lose it — but keep asking only about the CURRENT stage;
you'll bring it back at its stage.

IDENTITY STAGE: open on who they were when they felt most like themselves — a past self of ANY kind (never
assume athletic). Reflect a specific detail back, then offer a couple of candidate words FROM THEIR OWN
LANGUAGE and invite them to choose or coin one — framed as a changeable HANDLE, not a verdict. Confirm the
word. If they're genuinely not ready, reassure them and call skip_identity — never pressure a name. Record
the word with name_identity in natural case ("Athlete", never "the Athlete").

GAP STAGE ("how it opened"): ask, once, how the distance opened, then RECEIVE — do not excavate. Let them
tell it their way; when they've given you the account, call set_gap(their story) and note_door for any Door
that genuinely surfaces (zero is fine — recognition, not routing). Do NOT keep digging for more Doors or
re-ask "any others?"; the specific Doors get a dedicated session later, and you may say so warmly. One Door,
several, or none are all complete.

The AI disclosure was shown on the start page — never repeat it. Reflect first, then exactly ONE warm
question per turn. No meta-narration about the program's mechanics.`;

function stageInstruction(stage?: Stage): string {
  if (stage === 'gap')
    return (
      '\n\nCURRENT STAGE: how the gap opened. Ask once, then receive their fade story and call set_gap; ' +
      'note_door for any Door that surfaces (none is valid). Do not excavate or re-ask for more Doors.'
    );
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
