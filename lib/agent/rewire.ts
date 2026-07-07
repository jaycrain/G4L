// Rewire (v2.3, Phase 2 — Commitment/Mindfulness). Config #3 on the shared arc kernel (runArcTurn). Spec of record:
// G4L_Rewire_W1_Copy_v0.1.md (Jay-approved) + G4L_Rewire_Build_Approach_v0.1.md. Builds on the Reconnect engine.
// SLICE 1 = W1 — The Disinformation Audit. Structure: opening story (Jay, third-person) → the frame (roadmap +
// payoff) → the FIVE domains walked one at a time (body · habits · time · who-you-are · what's-still-possible),
// surfacing a self-lie in each → NAME THE CAMPAIGN (the model reflects the whole set back as a reveal) → the TURN,
// GUIDED one at a time (the Companion picks the lie that hit heaviest FROM THE MEMBER'S OWN WORDS and asks for its
// true line; then "another, or is that your one?") → each true line harvested as a Playbook keeper → close.
// Flag-gated by REWIRE (Decision JJ) — OFF by default; prod keeps the v1 static Rewire until the v2.3 flip.
// COPY: final, Jay-approved. "Jay" stays third-person, named (founder presence).

import { runArcTurn, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { memberClosingReclaim } from './onboarding-intent.ts';
import { BEAT_SEP, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';

export function rewireEnabled(): boolean {
  return process.env.REWIRE === 'staged';
}

// ── W1 · The Disinformation Audit — final approved copy ──────────────────────────────────────────────────────
const W1_STORY =
  `Jay ran a disinformation campaign on himself for eight years.\n\n` +
  `The lies didn't sound like lies. They sounded like reason. "I'm alright." "It's not that bad." "I'll deal with ` +
  `it next month." The whole time his body was telling the truth — the weight, the hives, the blood markers, three ` +
  `doctor's warnings — and his brain kept overriding the signal with the same comfortable story.\n\n` +
  `Everybody runs one. It's how the Fade keeps its hold — not with one big lie, but a hundred reasonable ones. So ` +
  `before we build anything in Rewire, let's catch yours.`;
// The frame — the roadmap + the payoff (why this matters: they're building tools they'll reach for).
const W1_FRAME =
  `Here's the play: we're going to run an audit. I'll take you through five places these lies hide, and you tell me ` +
  `the ones you actually run — the real ones, not the ones you're supposed to say. Then we look at the whole ` +
  `campaign together, and for the ones that cost you the most, we build the true line that answers back — yours to ` +
  `keep, the first thing you reach for when the old voice starts up. Nobody's grading this. We can't disarm a lie ` +
  `we won't say out loud.`;
const W1_DOMAINS = [
  `Start here — your body. What do you tell yourself about your weight, your energy, how you feel in your body day ` +
    `to day? ("I eat pretty healthy." "I'll clean it up when things settle." "It's just age.") What's your version?`,
  `Now your habits — the patterns you already know aren't working: the extra drink, the skipped walk, the mindless ` +
    `eating after a hard day. What's the story that makes those feel okay in the moment?`,
  `Your time. What do you tell yourself about why there's no room for you? ("I'm too busy." "When work calms down." ` +
    `"The kids need me.") What's the reason you give?`,
  `Who you are. What do you tell yourself about who you are now versus who you used to be? ("That was a long time ` +
    `ago." "I'm not that person anymore." "It's too late.")`,
  `Last one — what's still possible. What do you tell yourself about whether any of this can actually change? ("This ` +
    `is just who I am now." "It probably wouldn't work." "I've tried before.")`,
];
const W1_DOMAIN_NUDGE = "No wrong answer here — just the story you actually run. What's the version in your head?";
// NAME THE CAMPAIGN — the reveal after the five (fixed framing; the model personalizes the turn ask that follows).
const W1_CAMPAIGN =
  `Now look at what you just laid out. Every one of those sounds reasonable — that's the trick. And every one keeps ` +
  `you exactly where you are. That's not weakness; it's the campaign, running on autopilot. You just made it visible ` +
  `— and that's the first real move.`;
// The turn is GUIDED and model-driven (picks the heaviest lie in the member's own words). This fallback runs only if
// the model returns nothing — a clear single ask, still member-picked.
const W1_TURN_ASK_FALLBACK =
  "Let's answer them — start with the one that hit you hardest. What's the honest line you'd put in its place?";
const W1_AFFIRM_ACK = "Kept — that's yours. Any other lie you want to answer? Write its true line, or tell me that's your set.";
const W1_AFFIRM_NUDGE = "Even one is enough — take the lie that stung most and write the honest line back.";
const W1_CLOSE =
  `They're the first thing you'll reach for when the old voice gets loud. I've saved them to your Playbook.\n\n` +
  `Catching your own lies is the whole game in Rewire, and you just did the hard part: you said them out loud. ` +
  `That's Grinta in its quietest, most useful form.`;

function w1Opening(): string {
  return `${W1_STORY}${BEAT_SEP}${W1_FRAME}${BEAT_SEP}${W1_DOMAINS[0]}`;
}
function domainIdxOf(state: ConvState): number {
  const s = state.stageScratch?.domains as { domainIdx?: number } | undefined;
  return s?.domainIdx ?? 0;
}
// True on the turn where the member is answering the LAST domain — the model should name the campaign's heaviest
// lie and pose the guided turn ask (not another domain reflection).
export function isLastDomainTurn(state: ConvState): boolean {
  return state.stage === 'domains' && domainIdxOf(state) >= W1_DOMAINS.length - 1;
}

// Beat 1 — walk the five domains (draw-out sequence): the model reflects each lie, the engine poses the next domain.
// On the fifth, hand into the campaign reveal + the guided turn ask (the model supplies the ask).
const domainsStage: StageDef = {
  id: 'domains',
  mode: 'drawout',
  opener: () => w1Opening(),
  offersSubstance: (message) => message.trim().length >= 4,
  gather(b) {
    const sc = b.scratch as { domainIdx?: number };
    const idx = sc.domainIdx ?? 0;
    if (b.memberMessage.trim().length < 4) {
      b.reply = W1_DOMAIN_NUDGE;
      return;
    }
    const reflected = (b.modelText ?? '').trim();
    const next = idx + 1;
    if (next < W1_DOMAINS.length) {
      sc.domainIdx = next;
      b.reply = reflected ? `${reflected}${BEAT_SEP}${W1_DOMAINS[next]}` : W1_DOMAINS[next]!;
    } else {
      // all five walked → NAME THE CAMPAIGN (fixed reveal) + the guided turn ask (model text, or the fallback ask).
      b.stage = 'affirm';
      b.reply = `${W1_CAMPAIGN}${BEAT_SEP}${reflected || W1_TURN_ASK_FALLBACK}`;
    }
  },
  confirm(b) {
    domainsStage.gather(b);
  },
};

// Beat 2 — the turn, one at a time: the member writes a true line → harvested as a 'principle' Playbook keeper. The
// Companion asks for one more or lets them close. The model picks/asks; the engine captures + harvests.
const affirmStage: StageDef = {
  id: 'affirm',
  mode: 'drawout',
  opener: () => W1_TURN_ASK_FALLBACK,
  offersSubstance: (message) => message.trim().length >= 6,
  gather(b) {
    const line = b.memberMessage.trim();
    const wroteAny = (b.pendingHarvest ?? []).some((h) => h.kind === 'affirmation');
    if (memberClosingReclaim(b.memberMessage) || line.length < 3) {
      if (wroteAny) {
        b.reply = W1_CLOSE;
        b.complete = true;
      } else {
        b.reply = W1_AFFIRM_NUDGE;
      }
      return;
    }
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    b.reply = W1_AFFIRM_ACK;
  },
  confirm(b) {
    affirmStage.gather(b);
  },
};

export const REWIRE_ARC: ArcConfig = {
  id: 'rewire',
  stageOrder: ['domains', 'affirm'],
  stages: { domains: domainsStage, affirm: affirmStage },
  onComplete: () => W1_CLOSE,
};

export function applyRewireTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_ARC, state, history, memberMessage, model);
}

export function rewireOpening(): Turn {
  return { reply: w1Opening(), state: { stage: 'domains', collected: {} }, complete: false };
}

// ── the live surface — the model REFLECTS each lie, NAMES the heaviest at the turn, and ACKS true lines (tool-free) ──
const REWIRE_W1_SYSTEM =
  "You are the G4L Companion running W1, the Disinformation Audit, in Rewire (Phase 2). The member is naming the " +
  "comfortable LIES they tell themselves across five life domains (body, habits, time, who they are, what's still " +
  "possible). Never judge, grade, praise, or diagnose; a self-lie is a hundred reasonable decisions, not a failing — " +
  "normalize it. Plain, measured, no hype. Do NOT write the member's counter-line for them (that's their work at the " +
  "turn). If a distress or crisis signal appears, drop the exercise and route to support (988 US / local) and a " +
  "human — always on.";

function rewireStageNote(state: ConvState): string {
  if (state.stage === 'affirm')
    return "\n\nRIGHT NOW: the member is writing a TRUE LINE (their honest counter to a lie). Acknowledge it warmly in one sentence — do not rewrite it or add your own.";
  if (isLastDomainTurn(state))
    return (
      "\n\nRIGHT NOW: the member just named their FIFTH and last self-lie. Do NOT reflect it separately and do NOT " +
      "list all five. Pick the ONE lie from everything they named that seemed to carry the MOST weight, name it back " +
      "in their own words, and ask for its TRUE LINE — one honest sentence they'd put in its place. Just that one; " +
      "warm; a single clear ask."
    );
  return "\n\nRIGHT NOW: the member just named a self-lie in one domain. Reflect it back in 1–2 sentences — heard, un-judged, the real story under it. No question, no next domain, no counter-line.";
}

export async function liveTurnRewire(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
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
    max_tokens: 300,
    system: REWIRE_W1_SYSTEM + rewireStageNote(state),
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyRewireTurn(state, history, memberMessage, { text });
}
