// Rewire (v2.3, Phase 2 — Commitment/Mindfulness). Config #3 on the shared arc kernel (runArcTurn). Spec of record:
// G4L_Rewire_W1_Copy_v0.1.md (Jay-approved) + G4L_Rewire_Build_Approach_v0.1.md. Builds on the Reconnect engine.
// SLICE 1 = W1 — The Disinformation Audit. Structure: opening story (Jay, third-person) → the frame (roadmap +
// payoff) → the FIVE domains walked one at a time (body · habits · time · who-you-are · what's-still-possible),
// surfacing a self-lie in each → NAME THE CAMPAIGN (the model reflects the whole set back as a reveal) → the TURN,
// GUIDED one at a time (the Companion picks the lie that hit heaviest FROM THE MEMBER'S OWN WORDS and asks for its
// true line; then "another, or is that your one?") → each true line harvested as a Playbook keeper → close.
// Flag-gated by REWIRE (Decision JJ) — OFF by default; prod keeps the v1 static Rewire until the v2.3 flip.
// COPY: final, Jay-approved. "Jay" stays third-person, named (founder presence).

import { runArcTurn, administeredStage, scaleExpects, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { isTrueLineMaterial, isDeclineReply } from './true-line.ts';
import { memberClosingReclaim } from './onboarding-intent.ts';
import { identityLabel } from '../member/identity.ts';
import { consolidateReclaimList } from '../member/reclaim.ts';
import { grintaStem, CHECKPOINT_COMMITMENT_ITEMS } from '../grinta/survey/instrument.ts';
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';
import { hasRevisionTail } from './onboarding-intent.ts';

export function rewireEnabled(): boolean {
  return process.env.REWIRE === 'staged';
}

// W-18: the arc appends its scripted question beat AFTER the model's reflection. But when the model ran ahead and
// already asked its own question, appending ours double-bubbles (both asking). Suppress the scripted beat when the
// model's reflection already ends its last paragraph with a question — the same "model reflects, engine asks, never
// both" discipline as onboarding's withQuestion, BEAT_SEP-aware. Pure + testable.
export function withScriptedBeat(reflected: string, scripted: string): string {
  const t = (reflected ?? '').trim();
  if (!t) return scripted;
  const lastPara = t.split(/\n\s*\n/).pop() ?? t;
  return lastPara.includes('?') ? t : `${t}${BEAT_SEP}${scripted}`;
}

// The inverse, for the CLOSE: the model's terminal line is a RECEIPT, not a prompt — strip a trailing question so it
// can't pose one the engine then steamrolls past with the wrap beats (Jay's walk: "asked what I picture, then ran the
// whole ending"). Drops trailing question segments (BEAT_SEP- or paragraph-separated), then a lingering trailing
// question sentence. Pure + testable.
export function dropTrailingQuestion(text: string): string {
  const parts = (text ?? '').split(BEAT_SEP).flatMap((p) => p.split(/\n\s*\n/)).map((s) => s.trim()).filter(Boolean);
  while (parts.length > 1 && parts[parts.length - 1]!.endsWith('?')) parts.pop();
  let out = parts.join(BEAT_SEP).trim();
  if (out.endsWith('?')) {
    const sents = out.split(/(?<=[.!?])\s+/);
    while (sents.length > 1 && sents[sents.length - 1]!.trim().endsWith('?')) sents.pop();
    out = sents.join(' ').trim();
  }
  return out;
}

// ── W1 · The Disinformation Audit — final approved copy ──────────────────────────────────────────────────────
const W1_STORY =
  `G4L founder, Jay Crain, ran a disinformation campaign on himself for eight years.\n\n` +
  `Only, the lies didn't seem like lies. They sounded like reason. "I'm alright." "It's not that bad." "I'll deal ` +
  `with it next month." The whole time his body was telling the truth — the weight, the hives, the blood markers. ` +
  `But his brain kept overriding the signals, and three doctor's warnings, with the same comfortable story.\n\n` +
  `Lying to yourself is common. And it's not usually the big ones, but a hundred reasonable ones. The disinformation ` +
  `and avoidance contribute to the Fade and allow it to keep its hold.`;
// The frame — the roadmap + the payoff (why this matters: they're building tools they'll reach for). Donna's Rewire
// edits (2026-07-26), keeping the five domains named up front (Jay's earlier #8 — "keep both").
const W1_FRAME =
  `So, let's get real about the lies you're telling yourself. I'll take you through five places these lies hide — ` +
  `your body, your habits, your time, who you are, and what's still possible. You'll get honest about these ` +
  `untruths — things you might not have admitted before.\n\n` +
  `We'll identify the lies that cost you the most. Then we'll build the true lines together that negate each lie — ` +
  `an answer that becomes the first thing you reach for when the old dishonest voice tries to take back over.\n\n` +
  `We can't disarm a lie we won't say out loud. Facing uncomfortable truths won't be fun. This is where your grit ` +
  `comes in.`;
const W1_DOMAINS = [
  `Start here — your body. What do you tell yourself about your weight, your energy, how you feel in your body day ` +
    `to day? ("I eat pretty healthy." "I'll clean it up when things settle." "It's just age.")`,
  `Now your habits — the patterns you already know aren't working: the extra drink, the skipped walk, the mindless ` +
    `eating after a hard day. What's the story that makes those feel okay in the moment?`,
  `Your time. What do you tell yourself about why there's no room for you? ("I'm too busy." "When work calms down." ` +
    `"The kids need me.")`,
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
// Donna's Rewire edits (2026-07-26). The pre-list summary ("Here's your counter-campaign, saved to your Playbook")
// is the model's own reflection of the true lines; this is the fixed CLOSE that follows the list.
// The badge is NOT announced here. Every arc chat client (rewire / rebuild / reclaim) already appends a generic
// beat — `You earned another badge! "<name>." I added it to your collection.` — whenever a turn returns an
// earnedBadge. W1 was the only arc that ALSO hardcoded its own announcement, so it congratulated the member twice
// in consecutive bubbles (Jay's walk, 2026-08-11). It hardcoded the badge's NAME too, which would go quietly stale
// the day that badge is renamed. One announcement, one source: the registry, via the client beat.
const W1_CLOSE =
  `These true lines will be the first thing you reach for when the old voice starts back with the lies and excuses.`;

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
      b.reply = withScriptedBeat(reflected, W1_DOMAINS[next]!);
    } else {
      // all five walked. W-39: the model owns this beat in ONE flowing turn (receive first → make the campaign visible
      // → seed the true line from their own prior honest lines → ask), so it never leads with analysis AND never
      // double-beats a scripted reveal onto a full model turn (the persona walk caught exactly that). The scripted
      // reveal + ask remain only as the fallback when the model returns nothing.
      b.stage = 'affirm';
      b.reply = (reflected || '').trim() || `${W1_CAMPAIGN}${BEAT_SEP}${W1_TURN_ASK_FALLBACK}`;
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
    // A reply to the Companion is not a true line. The stage used to store EVERY message wholesale, so a decline to
    // the close-check ("No, that felt good") and an assent ("That's me") were filed in the Playbook as beliefs the
    // member holds about himself. isTrueLineMaterial is biased to KEEP — it rejects only what is purely a reaction,
    // so a short assertion like "You're a bad ass" still lands.
    if (memberClosingAffirm(b.memberMessage) || line.length < 3 || isDeclineReply(line)) {
      if (wroteAny) {
        b.reply = W1_CLOSE;
        b.stage = 'complete'; // beatState persists b.stage — the chat hides the input on stage==='complete'
        b.complete = true;
      } else {
        b.reply = W1_AFFIRM_NUDGE;
      }
      return;
    }
    // A reaction mid-beat ("That's me", "nice") is not a line and is not a decline either — skip storing it and
    // keep going, rather than closing the session out from under work they haven't finished.
    if (!isTrueLineMaterial(line)) {
      b.reply = (b.modelText ?? '').trim() || W1_AFFIRM_ACK;
      return;
    }
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    const ack = (b.modelText ?? '').trim();
    const linesSoFar = (b.pendingHarvest ?? []).filter((h) => h.kind === 'affirmation').length;
    // If the model WRAPPED instead of serving the next lie (a declarative ack — no question) once they've put down a
    // couple of lines, take that as the close: deliver the model's wrap + W1_CLOSE on THIS turn, rather than stranding
    // a dead "ok" the member has to send to get the summary. Mirrors the draw-out "declarative past the floor advances"
    // rule. When the model ends on a question (offering the next lie), stay guided and keep going.
    const modelWrapped = ack.length > 0 && !/\?\s*$/.test(ack);
    if (modelWrapped && linesSoFar >= 2) {
      b.reply = `${ack}${BEAT_SEP}${W1_CLOSE}`;
      b.stage = 'complete';
      b.complete = true;
      return;
    }
    // stay guided: the model acknowledges + serves up the NEXT heaviest lie. Fallback if the model returns nothing.
    b.reply = ack || W1_AFFIRM_ACK;
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

// W-40 (stateless-arcs): W1 now carries the member's committed captures (their first-person gap story + Reclaim List)
// so the TRUE-LINE work is SEEDED from honest lines they've already spoken, not introduced cold. Degrade to {} when
// there's nothing to recall.
export function rewireOpening(committed?: Collected | null): Turn {
  return { reply: w1Opening(), state: { stage: 'domains', collected: committed ?? {} }, complete: false };
}

// ── the live surface — the model REFLECTS each lie, NAMES the heaviest at the turn, and ACKS true lines (tool-free) ──
const REWIRE_W1_SYSTEM =
  "You are the G4L Companion running W1, the Disinformation Audit, in Rewire (Phase 2). The member is naming the " +
  "comfortable LIES they tell themselves across five life domains (body, habits, time, who they are, what's still " +
  "possible). Never judge, grade, praise, or diagnose; a self-lie is a hundred reasonable decisions, not a failing — " +
  "normalize it. Reflect their WORDS back; never state who they ARE as a fact (no identity verdicts like 'that's a " +
  "man who stopped believing he's allowed to want anything' — W-39) — if you name a pattern, offer it as a check " +
  "they can reject, in their own words. Plain, measured, no hype. Do NOT write the member's counter-line for them (that's their work at the " +
  "turn). STAY ON THIS SESSION'S JOB — it catches self-lies, nothing else. If the member veers into domain detail (training specifics, work logistics), acknowledge it in ONE line, then steer back: \"That's real — and worth its own ride sometime. Right now, let's stay with the story you tell yourself — that's the one we're here to catch.\" Never turn the session into domain coaching or technical analysis. " +
  "If a distress or crisis signal appears, drop the exercise and route to support (988 US / local) and a " +
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
      "\n\nRIGHT NOW: the member just named their FIFTH and last self-lie — often the most vulnerable. Respond in ONE " +
      "flowing turn, IN THIS ORDER: (1) RECEIVE it first (W-39) — reflect what they just admitted, in their OWN words; " +
      "never lead with analysis. (2) Make the campaign visible: all five sounded reasonable, and every one keeps them " +
      "where they are — not weakness, the campaign on autopilot; naming it is the first real move. (3) SEED the true " +
      "line (W-40): they've been speaking honest, first-person lines all session (their story, their Reclaim List — see " +
      "MEMBER CONTEXT; echo a few of their OWN words), so it lands as 'you already do this.' (4) Ask for the true line " +
      "to the ONE lie that costs the most. Warm; use only their real words; no identity verdicts (reflect what they " +
      "said, don't declare who they are)."
    );
  return "\n\nRIGHT NOW: the member just named a self-lie in one domain. Reflect it back in 1–2 sentences — heard, un-judged, the real story under it. No question, no next domain, no counter-line.";
}

// W-40: what W1 already knows about the member — surfaced so the true-line ask can be SEEDED from lines they've
// already spoken (their first-person gap story + their Reclaim List), never introduced cold. Mirrors w2Context/w3Context.
export function w1Context(c: Collected): string {
  const identity = identityLabel(c.identityNoun);
  const list = consolidateReclaimList(c.reclaimList ?? []);
  const gap = (c.gap ?? '').trim();
  const lines = [
    identity ? `Who they're reclaiming: ${identity}` : '',
    gap ? `Their own first-person account of how the distance opened (honest lines they ALREADY spoke — seed the true-line work from these): ${gap}` : '',
    list.length ? `What they said they want back, in their words: ${list.map((x) => `"${x}"`).join(', ')}` : '',
  ].filter(Boolean);
  return lines.length ? `\n\nMEMBER CONTEXT (what you already know — never say you don't):\n${lines.join('\n')}` : '';
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
    system: REWIRE_W1_SYSTEM + w1Context(state.collected) + rewireStageNote(state),
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
  `In the Disinformation Audit you built the true lines that negate the lies you tell yourself. This time you'll ` +
  `build a clear picture of the person you want to become — the very thing those lies have been keeping from you.`;
const W2_OPEN_2 =
  `There's science behind visualization. Every athlete who's done anything hard rehearsed it in their head first. ` +
  `Your brain moves toward what it can see clearly. "I want to be healthier" has nothing to aim at. A specific ` +
  `picture of you, on an ordinary day, does. So let's build a picture of where you want to be.`;
// ── The anchor — a goal, made vivid (pull from their Reclaim List) ──
const W2_ANCHOR_LEAD =
  `In Reconnect you discovered the identity you'd drifted from, and set goals — building an entire Reclaim List of ` +
  `what you want back. Which one of those means the most to you right now?`;
const W2_ANCHOR_PICK =
  `A race you've put on the calendar. A trip with friends you've been putting off. A day, in the clothes you'll be ` +
  `wearing, that's felt out of reach. Pick one.\n\nYour brain rehearses a real destination far better than a vague ` +
  `"someday." So which one do you want to visualize?`;
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
  `it for a second — that's what the work is for. Hold onto that. When you're ready, tell me what comes up.`;
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
    b.reply = withScriptedBeat(reflected, W2_IMAGE[0]!);
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
      b.reply = withScriptedBeat(reflected, W2_IMAGE[next]!);
    } else {
      // whole scene built → the model's full-image reflection + the recognition reveal, then sit with it (hold).
      // W-?? (Millie's walk): the recognition is a scripted CLOSE of this beat — so the model's line must be a RECEIPT,
      // not a question. If it ended by asking (e.g. "Is anyone with you?"), stacking the recognition after it strands
      // that question, unanswered. Strip the trailing question first — same discipline the hold stage already uses.
      b.stage = 'hold';
      const receipt = dropTrailingQuestion(reflected);
      b.reply = `${receipt ? `${receipt}${BEAT_SEP}` : ''}${W2_RECOGNITION}`;
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
    // Same close discipline as W3: the model's line is a receipt, so strip a trailing question before the wrap beats.
    const reflected = dropTrailingQuestion(b.modelText ?? '');
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

// ── Opening — the value (the through-line; why prepare for failure) ──
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
// ── Step 1 — DRAW OUT the triggers. The MODEL owns the questioning: one open question, then it digs into what the
// member said (deepen or widen) for a few real exchanges, then names the heaviest and moves to the plan. The engine
// NEVER appends a question — the model's turn IS the reply. The four AREAS below only guide the model's follow-ups;
// they are never listed to the member or "covered" as a checklist. ──
const W3_TRIGGERS_LEAD = `Slips aren't random — they have triggers. Let's find yours.`;
const W3_TRIGGER_OPEN =
  `So — when are you most likely to slip? A brutal week, travel, the holidays, late nights — what's usually going on ` +
  `when it happens?`;
const W3_TRIGGER_MORE = `Say more about that — what's underneath it?`; // fallback follow-up (the model normally leads)
const W3_TRIGGER_NUDGE = `No wrong answer — just the real pattern. When does it tend to get you?`;
// Areas the draw-out MAY explore — guidance for the model's follow-ups, NEVER listed or counted to the member:
const W3_TRIGGER_AREAS =
  `the situations (travel, a brutal week, late nights, the holidays); the internal states (wiped out, frustrated, ` +
  `bored, celebrating); the excuse the brain makes ("just one day", "I'll start Monday", "I earned this" — the ` +
  `reasonable-sounding lies they audited before); the risky time or place (the 3pm slump, the evening collapse).`;
const TRIGGER_DRAWOUT_TURNS = 3; // draw out over ~2–3 exchanges, then hand into the protocol (never march a checklist)
// ── Step 2 — Build the protocol (guided; reuses W1 + W2) ──
const W3_PROTOCOL_INTRO = `Now we write the plan — for the trigger that gets you most. Three moves.`;
const W3_REDIRECT =
  `First, Redirect — the thing you do instead. When you don't want to do the work, the rule is five minutes: start, ` +
  `and if you still want to quit after five, quit. (Usually you won't.) When it's food, name the specific swap — walk ` +
  `the block, call someone, leave the room. What's yours?`;
const W3_REFRAME_PROMPT =
  `Now Reframe — the true line for a bad day. You've written lines that answer your lies before; here's one for a ` +
  `slip: "A false start is the cost of changing, not proof I can't." Say it your way.`;
const W3_RESTART =
  `And Restart — when the old voice gets loud, you go back to the picture you built of where you're headed, standing ` +
  `in the goal you named. The campaign can't compete with a picture that real.`;
// ── Step 3 — The week of noticing (Momentum turns on — the LOGGING mechanic is the Momentum slice) ──
const W3_STEP3_1 =
  `Here's your work this week: don't try to change anything yet. Just notice. Go to the Momentum card on your ` +
  `dashboard every day and log your good calls, your false starts and the on-track days where not much happened.`;
const W3_STEP3_2 =
  `And when a false start happens — it will — run your protocol. Redirect, Reframe, Restart.`;
// ── Close — harvest + hand-off ──
const W3_CLOSE_1 =
  `Grit isn't never falling. It's getting back on — now, today, the next meal, the next ride, the next morning. ` +
  `That's Grinta, and it's the most important thing you build in here.`;
const W3_CLOSE_2 =
  `You've got the full kit now: the true lines that answer the lies, the image that outlasts them, and the protocol ` +
  `that turns a slip into a comeback. That's Rewire. Next, we put it into the body.`;

function w3Opening(): string {
  // value → the reframe (permission) → ONE open trigger question. The model draws out from here.
  return `${W3_OPEN_1}${BEAT_SEP}${W3_OPEN_2}${BEAT_SEP}${W3_REFRAME}${BEAT_SEP}${W3_TRIGGERS_LEAD} ${W3_TRIGGER_OPEN}`;
}
// How many draw-out exchanges Step 1 has had (pre-state) — gates the hand-off into the protocol.
function triggerTurnsOf(state: ConvState): number {
  const s = state.stageScratch?.triggers as { triggerTurns?: number } | undefined;
  return s?.triggerTurns ?? 0;
}
export function isTriggerHandoffTurn(state: ConvState): boolean {
  return state.stage === 'triggers' && triggerTurnsOf(state) >= TRIGGER_DRAWOUT_TURNS - 1;
}
// The three protocol moves, in order (the protocol stage walks them by scratch index).
const PROTOCOL_MOVES = ['redirect', 'reframe', 'restart'] as const;
function protocolIdxOf(state: ConvState): number {
  const s = state.stageScratch?.protocol as { moveIdx?: number } | undefined;
  return s?.moveIdx ?? 0;
}
export function protocolMove(state: ConvState): (typeof PROTOCOL_MOVES)[number] {
  return PROTOCOL_MOVES[Math.min(protocolIdxOf(state), PROTOCOL_MOVES.length - 1)]!;
}
const firstTrueLine = (c: Collected): string => (c.w3TrueLines ?? []).map((s) => (s ?? '').trim()).filter(Boolean)[0] ?? '';
const w3ImageOf = (c: Collected): string => (c.w3Image ?? '').trim();
// At the Reframe the model offers the member's real true line, propose-confirm. A short confirmation ("use it" / "that
// one") means reuse THAT line (already kept — no new keeper); anything substantial is a NEW bad-day line (harvested).
const W3_CONFIRM_OFFER_RE =
  /^(use (it|that( one)?)|that one|that works|that'?s (the one|it)|yes|yeah|yep|keep (it|that)|the first one|perfect|good|sounds good|i'?ll (use|take) (it|that)|let'?s use it)\b/i;
function resolveReframe(msg: string, c: Collected): { line: string; reused: boolean } {
  const line0 = firstTrueLine(c);
  const m = msg.trim().replace(/[.,!?]+$/, '');
  if (line0 && W3_CONFIRM_OFFER_RE.test(m)) return { line: line0, reused: true };
  return { line: msg.trim(), reused: false };
}
// A DISPUTE at the Reframe — the member says the offered line wasn't theirs ("I didn't write this / where did that come
// from"). It is NOT a new line and NOT a completion (Donna's #13: the dispute got harvested as a keeper AND skipped
// Restart). The engine recovers: own it, and re-offer their REAL line (or draw one out) — never harvest, never advance.
const W3_REFRAME_DISPUTE_RE =
  /\b(didn'?t write|did not write|not (my|mine|what i (wrote|said))|isn'?t (my|mine)|never (wrote|said)|where('?s| did| does)?\s+(that|this|it)\s+com|that'?s not (my|mine|it|my line))\b/i;
function disputesReframe(msg: string): boolean {
  return W3_REFRAME_DISPUTE_RE.test((msg ?? '').replace(/[‘’]/g, "'"));
}
// CAT-34: they AGREED and asked for a tweak ("yes, but say it shorter"). Not a dispute — don't apologise — and not
// a new line. Invite the words so we keep THEIR phrasing rather than committing the version they just amended.
function w3ReframeTweak(c: Collected): string {
  return `Good — let's get it exactly how you'd say it.${BEAT_SEP}${reframeFallback(c)}`;
}
function w3ReframeRecover(c: Collected): string {
  return `You're right — that wasn't your line, and I shouldn't have put it in your mouth. YOUR words are the ones that hold on a hard day.${BEAT_SEP}${reframeFallback(c)}`;
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

// Step 1 — DRAW OUT the triggers. The MODEL owns the questioning (reflect + ONE dig-in/widen follow-up); the engine
// NEVER appends its own question. Its reply IS the turn. After ~TRIGGER_DRAWOUT_TURNS exchanges, the (model's) turn
// names the heaviest + poses the Redirect, and the engine advances to the protocol. Fallbacks only if the model is
// empty. One question per turn — always the model's.
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
    const reply = (b.modelText ?? '').trim();
    if (turns >= TRIGGER_DRAWOUT_TURNS) {
      // enough drawn out → the model (per the hand-off note) named the heaviest + posed the Redirect. Into the protocol.
      b.stage = 'protocol';
      b.reply = reply || W3_REDIRECT;
    } else {
      // keep drawing out — the model reflected + dug in with ONE follow-up. Its turn is the reply; nothing appended.
      b.reply = reply || W3_TRIGGER_MORE;
    }
  },
  confirm(b) {
    triggersStage.gather(b);
  },
};

// Step 2 — the protocol, ONE move per turn, MODEL-DRIVEN for warmth: the model acknowledges what the member just said,
// then poses the single move — Redirect, then Reframe (offering their REAL true line), then Restart (pointing to their
// REAL picture + a gentle look-forward, so it isn't a dead end). The engine sequences + captures + harvests; it never
// appends a question. Fallbacks (with the real keeper) only if the model is empty. Reframe harvests a 'principle'
// keeper (new lines only — a reused one is already kept); the close harvests the whole protocol as a 'recovery_move'.
const protocolStage: StageDef = {
  id: 'protocol',
  mode: 'drawout',
  opener: () => W3_REDIRECT,
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    const sc = b.scratch as { moveIdx?: number };
    const idx = sc.moveIdx ?? 0;
    const msg = b.memberMessage.trim();
    const reply = (b.modelText ?? '').trim();
    // Redirect + Reframe need real substance; the Restart response (idx 2) accepts a short "ok/that helps" to close.
    if (idx < 2 && msg.length < 3) {
      b.reply = W3_TRIGGER_NUDGE;
      return;
    }
    if (idx === 0) {
      b.collected.w3Redirect = msg;
      sc.moveIdx = 1;
      // Contract 3 (injected-not-generated): the Reframe serves the member's REAL true line — deterministically, never
      // the model's improvisation, which fabricated a "line you wrote" (#13a). reframeFallback quotes their captured
      // line, or draws one out fresh when there isn't one — it never claims words they didn't write.
      b.reply = reframeFallback(b.collected);
      return;
    }
    if (idx === 1) {
      // Contract 2 (advance): a dispute is not a new line and not a completion — recover and STAY (#13b). Never harvest
      // the dispute, never skip Restart.
      if (disputesReframe(msg)) {
        b.reply = w3ReframeRecover(b.collected);
        return;
      }
      // CAT-34: agreement WITH a revision is neither a reuse (drops their change) nor a new line (would store
      // "yes, but say it shorter" as their true line). Requires BOTH signals so a real line containing "but"
      // ("I'm not broken but I'm tired") is still taken verbatim.
      if (W3_CONFIRM_OFFER_RE.test(msg.trim().replace(/[.,!?]+$/, '')) && hasRevisionTail(msg)) {
        b.reply = w3ReframeTweak(b.collected);
        return;
      }
      const r = resolveReframe(msg, b.collected);
      b.collected.w3Reframe = r.line;
      if (!r.reused) {
        b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: r.line, label: 'Your true line for a bad day' });
      }
      sc.moveIdx = 2;
      b.reply = reply || restartFallback(b.collected); // model: ack + Restart (their real picture); else fallback
      return;
    }
    // Restart answered → a warm receipt (model), then harvest the protocol (recovery_move) + Step 3 + the close.
    // The receipt is a RECEIPT, not a prompt — strip any trailing question so the close doesn't pose one it steamrolls.
    b.pendingHarvest.push({ kind: 'protocol', keeperType: 'recovery_move', destinationIntent: 'keeper', payloadRef: composeProtocol(b.collected), label: 'Your False Start Protocol' });
    const receipt = dropTrailingQuestion(reply);
    b.reply = `${receipt ? `${receipt}${BEAT_SEP}` : ''}${W3_STEP3_1}${BEAT_SEP}${W3_STEP3_2}${BEAT_SEP}${W3_CLOSE_1}${BEAT_SEP}${W3_CLOSE_2}`;
    b.stage = 'complete';
    b.complete = true;
  },
  confirm(b) {
    protocolStage.gather(b);
  },
};

// Deterministic fallbacks (used only when the model returns nothing) — still surface the member's REAL keeper.
function reframeFallback(c: Collected): string {
  const line = firstTrueLine(c);
  return line
    ? `Now Reframe — your true line for a bad day. Here's one you already wrote: “${line}” — want that as your bad-day line, or write a new one?`
    : W3_REFRAME_PROMPT;
}
function restartFallback(c: Collected): string {
  const img = w3ImageOf(c);
  return img
    ? `And Restart — when the old voice gets loud, go back to the picture you built:\n\n“${img}”\n\nSit with it a second — does it feel like enough to reach for on the hard day?`
    : `${W3_RESTART} When you picture it — does it feel like enough to reach for on the hard day?`;
}

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

// ── the live surface — the model draws out (its OWN one question per turn); the engine sequences + never appends ──
export const REWIRE_W3_SYSTEM =
  "You are the G4L Companion running the False Start Protocol, in Rewire (Phase 2). You already know this member (see " +
  "MEMBER CONTEXT). You are helping them build a plan for the day they slip — BEFORE it happens. Core posture: a false " +
  "start is NOT failure; it's the expected cost of change — normalize it, never judge, grade, or scold. Plain, warm, " +
  "measured — a real conversation, not a form. HOW YOU TALK (hard rules): (1) ONE question per turn — your reply ends " +
  "with a single question; never stack two. (2) DRAW THEM OUT — reflect what they just said, specifically and in their " +
  "words, then DIG IN: your one question goes DEEPER into what they raised, or opens a genuinely new angle — you are " +
  "curious about THEM, not covering a checklist. (3) DON'T ENUMERATE OR COUNT — never 'the second/third one', never a " +
  "list to work through. (4) Reflect SPARINGLY — don't open every turn with the same validation tic ('makes complete " +
  "sense', 'completely heard'); vary it. This session PULLS THEIR PRIOR TOOLS FORWARD: at the Reframe, offer the true " +
  "lines they wrote before; at the Restart, point them to the picture they built (both in MEMBER CONTEXT) — adapt " +
  "gracefully if a tool isn't there. (5) RECALL VERBATIM (W-23): when you surface a prior tool, QUOTE THEIR EXACT " +
  "WORDS from MEMBER CONTEXT — never paraphrase or generalize ('the picture you built', 'that line you wrote'). Say " +
  "the actual words back, in quotes, in their own first-person voice — 'go back to the line you wrote: \"[their exact " +
  "line]\"'. Hearing their OWN words at the moment of a slip is the whole point. NAMES: never say 'W1'/'W2'/'W3' — refer to earlier work descriptively. If a " +
  "distress or crisis signal appears, drop the exercise and route to support (988 US / local) and a human — always on.";

// Exported for the W-23 regression test — proves the member's prior-session keepers reach the model VERBATIM.
export function w3Context(c: Collected): string {
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
  const c = state.collected;
  if (state.stage === 'protocol') {
    const move = protocolMove(state);
    // move === 'redirect' means the member just ANSWERED the Redirect → acknowledge + pose the Reframe. Etc.
    if (move === 'redirect') {
      const line = firstTrueLine(c);
      return (
        "\n\nRIGHT NOW: the member just gave their REDIRECT (what they'll do instead). Acknowledge it warmly and " +
        "specifically in a line, then pose the second move — NAME IT, open with 'Reframe —' so they see the step — as " +
        "your single question: " +
        (line
          ? `offer THIS line they already wrote, verbatim — "Reframe: here's a line you wrote: '${line}' — want that as your bad-day line, or write your own?"`
          : "ask for a true line for a bad day — a slip is the cost of changing, not proof they can't; invite them to write it their way.")
      );
    }
    if (move === 'reframe') {
      const img = w3ImageOf(c);
      return (
        "\n\nRIGHT NOW: the member just gave their bad-day line. Acknowledge it warmly in a line (don't rewrite it), " +
        "then pose the third move — NAME IT, open with 'Restart —' so they see the step: " +
        (img
          ? `point them to the picture they built, quoting it: "Restart: when the old voice gets loud, go back to this — '${img}'." Then invite them to sit with it (a gentle question so it's not a dead end — e.g. does it feel like enough to reach for?).`
          : "remind them to go back to the picture they built of where they're headed, and invite them to sit with it (a gentle question so it's not a dead end).")
      );
    }
    return "\n\nRIGHT NOW: the member is responding to the Restart. Receive their reaction warmly in ONE line — no new question; you're about to close.";
  }
  if (isTriggerHandoffTurn(state))
    return (
      "\n\nRIGHT NOW: you've drawn out enough triggers — do NOT ask for another. Reflect briefly, name the ONE or TWO " +
      "that seem heaviest (their words), then move into building THEIR PROTOCOL. Tell them it's THREE MOVES — Redirect, " +
      "Reframe, Restart — so they see the shape, then pose the first: NAME IT, open with 'Redirect —' — what do you do " +
      "INSTEAD when that moment hits (the five-minute rule: start, and if you still want to quit after five, quit; or a " +
      "specific swap — walk the block, call someone, leave the room)."
    );
  return (
    "\n\nRIGHT NOW: the member just named a trigger. Reflect it warmly and specifically (their words, the real cost), " +
    "then DIG IN with your single question — go DEEPER into what they just raised, or open a genuinely new angle that " +
    `hasn't come up. Areas for YOUR guidance only (never list or count them to the member): ${W3_TRIGGER_AREAS} Offer ` +
    "a couple of concrete examples in the question if it helps them answer."
  );
}

export async function liveTurnRewireW3(state: ConvState, history: ConvMessage[], memberMessage: string): Promise<Turn> {
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

// ══ R4 · The Rewire Checkpoint ════════════════════════════════════════════════════════════════════════════════
// The Phase-2 close: an ADMINISTERED beat (6 Commitment items, 1–5, deterministic — instrument fidelity, same as the
// IDQ/§2e read) on the shared administeredStage() factory, then a hold into the ceremony (the reveal overlay fires
// from the chat). The ACTION scores the Commitment component (Ave1→Ave2) + writes the Checkpoint grinta_reading + sets
// the rewire_checkpoint_passed gate. Items VERBATIM (CHECKPOINT_COMMITMENT_ITEMS). Copy: R4 doc (frame is ours).
const W3_CHECKPOINT_OPEN =
  "You just did the real work of Rewire — you caught the lies, built the picture, wrote the protocol. Before we close " +
  "the Phase, a quick read on where your commitment sits now. Six of these, one to five. No passing score — just an " +
  "honest gauge of what you're building.";
const W3_CHECKPOINT_CLOSE = "That's the read. Hold on — let me show you what it means.";
function rewireCheckpointDeliver(index: number): string {
  return grintaStem(CHECKPOINT_COMMITMENT_ITEMS[index]!);
}
function rewireCheckpointOpener(): string {
  return `${W3_CHECKPOINT_OPEN}\n\n${rewireCheckpointDeliver(0)}`;
}

const rewireCheckpointStage: StageDef = administeredStage({
  id: 'checkpoint',
  itemCount: CHECKPOINT_COMMITMENT_ITEMS.length, // 6
  minLabel: 'not at all', // W-24: chip anchors — the frozen Grinta 1–5 poles
  maxLabel: 'completely',
  opener: () => rewireCheckpointOpener(),
  deliverItem: (n) => rewireCheckpointDeliver(n),
  reprompt: (n) => `Just a number, 1 to 5 — how true does that feel right now?\n\n${rewireCheckpointDeliver(n)}`,
  onComplete: (b) => {
    // The 6 commitment items are in b.administeredResponses. Hand into the ceremony; the ACTION scores + persists the
    // Checkpoint reading (Commitment component Ave1→Ave2) and sets the phase gate.
    b.stage = 'ceremony';
    b.reply = W3_CHECKPOINT_CLOSE;
  },
});

// The ceremony terminal — the conversational engine only LANDS here; the reveal is a full-screen overlay the chat
// fires on stage === 'ceremony'. This stage just holds (defensive).
const REWIRE_CEREMONY_LEAD = 'Hold on — let me show you what you just built.';
const rewireCeremonyStage: StageDef = {
  id: 'ceremony',
  mode: 'drawout',
  opener: () => REWIRE_CEREMONY_LEAD,
  offersSubstance: () => true,
  gather(b) {
    b.reply = REWIRE_CEREMONY_LEAD;
  },
  confirm(b) {
    b.reply = REWIRE_CEREMONY_LEAD;
  },
};

export const REWIRE_CHECKPOINT_ARC: ArcConfig = {
  id: 'rewire-checkpoint',
  stageOrder: ['checkpoint', 'ceremony'],
  stages: { checkpoint: rewireCheckpointStage, ceremony: rewireCeremonyStage },
  onComplete: () => REWIRE_CEREMONY_LEAD,
};

export function applyRewireCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_CHECKPOINT_ARC, state, history, memberMessage, model);
}

export function rewireCheckpointOpening(): Turn {
  return { reply: rewireCheckpointOpener(), state: { stage: 'checkpoint', collected: {} }, complete: false, expects: scaleExpects(REWIRE_CHECKPOINT_ARC, 'checkpoint', false) };
}

// The Checkpoint is ADMINISTERED (deterministic Likert parse) — no model call needed. The action passes empty text.
export function liveTurnRewireCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRewireCheckpointTurn(state, history, memberMessage, { text: '' });
}
