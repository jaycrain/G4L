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
  `at. A specific picture of you, on an ordinary day, does. So let's build one you can actually step into.`;
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

// ══ W3 · The False Start Protocol ═════════════════════════════════════════════════════════════════════════════
// Third Rewire session — the day it goes sideways. Carries the W1/W2 lessons AND pulls both prior tools FORWARD (the
// toolkit clicking together): the Reframe builds a W1-style true line, the Restart reaches for the W2 image. Read via
// the callback (loadReconnectCaptures + the Playbook true lines/image), graceful degrade if the member skipped them.
// Structure: opening value → the reframe (a false start is NOT failure — the weight/permission) → STEP 1 'triggers'
// (name the four, guided one at a time: situations · feelings · lies · danger hour) → STEP 2 'protocol' (Redirect ·
// Reframe · Restart, guided) → close. HARVEST: the Reframe line as a 'principle' keeper + the whole protocol as a
// 'recovery_move' keeper (so Rebuild can recall it on a slip — plugs into the keeper-recall pattern for free). The
// good-call/false-start LOGGING (Step 3, Momentum) is a SEPARATE slice — this session opens the dormant w3_logging
// window and delivers Step 3's copy; the log_call mechanic lands with Momentum. COPY: final, Jay-approved (W3 doc).

// ── Opening — the value (the through-line; why prepare for failure). NO codenames — descriptive callbacks only. ──
const W3_OPEN_1 =
  `You've named the lies you tell yourself, and you've built a picture of where you're headed. This one's about the ` +
  `day it all goes sideways — because it will.`;
const W3_OPEN_2 =
  `Here's what nobody tells you: everybody slips. The people who make it aren't the ones with more willpower — ` +
  `they're the ones who had a plan for the slip before it happened. So we build yours now, while things are calm. ` +
  `When the hard day comes, you won't be deciding what to do. You'll already know.`;
// ── The reframe — the weight (a false start is NOT failure) ──
const W3_REFRAME =
  `And get this straight, because it's the whole game: a false start is not failure. It's the expected cost of ` +
  `changing a pattern you've run for decades. Expect it. Plan for it. Then a slip stops being the thing that ends ` +
  `your comeback and becomes just another day — something you recover from by dinner.`;
// ── Step 1 — DRAW OUT the triggers (not a fixed march). ONE open question; the model reflects sparingly and widens
// to what hasn't surfaced; 2–3 real triggers is plenty. The four AREAS are INTERNAL guidance for the model (never
// enumerated to the member): the situations, the internal states, the excuse the brain makes, the risky setting. ──
const W3_TRIGGERS_LEAD = `Slips aren't random — they have triggers. Let's find yours.`;
const W3_TRIGGER_OPEN =
  `So — when are you most likely to slip? Think of the moments the old pattern wins: what's usually going on when it happens?`;
const W3_TRIGGER_MORE = `What else tends to trip you up — a mood, a time of day, a place?`; // fallback follow-up (the model usually leads)
const W3_TRIGGER_NUDGE = `No wrong answer — just the real pattern. When does it tend to get you?`;
// The internal areas the draw-out MAY cover — guidance for the model, NEVER a checklist shown or counted to the member:
const W3_TRIGGER_AREAS =
  `the situations (travel, a brutal week, late nights); the internal states (wiped out, frustrated, bored, celebrating); ` +
  `the excuse the brain makes ("just one day", "I'll start Monday", "I earned this" — the same reasonable-sounding lies ` +
  `they audited before); the risky setting or time (the 3pm slump, the evening).`;
const DRAWOUT_MIN_TRIGGERS = 2; // draw out ~2 real triggers, then build the plan — never march all four
// ── Step 2 — Build the protocol (guided; pulls the member's REAL prior tools forward, one ask at a time) ──
// The protocol intro is folded into the Redirect ask so the triggers→protocol hand-off is TWO bubbles, not three.
const W3_REDIRECT =
  `Now we build the plan for that one — three moves, starting here. Redirect: the thing you do instead. When you ` +
  `don't want to do the work, the rule is five minutes — start, and if you still want to quit after five, quit. ` +
  `(Usually you won't.) When it's food, name the specific swap: walk the block, call someone, leave the room. ` +
  `What's yours?`;
// Reframe FALLBACK — used only when the member wrote no true lines earlier (nothing real to offer). With a real line,
// reframeAsk() offers THEIRS, propose-confirm (Decision L).
const W3_REFRAME_FALLBACK =
  `Now Reframe — a true line for a bad day. You've answered your lies with honest lines before; here's one for a ` +
  `slip: "A false start is the cost of changing, not proof I can't." Use it, or say it your way.`;
// Restart FALLBACK — used only when no image was built. With a real image, restartLine() points to THEIRS.
const W3_RESTART_FALLBACK =
  `And Restart — when the old voice gets loud, go back to the picture you built of where you're headed, standing in ` +
  `the goal you named. The campaign can't compete with a picture that real.`;
// The Reframe ask surfaces the member's ACTUAL bad-day line (their first true line), propose-confirm — else the
// fallback. The Restart points to their ACTUAL picture — else the fallback. Real keepers, not generic examples.
function reframeAsk(c: Collected): string {
  const line = (c.w3TrueLines ?? []).map((s) => (s ?? '').trim()).filter(Boolean)[0];
  return line
    ? `Now Reframe — your true line for a bad day. Here's one you already wrote: “${line}” — want that as your bad-day line, or write a new one?`
    : W3_REFRAME_FALLBACK;
}
function restartLine(c: Collected): string {
  const img = (c.w3Image ?? '').trim();
  // ONE bubble (newlines, not BEAT_SEP) — the picture on its own line inside a single message.
  return img
    ? `And Restart — when the old voice gets loud, go back to the picture you built:\n\n“${img}”\n\nThe campaign can't compete with a picture that real.`
    : W3_RESTART_FALLBACK;
}
// A confirmation of the offered true line ("use it" / "that one") vs. a member writing a NEW bad-day line.
const W3_CONFIRM_OFFER_RE =
  /^(use (it|that( one)?)|that one|that works|that'?s (the one|it)|yes|yeah|yep|keep (it|that)|the first one|perfect|good|sounds good|i'?ll (use|take) (it|that)|let'?s use it)\b/i;
function resolveReframe(msg: string, c: Collected): { line: string; reused: boolean } {
  const lines = (c.w3TrueLines ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  const m = msg.trim().replace(/[.,!?]+$/, '');
  if (lines.length && W3_CONFIRM_OFFER_RE.test(m)) return { line: lines[0]!, reused: true };
  return { line: msg.trim(), reused: false };
}
// ── Step 3 — The week of noticing (Momentum turns on — the LOGGING mechanic is the Momentum slice) ──
const W3_STEP3_1 =
  `Here's your work this week, and it's not what you'd think: don't try to change anything yet. Just notice. Each ` +
  `day, log your good calls and your false starts — the movement, the eating, the choices. Not to grade yourself — ` +
  `to see your own patterns, out loud.`;
const W3_STEP3_2 =
  `That's what starts filling in your Momentum — the line that tracks the calls you make, one at a time. And when a ` +
  `false start happens this week — it will — run your protocol. Redirect, Reframe, Restart. That's the rep. That's ` +
  `the whole skill.`;
// ── Close — harvest + hand-off ──
const W3_CLOSE_1 =
  `Grit isn't never falling. It's getting back on — now, today, the next meal, the next ride, the next morning. ` +
  `That's Grinta, and it's the most important thing you build in here.`;
const W3_CLOSE_2 =
  `You've got the full kit now: the true lines that answer the lies, the image that outlasts them, and the protocol ` +
  `that turns a slip into a comeback. That's Rewire. Next, we put it into the body.`;

function w3Opening(): string {
  // value → the reframe (permission) → ONE open trigger question. No parenthetical march, no lead+question stack.
  return `${W3_OPEN_1}${BEAT_SEP}${W3_OPEN_2}${BEAT_SEP}${W3_REFRAME}${BEAT_SEP}${W3_TRIGGERS_LEAD} ${W3_TRIGGER_OPEN}`;
}
// How many draw-out turns Step 1 has taken (pre-state) — gates the hand-off into the protocol.
function triggerTurnsOf(state: ConvState): number {
  const s = state.stageScratch?.triggers as { triggerTurns?: number } | undefined;
  return s?.triggerTurns ?? 0;
}
export function isTriggerHandoffTurn(state: ConvState): boolean {
  return state.stage === 'triggers' && triggerTurnsOf(state) >= DRAWOUT_MIN_TRIGGERS - 1;
}
// The finished protocol → one recovery_move keeper: the trigger(s) + Redirect + Reframe + Restart, their own words.
function composeProtocol(c: Collected): string {
  const triggers = (c.w3Triggers ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  const parts = [
    triggers.length ? `Triggers: ${triggers.join('; ')}` : '',
    (c.w3Redirect ?? '').trim() ? `Redirect — ${c.w3Redirect!.trim()}` : '',
    (c.w3Reframe ?? '').trim() ? `Reframe — “${c.w3Reframe!.trim()}”` : '',
    `Restart — go back to your picture, standing in the goal you named.`,
  ];
  return parts.filter(Boolean).join('\n');
}

// Step 1 — DRAW OUT the triggers. ONE bubble per turn (the model's reflection IS the turn — nothing static appended).
// The model reflects sparingly + asks ONE open follow-up until ~2 real triggers surface, then (the hand-off turn) it
// reflects the set, names the heaviest, and poses the Redirect. The engine only counts turns + moves the stage.
const triggersStage: StageDef = {
  id: 'triggers',
  mode: 'drawout',
  opener: () => w3Opening(),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    const sc = b.scratch as { triggerTurns?: number };
    if (b.memberMessage.trim().length < 3) {
      b.reply = W3_TRIGGER_NUDGE;
      return;
    }
    (b.collected.w3Triggers ??= []).push(b.memberMessage.trim());
    const turns = (sc.triggerTurns ?? 0) + 1;
    sc.triggerTurns = turns;
    const reflected = (b.modelText ?? '').trim();
    if (turns >= DRAWOUT_MIN_TRIGGERS) {
      // enough drawn out → the model (per the hand-off note) reflected the set + posed the Redirect. Into the protocol.
      b.stage = 'protocol';
      b.reply = reflected || W3_REDIRECT;
    } else {
      // keep drawing out — the model reflects + asks ONE more open question. One bubble; nothing appended.
      b.reply = reflected || W3_TRIGGER_MORE;
    }
  },
  confirm(b) {
    triggersStage.gather(b);
  },
};

// Step 2 — the protocol, ONE move per turn, ONE bubble each. These asks are DETERMINISTIC (no model reflection
// appended — that was the double-bubble + the validation tic) so the member's REAL keepers surface reliably: Reframe
// offers their actual true line (propose-confirm), Restart points to their actual picture. Reframe harvests a
// 'principle' keeper (new lines only — a reused one is already kept); the close harvests the whole protocol as a
// 'recovery_move' keeper. The live turn skips the model here, so `reflected` is empty by design.
const protocolStage: StageDef = {
  id: 'protocol',
  mode: 'drawout',
  opener: () => W3_REDIRECT,
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    const sc = b.scratch as { moveIdx?: number };
    const idx = sc.moveIdx ?? 0;
    const msg = b.memberMessage.trim();
    // Redirect + Reframe need real substance; the Restart ack (idx 2) accepts any short "ok/got it" to close.
    if (idx < 2 && msg.length < 3) {
      b.reply = W3_TRIGGER_NUDGE;
      return;
    }
    if (idx === 0) {
      b.collected.w3Redirect = msg;
      sc.moveIdx = 1;
      b.reply = reframeAsk(b.collected); // one bubble — their REAL true line, propose-confirm
      return;
    }
    if (idx === 1) {
      const r = resolveReframe(msg, b.collected);
      b.collected.w3Reframe = r.line;
      if (!r.reused) {
        b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: r.line, label: 'Your true line for a bad day' });
      }
      sc.moveIdx = 2;
      b.reply = restartLine(b.collected); // one bubble — their REAL picture
      return;
    }
    // Restart acknowledged → harvest the whole protocol (recovery_move), deliver Step 3 + the close, complete.
    b.pendingHarvest.push({ kind: 'protocol', keeperType: 'recovery_move', destinationIntent: 'keeper', payloadRef: composeProtocol(b.collected), label: 'Your False Start Protocol' });
    b.reply = `${W3_STEP3_1}${BEAT_SEP}${W3_STEP3_2}${BEAT_SEP}${W3_CLOSE_1}${BEAT_SEP}${W3_CLOSE_2}`;
    b.stage = 'complete';
    b.complete = true;
  },
  confirm(b) {
    protocolStage.gather(b);
  },
};

export const REWIRE_W3_ARC: ArcConfig = {
  id: 'rewire-w3',
  stageOrder: ['triggers', 'protocol'],
  stages: { triggers: triggersStage, protocol: protocolStage },
  onComplete: () => W3_CLOSE_2,
};

export function applyRewireW3Turn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_W3_ARC, state, history, memberMessage, model);
}

// The callback the W3 opening carries — the prior tools pulled forward (true lines + image), plus grounding.
export type W3Callback = { trueLines?: string[]; image?: string; reclaimList?: string[]; identityNoun?: string };
export function rewireW3Opening(cb: W3Callback | null): Turn {
  const collected: Collected = {
    w3TrueLines: cb?.trueLines ?? [],
    w3Image: cb?.image ?? undefined,
    reclaimList: cb?.reclaimList ?? [],
    identityNoun: cb?.identityNoun,
  };
  return { reply: w3Opening(), state: { stage: 'triggers', collected }, complete: false };
}

// ── the live surface — reflect each trigger/move, focus the heaviest, ack the true line; reaches for prior tools ──
const REWIRE_W3_SYSTEM =
  "You are the G4L Companion running the False Start Protocol, in Rewire (Phase 2). You already know this member (see " +
  "MEMBER CONTEXT). You are helping them build a plan for the day they slip — BEFORE it happens. Core posture: a false " +
  "start is NOT failure; it's the expected cost of change — normalize it, never judge, grade, or scold. Plain, warm, " +
  "measured. This is a real conversation, not a form. HARD RULES: (1) ONE question per turn — your whole reply ends " +
  "with a single open question (or, at the hand-off, the single Redirect ask); never stack two. (2) DON'T ENUMERATE " +
  "OR COUNT — never say 'the second one', 'the third one', 'first trigger', or expose a checklist; the member sees a " +
  "conversation, not a list. (3) REFLECT SPARINGLY and with SPECIFICITY (their words, the real cost) — do NOT open " +
  "every turn with a validation tic ('makes complete sense', 'completely heard', 'that's convincing'); vary it, and " +
  "sometimes just reflect in a phrase and ask. (4) NAMES: never say 'W1'/'W2'/'W3' — refer to earlier work " +
  "descriptively (the lies they audited; the picture they built of where they're headed). If a distress or crisis " +
  "signal appears, drop the exercise and route to support (988 US / local) and a human — always on.";

function w3Context(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const lines = (c.w3TrueLines ?? []).map((s) => (s ?? '').trim()).filter(Boolean);
  const image = (c.w3Image ?? '').trim();
  const ctx = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    lines.length ? `The true lines they wrote to answer their lies (reach for these at the Reframe): ${lines.map((x) => `“${x}”`).join(' · ')}` : '',
    image ? `The picture they built of where they're headed (point them here at the Restart):\n${image}` : '',
  ].filter(Boolean);
  return ctx.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${ctx.join('\n')}` : '';
}

function rewireW3StageNote(state: ConvState): string {
  // The protocol stage runs WITHOUT the model (deterministic asks) — this note only serves the triggers draw-out.
  if (isTriggerHandoffTurn(state))
    return (
      "\n\nRIGHT NOW: you've heard enough triggers — do NOT ask for another. In ONE message: reflect briefly the one " +
      "or two that seem heaviest (their words), then move into building the plan — ask what they do INSTEAD when that " +
      "hits. Frame that Redirect concretely: the five-minute rule (start, and if you still want to quit after five, " +
      "quit) or a specific swap (walk the block, call someone, leave the room). One warm message, ONE question. Never " +
      "count or say 'the second/third trigger'."
    );
  return (
    "\n\nRIGHT NOW: the member just named a trigger. Reflect it briefly and specifically (their words, the real cost) " +
    "— sparingly, no validation tic — then ask ONE open follow-up to widen into an area that hasn't come up yet " +
    `(possible areas, for YOUR guidance only, never listed to them: ${W3_TRIGGER_AREAS}). One question. Do NOT ` +
    "enumerate or count."
  );
}

export async function liveTurnRewireW3(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
  // The protocol stage's asks are DETERMINISTIC (real-keeper Reframe/Restart, one bubble) — skip the model entirely
  // there: no reflection to generate, no risk of a second question, and a faster turn.
  if (state.stage === 'protocol') return applyRewireW3Turn(state, history, memberMessage, { text: '' });
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
    system: REWIRE_W3_SYSTEM + w3Context(state.collected) + rewireW3StageNote(state),
    messages,
  });
  const text = (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
  return applyRewireW3Turn(state, history, memberMessage, { text });
}
