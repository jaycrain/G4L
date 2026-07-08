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
import { identityLabel } from '../member/identity.ts';
import { consolidateReclaimList } from '../member/reclaim.ts';
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';

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
// Fallback ack — the model normally SERVES UP the next-heaviest lie here (guided, one at a time). This runs only if
// the model returns nothing.
const W1_AFFIRM_ACK = "Kept — that's yours. Here's another that stood out — what's the true line you'd put in its place? Or tell me that's your set.";
const W1_AFFIRM_NUDGE = "Even one is enough — take the lie that stung most and write the honest line back.";
const W1_CLOSE =
  `They're the first thing you'll reach for when the old voice gets loud. I've saved them to your Playbook.\n\n` +
  `Catching your own lies is the whole game in Rewire, and you just did the hard part: you said them out loud. ` +
  `That's Grinta in its quietest, most useful form.`;

function w1Opening(): string {
  return `${W1_STORY}${BEAT_SEP}${W1_FRAME}${BEAT_SEP}${W1_DOMAINS[0]}`;
}
// The affirm ack invites "tell me that's your set" / "is that your one?" — so recognize those set/one closings in
// addition to the shared reclaim closes ("that's it", "no", "that's all"). Keyed to the exact language we offer.
const W1_AFFIRM_CLOSE_RE = /^(that'?s|thats) (my|the|your) (set|one|list)\b/i;
function memberClosingAffirm(message: string): boolean {
  const m = (message ?? '').trim().replace(/[‘’]/g, "'").replace(/[.,!?]+$/, '');
  return memberClosingReclaim(message) || W1_AFFIRM_CLOSE_RE.test(m);
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
    if (memberClosingAffirm(b.memberMessage) || line.length < 3) {
      if (wroteAny) {
        b.reply = W1_CLOSE;
        b.stage = 'complete'; // beatState persists b.stage — the chat hides the input on stage==='complete'
        b.complete = true;
      } else {
        b.reply = W1_AFFIRM_NUDGE;
      }
      return;
    }
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    // stay guided: the model acknowledges + serves up the NEXT heaviest lie. Fallback if the model returns nothing.
    b.reply = (b.modelText ?? '').trim() || W1_AFFIRM_ACK;
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
    return (
      "\n\nRIGHT NOW: the member just wrote a TRUE LINE (their honest counter to a lie). In ONE turn: (1) acknowledge " +
      "it warmly in a few words — do not rewrite it or add your own; then (2) SERVE UP the next heaviest lie they " +
      "named earlier that they haven't answered yet — name it back in their words and ask for its true line, one at " +
      "a time. Don't make them go find the next one. Once they've put lines to two or three (or answered them all), " +
      "add a gentle out — 'or is that your set?' — but keep offering the next one until they close."
    );
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

// ══ W2 · The Visualization Workshop ═══════════════════════════════════════════════════════════════════════════
// Second Rewire session (own arc on the same kernel; same REWIRE flag + surface). Reads Reconnect's captures via the
// callback seam (loadReconnectCaptures → state.collected): the anchor goal is PULLED FROM THE RECLAIM LIST. Shape,
// carrying the W1 lessons: value up front → a guided, one-at-a-time build → a reveal for weight. Structure:
//   anchor  — pick a vivid, aspirational goal to stand inside (the model offers/helps from their Reclaim List;
//             adapts to the goal type — a race/trip paints a scene directly, a subtler goal finds the vivid moment).
//   image   — build the scene ONE PIECE AT A TIME (place · self · people · feeling), guided like W1's domains.
//   hold    — the recognition (the reveal), then the week's 5-min visualization practice + the close; the finished
//             image is harvested as ONE Playbook keeper. (The good-call/false-start LOGGING is W3, not here.)
// COPY: final, Jay-approved (G4L_Rewire_W2_Copy_v0.1.md). Graceful degrade if the captures are thin.

// ── Opening — the value (why visualize; the through-line from W1) ──
const W2_OPEN_1 =
  `Last time, you built the true lines that answer your lies. This time you build the thing those lies have been ` +
  `keeping from you — a clear picture of the person you're becoming.`;
const W2_OPEN_2 =
  `And this isn't soft. Every athlete who's done anything hard rehearsed it in their head first — not because it's ` +
  `magic, but because your brain moves toward what it can see clearly. "I want to be healthier" has nothing to aim ` +
  `at. A specific picture of you, on an ordinary Tuesday, does. So let's build one you can actually step into.`;
// ── The anchor — a goal, made vivid (pull from their Reclaim List) ──
const W2_ANCHOR_LEAD =
  `You named two things in Reconnect: who you'd drifted from, and what you want back. Let's put them together — you, ` +
  `at the moment you get one of those things back.`;
const W2_ANCHOR_PICK =
  `Pick the one that pulls hardest. A race you've put on the calendar. A trip with friends you've been putting off. ` +
  `A day, in the clothes you want to be wearing, that's felt out of reach. Your brain rehearses a real destination ` +
  `far better than a vague "someday" — so let's stand you in it.`;
const W2_ANCHOR_HELP =
  `Take your pick from what you want back — the one you'd most want to actually live. Or tell me you're not sure, and ` +
  `we'll find it together.`;
// ── Build the image — one at a time (draw-out; each a single ask) ──
const W2_IMAGE = [
  `Where are you? Set it — the place, what's around you, the time of day. Make it specific.`,
  `Now look at yourself there. You've done the work to get here. How do you look? How do you feel, standing in it?`,
  `Who's with you — who's there because you showed back up?`,
  `And the feeling you're really after, the one under all of it — what is it, right then?`,
];
const W2_IMAGE_NUDGE = `No rush — just picture it and tell me what you see. Even a detail or two.`;
// ── The recognition — the reveal (the weight) ──
const W2_RECOGNITION =
  `That's not a wish. It's a goal you already named, with you standing in it, on the far side of the work. Look at ` +
  `it for a second — that's what the work is for. Hold onto that.`;
// ── The practice — the week + the W1 connection ──
const W2_PRACTICE_1 =
  `Here's your work this week, and it's small: five minutes each morning, sit with that image. Close your eyes, make ` +
  `it vivid — the light, the effort, the feeling. Don't rush it.`;
const W2_PRACTICE_2 =
  `And here's where it meets last session: when the old voice starts up — "this is stupid," "it'll never happen" — ` +
  `you go back to the image. The lie is a story. The image is real — you built it from your own life. That's the ` +
  `whole move: the true line answers the lie, the image outlasts it.`;
const W2_PRACTICE_3 =
  `Add a little more detail each day. By the end of the week, you should be able to close your eyes and step right ` +
  `into it.`;
// ── Close — harvest ──
const W2_CLOSE =
  `I've saved your picture to your Playbook — yours to return to anytime. You've got both tools now: the lines that ` +
  `answer the lies, and the image that's stronger than them. That's Rewire starting to hold.`;

function w2Opening(): string {
  return `${W2_OPEN_1}${BEAT_SEP}${W2_OPEN_2}${BEAT_SEP}${W2_ANCHOR_LEAD}${BEAT_SEP}${W2_ANCHOR_PICK}`;
}
function imageIdxOf(state: ConvState): number {
  const s = state.stageScratch?.image as { imageIdx?: number } | undefined;
  return s?.imageIdx ?? 0;
}
// True on the turn where the member is giving the LAST image piece — the model reflects the WHOLE scene (not one piece).
export function isLastImageTurn(state: ConvState): boolean {
  return state.stage === 'image' && imageIdxOf(state) >= W2_IMAGE.length - 1;
}
// A goal the member actually PICKED (vs. "not sure / help me choose") — gates the anchor→image advance. Deliberately
// loose: a misfire just keeps the model helping for one more turn (harmless), never strands them.
const W2_UNSURE_RE =
  /^(i('?m| am)? not sure|not sure|i don'?t know|dunno|idk|no idea|not really|help( me)?( pick| choose)?|which( one)?|you (pick|choose|decide)|hmm+|\?+)$/i;
export function memberPickedAnchor(message: string): boolean {
  const m = message.trim().replace(/[.,!?]+$/, '');
  return m.length >= 4 && !W2_UNSURE_RE.test(m);
}
// The finished image → one keeper: the goal, then the scene they built, their own words, newline-joined.
function composeImage(c: Collected): string {
  const parts = (c.w2Image ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  const goal = (c.w2Anchor ?? '').trim();
  return [goal, ...parts].filter(Boolean).join('\n');
}

// Beat 1 — the anchor: the model offers/helps pick a vivid goal from the Reclaim List and adapts to its type. The
// engine advances to the image build once the member has actually picked one (else the model keeps helping).
const anchorStage: StageDef = {
  id: 'anchor',
  mode: 'drawout',
  opener: () => w2Opening(),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    const reflected = (b.modelText ?? '').trim();
    if (!memberPickedAnchor(b.memberMessage)) {
      b.reply = reflected || W2_ANCHOR_HELP; // still choosing → the model offers candidates from their list
      return;
    }
    b.collected.w2Anchor = b.memberMessage.trim();
    b.stage = 'image';
    b.reply = reflected ? `${reflected}${BEAT_SEP}${W2_IMAGE[0]}` : W2_IMAGE[0]!;
  },
  confirm(b) {
    anchorStage.gather(b);
  },
};

// Beat 2 — build the image one piece at a time (draw-out sequence): the model reflects each piece a touch more vivid;
// the engine poses the next. On the LAST piece → the model reflects the whole scene + the recognition reveal (→ hold).
const imageStage: StageDef = {
  id: 'image',
  mode: 'drawout',
  opener: () => W2_IMAGE[0]!,
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    const sc = b.scratch as { imageIdx?: number };
    const idx = sc.imageIdx ?? 0;
    if (b.memberMessage.trim().length < 3) {
      b.reply = W2_IMAGE_NUDGE;
      return;
    }
    (b.collected.w2Image ??= []).push(b.memberMessage.trim());
    const reflected = (b.modelText ?? '').trim();
    const next = idx + 1;
    if (next < W2_IMAGE.length) {
      sc.imageIdx = next;
      b.reply = reflected ? `${reflected}${BEAT_SEP}${W2_IMAGE[next]}` : W2_IMAGE[next]!;
    } else {
      // whole scene built → the model's full-image reflection + the recognition reveal, then sit with it (hold).
      b.stage = 'hold';
      b.reply = `${reflected ? `${reflected}${BEAT_SEP}` : ''}${W2_RECOGNITION}`;
    }
  },
  confirm(b) {
    imageStage.gather(b);
  },
};

// Beat 3 — hold: the member sits with the reveal; the Companion receives it, delivers the week's practice + the
// close, and harvests the finished image as one Playbook keeper (default-emit, member-owned).
const holdStage: StageDef = {
  id: 'hold',
  mode: 'drawout',
  opener: () => W2_RECOGNITION,
  offersSubstance: () => true,
  gather(b) {
    const reflected = (b.modelText ?? '').trim();
    b.pendingHarvest.push({
      kind: 'image',
      keeperType: 'lights_you_up',
      destinationIntent: 'keeper',
      payloadRef: composeImage(b.collected),
      label: 'Your picture',
    });
    b.reply = `${reflected ? `${reflected}${BEAT_SEP}` : ''}${W2_PRACTICE_1}${BEAT_SEP}${W2_PRACTICE_2}${BEAT_SEP}${W2_PRACTICE_3}${BEAT_SEP}${W2_CLOSE}`;
    b.stage = 'complete'; // beatState persists b.stage — the chat hides the input on stage==='complete'
    b.complete = true;
  },
  confirm(b) {
    holdStage.gather(b);
  },
};

export const REWIRE_W2_ARC: ArcConfig = {
  id: 'rewire-w2',
  stageOrder: ['anchor', 'image', 'hold'],
  stages: { anchor: anchorStage, image: imageStage, hold: holdStage },
  onComplete: () => W2_CLOSE,
};

export function applyRewireW2Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_W2_ARC, state, history, memberMessage, model);
}

// The opening turn — carries the COMMITTED captures (identity, Reclaim List, doors, gap) into `collected` so the
// anchor can pull from them and the model always knows what it already knows. Graceful degrade if captures are thin.
export function rewireW2Opening(committed: Collected | null): Turn {
  return { reply: w2Opening(), state: { stage: 'anchor', collected: committed ?? {} }, complete: false };
}

// ── the live surface — the model OFFERS the anchor from the Reclaim List, REFLECTS each image piece, then the whole ──
const REWIRE_W2_SYSTEM =
  "You are the G4L Companion running W2, the Visualization Workshop, in Rewire (Phase 2). You already know this " +
  "member (see MEMBER CONTEXT) — never say you don't. You are helping them build ONE vivid, aspirational mental " +
  "image: themselves at the moment they get back something they named they want. Plain, measured, warm; never judge, " +
  "grade, praise, diagnose, or over-promise. Draw out — reflect in THEIR words, one question at a time; let them set " +
  "the depth. Do NOT invent details they didn't give; make what they DID give a touch more vivid. If a distress or " +
  "crisis signal appears, drop the exercise and route to support (988 US / local) and a human — always on.";

function w2Context(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const list = consolidateReclaimList(c.reclaimList ?? []);
  const goal = (c.w2Anchor ?? '').trim();
  const lines = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    list.length ? `Their Reclaim List (what they want back — pull the anchor goal from HERE): ${list.map((x) => `"${x}"`).join(', ')}` : '',
    goal ? `The goal they chose to stand inside: ${goal}` : '',
  ].filter(Boolean);
  return lines.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${lines.join('\n')}` : '';
}

function rewireW2StageNote(state: ConvState): string {
  if (state.stage === 'anchor')
    return (
      "\n\nRIGHT NOW (the anchor): the member is choosing a vivid, aspirational GOAL to stand inside. Pull from their " +
      "Reclaim List (in MEMBER CONTEXT). If they named one, reflect it back warmly and confirm it in one line, then " +
      "we build the scene. If they're unsure, OFFER two or three of their actual Reclaim List items as candidates and " +
      "ask them to pick. ADAPT to the goal: a race, a trip, or the clothes they want to wear paints a scene directly; " +
      "a subtler goal (getting the marriage back on track, financial stability, being present) → help them find the " +
      "ONE specific, vivid MOMENT inside it (a good evening with their spouse; the day the pressure lifts). One question."
    );
  if (isLastImageTurn(state))
    return (
      "\n\nRIGHT NOW: the member just gave the LAST piece of the scene. Reflect the WHOLE picture back to them as one " +
      "coherent moment — where they are, themselves in it, who's with them, the feeling — warmly, in their own words. " +
      "Do NOT add a question, do NOT add anything they didn't give."
    );
  if (state.stage === 'image')
    return (
      "\n\nRIGHT NOW: the member just gave one piece of the scene. Reflect it back in 1–2 sentences, in their words, a " +
      "touch more vivid — no new question, no next piece, no advice, nothing they didn't say."
    );
  return "\n\nRIGHT NOW (hold): the member is sitting with the image you reflected. Receive their reaction in ONE warm sentence — no advice, no new question.";
}

export async function liveTurnRewireW2(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
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
    system: REWIRE_W2_SYSTEM + w2Context(state.collected) + rewireW2StageNote(state),
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyRewireW2Turn(state, history, memberMessage, { text });
}
