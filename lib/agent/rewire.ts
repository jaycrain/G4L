// Rewire (v2.3, Phase 2 — Commitment/Mindfulness). Config #3 on the shared arc kernel (runArcTurn). Spec of record:
// G4L_Rewire_W1_Copy_v0.1.md (Jay-approved) + G4L_Rewire_Build_Approach_v0.1.md. Builds on the Reconnect engine.
// SLICE 1 = W1 — The Disinformation Audit. Structure: opening story (Jay, third-person) → the frame (roadmap +
// payoff) → the FIVE domains walked one at a time (body · habits · time · who-you-are · what's-still-possible),
// surfacing a self-lie in each → NAME THE CAMPAIGN (the model reflects the whole set back as a reveal) → the TURN,
// GUIDED one at a time (the Companion picks the lie that hit heaviest FROM THE MEMBER'S OWN WORDS and asks for its
// true line; then "another, or is that your one?") → each true line harvested as a Playbook keeper → close.
// Flag-gated by REWIRE (Decision JJ) — OFF by default; prod keeps the v1 static Rewire until the v2.3 flip.
// COPY: final, Jay-approved. "Jay" stays third-person, named (founder presence).

import { runArcTurn, administeredStage, engagementStage, engagementOpening, checkpointEngagement, AGREEMENT_1_5, AGREEMENT_1_5_HINT, scaleExpects, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import { isMemberContent, isDeclineReply } from './member-turn.ts';
import { isConversationalMeta, isAboutTheApp } from './conversational-meta.ts';
import { memberClosingReclaim } from './onboarding-intent.ts';
import { identityLabel } from '../member/identity.ts';
import { consolidateReclaimList } from '../member/reclaim.ts';
import { grintaStem, CHECKPOINT_COMMITMENT_ITEMS } from '../grinta/survey/instrument.ts';
import { BEAT_SEP, type Collected, type ConvMessage, type ConvState, type ModelTurn, type Turn } from './onboarding.ts';
import { hasRevisionTail } from './onboarding-intent.ts';
import { SESSION_LIMITS } from './session-limits.ts';
import { MEMBER_AGENT_GOVERNED_CORE } from './system-prompt.ts';

export function rewireEnabled(): boolean {
  return process.env.REWIRE === 'staged';
}

// W-18: the arc appends its scripted question beat AFTER the model's reflection. But when the model ran ahead and
// already asked its own question, appending ours double-bubbles (both asking). Suppress the scripted beat when the
// model's reflection already ends its last paragraph with a question — the same "model reflects, engine asks, never
// both" discipline as onboarding's withQuestion, BEAT_SEP-aware. Pure + testable.
// BEAT_SEP-AWARE FOR REAL (2026-08-27). The comment above has claimed this since W-18; the code only ever split on
// blank lines, so a model turn whose question sat in an earlier BEAT_SEP bubble read as "no question" and got ours
// appended anyway. Splitting on both is what the rule always said.
export function withScriptedBeat(reflected: string, scripted: string): string {
  const t = (reflected ?? '').trim();
  if (!t) return scripted;
  const parts = t.split(BEAT_SEP).flatMap((p) => p.split(/\n\s*\n/)).map((s) => s.trim()).filter(Boolean);
  const lastPara = parts[parts.length - 1] ?? t;
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
// THE FALLBACK MUST NOT COUNT EITHER. "Every one of those" asserts that all five answers were lies, which is the
// same claim the model made and the same one Jay pushed back on. It hedges to the ones that were.
const W1_CAMPAIGN =
  `Now look at what you just laid out. The ones that sound most reasonable are the trick — they keep you exactly ` +
  `where you are. That's not weakness; it's the campaign, running on autopilot. You just made it visible — and ` +
  `that's the first real move.`;
// The turn is GUIDED and model-driven (picks the heaviest lie in the member's own words). This fallback runs only if
// the model returns nothing — a clear single ask, still member-picked.
export const W1_TURN_ASK_FALLBACK =
  // ONE ASK (Jay, 2026-08-25). This was two: "start with the one that hit you hardest" invites a PICK, and
  // "what's the honest line" asks for the counter. He answered the first — reasonably — and the affirm stage
  // harvests any substantive message as a true line, so his own excuse was filed as the principle that
  // answers it. The model had understood him correctly and moved on to ask for the line; only the engine
  // thought the beat was already done. Now the sentence asks for exactly one thing: the line.
  "What's the honest line you'd put in place of the one that hit you hardest?";
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
      //
      // THE HANDOFF MUST ASK (Donna's walk, 2026-08-27). This branch took the model's turn VERBATIM. Hers reflected,
      // named the campaign, seeded the line, named the costliest lie — and then stopped, with no question. The stage
      // advanced to 'affirm', which waits for a true line she had not been asked for: "What am I supposed to do here?"
      //
      // The guard already existed ONE LINE ABOVE, on the other four domains. This is the same rule and it simply was
      // not applied to the fifth — the beat that hands into a stage that WAITS. Any beat that advances the member into
      // a stage expecting their answer has to end asking for it.
      b.stage = 'affirm';
      const handoff = (reflected || '').trim();
      b.reply = handoff ? withScriptedBeat(handoff, W1_TURN_ASK_FALLBACK) : `${W1_CAMPAIGN}${BEAT_SEP}${W1_TURN_ASK_FALLBACK}`;
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
    if (!isMemberContent(line)) {
      b.reply = (b.modelText ?? '').trim() || W1_AFFIRM_ACK;
      return;
    }
    b.pendingHarvest.push({ kind: 'affirmation', keeperType: 'principle', destinationIntent: 'keeper', payloadRef: line, label: 'Your true line' });
    const ack = (b.modelText ?? '').trim();
    const linesSoFar = (b.pendingHarvest ?? []).filter((h) => h.kind === 'affirmation').length;
    // If the model WRAPPED instead of serving the next lie (a declarative ack — no question) once they've put down a
    // couple of lines, take that as the close: deliver the model's wrap + W1_CLOSE on THIS turn, rather than stranding
    // a dead "ok" the member has to send to get the summary. Mirrors the draw-out "declarative past the floor advances"
    // rule. When the model asks ANYTHING (offering the next lie), stay guided and keep going.
    //
    // ANY QUESTION, NOT A TRAILING ONE (Jay, 2026-08-25). This tested `/\?\s*$/` — the question mark had to be the last
    // character. His model turn read "So what's the true line? The honest answer to '…' — in your words, not mine."
    // The question is there; it simply is not last. So the engine read a live ask as a wrap, fired W1_CLOSE, awarded
    // the badge and set complete — CLOSING THE SESSION WHILE THE COMPANION WAS STILL ASKING HIM SOMETHING.
    //
    // The asymmetry decides the rule. A false wrap costs the member the rest of a Session and commits a keeper they
    // never confirmed. A false NOT-wrap costs one extra turn. So any '?' anywhere means keep going. This is also what
    // the comment above always claimed the rule was; only the regex disagreed.
    const modelWrapped = ack.length > 0 && !ack.includes('?');
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
// GOVERNED (2026-08-26). Reconnect has always prepended the shared block; Rewire never did, so all NINE of its
// rules were absent here — privacy, never-name-a-real-person, never-infer-gender, the AI-tell word list, the
// locked vocabulary, identity-is-not-an-address, what-you-are, reflect-and-route, never-narrate-the-machinery.
// Each was written because it had already happened once to a real member. The costliest is privacy: this Session
// could be asked "is this private?" and had no authorised answer.
//
// The CORE, not the whole block: the AI-disclosure trailer is excluded because it instructs the Companion to open
// with the disclosure, which is right on a member's first turn and wrong forty minutes into Rewire.
//
// ORDER IS LOAD-BEARING FOR CACHING. The governed core leads and the Session's own text follows, so the whole
// prefix is byte-identical on every turn of a Session and caches as one unit. Anything that varies per turn
// (context, stage note, carry-forward) is a SEPARATE system block after the breakpoint — see the call sites.
const REWIRE_W1_SYSTEM =
  MEMBER_AGENT_GOVERNED_CORE + '\n\n' +
  "You are the G4L Companion running W1, the Disinformation Audit, in Rewire (Phase 2). The member is naming the " +
  "comfortable LIES they tell themselves across five life domains (body, habits, time, who they are, what's still " +
  // NOT EVERY DOMAIN YIELDS A LIE, and saying otherwise is the fastest way to lose a member's trust in the
  // instrument. Jay walked the five and answered several with the truth — "I'm still in there", "I can ride
  // better than I ever have" — and was told "Five lies named." He said: "This was confusing, I didn't answer
  // these with lies."
  //
  // The model already half-knew: its very next turn said "that one doesn't need a counter, it already is the
  // true line." So it can tell the difference; nothing told it it was ALLOWED to. The Session walks five places
  // a lie can hide, which is not a promise that five are hiding there.
  // NO TALLIES (Jay, 2026-08-28: "counting seems problematic programmatically and doesn't have enough value").
  // It announced "Five lies named" over answers that were not lies, and when he corrected one it recounted to
  // "four lies named, four true lines put to them" — still wrong, because it had already conceded a second one
  // two turns earlier. A model doing arithmetic mid-conversation will keep getting it slightly wrong, and the
  // number adds nothing: what he needs is which lines are his, not how many.
  "NEVER COUNT. Do not tell the member how many lies they named, how many true lines they wrote, or how many of " +
  "anything they have done — no tallies, no \"that's four\", no \"three down\". Name the things themselves, in " +
  "their words. If a total genuinely matters the engine will state it; you never do. " +
  "REDIRECT IS A SUBSTITUTE, NOT A TEMPTATION. It is the thing they DO INSTEAD when the pull hits — walk the " +
  "block, five minutes of the work, call someone, leave the room. If they answer with the thing they are pulled " +
  "TOWARD (\"a cocktail\", \"the wrong food\", \"scrolling\"), they have named the pull, not the move: say so " +
  "plainly in one line, thank them for naming it, and ask what they would do instead when it hits. Never accept " +
  "a temptation as the Redirect and never write the substitute for them. " +
  "A DOMAIN MAY HOLD NO LIE. Some answers are already true lines — said plainly, with no flinch. When that " +
  "happens, say so and move on: name it as the true line it is, never call it a lie, and never manufacture a " +
  "counter for something that does not need one. Count only what was actually a lie; never assert a number of " +
  "lies the member did not name. " +
  "possible). Never judge, grade, praise, or diagnose; a self-lie is a hundred reasonable decisions, not a failing — " +
  "normalize it. Reflect their WORDS back; never state who they ARE as a fact (no identity verdicts like 'that's a " +
  "man who stopped believing he's allowed to want anything' — W-39) — if you name a pattern, offer it as a check " +
  "they can reject, in their own words. Plain, measured, no hype. Do NOT write the member's counter-line for them (that's their work at the " +
  "turn). STAY ON THIS SESSION'S JOB — it catches self-lies, nothing else. If the member veers into domain detail (training specifics, work logistics), acknowledge it in ONE line, then steer back: \"That's real — and worth its own ride sometime. Right now, let's stay with the story you tell yourself — that's the one we're here to catch.\" Never turn the session into domain coaching or technical analysis. " +
  "If a distress or crisis signal appears, drop the exercise and route to support (988 US / local) and a " +
  "human — always on." + SESSION_LIMITS;

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
      "MEMBER CONTEXT; echo a few of their OWN words), so it lands as 'you already do this.' (4) NAME the one lie " +
      "that costs them most, in their own words, and ask ONLY for its true line. Do NOT ask them which lie to " +
      "start with — you pick it. A compound ask ('which one, and what's its counter?') gets answered with the " +
      "LIE, and the next beat files that answer as their true line. Warm; use only their real words; no identity " +
      "verdicts (reflect what they said, don't declare who they are)."
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

/** @param carryForward What upstream assets retained (lib/curriculum/retention.ts), rendered, or null. Passed in
 *  rather than read here so the engine stays pure and replayable; null must add NOTHING — an absent upstream is a
 *  member's choice about order, never a gap to name. See liveTurnRebuildB3 for the full note. */
export async function liveTurnRewire(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
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
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own instructions are byte-identical
    // on every turn, so they go in the FIRST system block with the breakpoint on it; the member's context, the
    // stage note and any carry-forward change per turn and go in a SECOND block after it. Caching is a prefix
    // match — a single varying byte inside the cached block would invalidate it on every turn and we would pay
    // the 1.25x write premium for nothing.
    //
    // THE BLOCK IS WHAT MAKES CACHING POSSIBLE, WHICH IS THE INVERSION WORTH KNOWING. Sonnet 4.6 will not cache a
    // prefix under 2048 tokens; these prompts were ~650 and therefore uncacheable. Governed, they are ~4700 —
    // over the line. Adding the rules makes a Session CHEAPER than it was ungoverned: the first turn pays 1.25x
    // to write, every turn after reads at 0.1x.
    system: [
      { type: 'text' as const, text: REWIRE_W1_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: w1Context(state.collected) + rewireStageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
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
  `it for a second — that's what the work is for. Keep it. When you're ready, tell me how that feels.`;
// ── The practice — the week + the W1 connection ──
const W2_PRACTICE_1 =
  `Here's your work this week, and it's small: five minutes each morning with that image. Close your eyes, make ` +
  `it vivid — the light, the effort, the feeling. Don't rush it.` + BEAT_SEP +
  // POINTS AT THE WEEK, because as of 2026-08-26 there IS one. W2's week had no grid at all — excluded on the
  // reasoning that "five minutes in a picture is not countable" — so this close asked for a daily practice and
  // named nowhere to record it, and it was the one Session that opened a week it never mentioned. Same sentence
  // shape as W3's, deliberately: a member meets this instruction four times across the program and should not
  // have to re-learn it each time.
  `Open This week in your Playbook and tick the days you do it — five in a row is the whole ask.`;
const W2_PRACTICE_2 =
  `And here's where it meets last session: when the old voice starts up — "this is stupid," "it'll never happen" — ` +
  `you go back to the image. The lie is a story. The image is real — you built it from your own life. That's the ` +
  `whole move: the true line answers the lie, the image outlasts it.`;
const W2_PRACTICE_3 =
  `Add a little more detail each day. By the end of the week, you should be able to close your eyes and step right ` +
  `into it.`;
// ── Close — harvest ──
// NO SAVE CLAIM HERE — the keeper card that follows is what saves it.
//
// Donna, 2026-08-22, item 19: this said "I've saved your picture to your Playbook — there whenever you want it",
// and then the very next beat offered "One thing from today, if you want to keep it" with a keep/discard card.
// The Companion announced the save, then asked permission for it. Her words: it "undermines trust in what the app
// is actually doing and confuses the member about whether the content is saved or still pending a decision."
//
// The claim was also simply FALSE. Nothing is written at this point; the keeper card is the write path, so a
// member who tapped Delete had just been told it was already kept.
//
// THE CLAIMS GATE DOES NOT COVER THIS, and that is the useful part. gate-claims stops the MODEL announcing an
// outcome the engine owns — this is AUTHORED copy, reviewed by a person, which is precisely how it got past. Same
// fault, different author.
//
// W1 ALREADY HAD THIS SHAPE AND WAS ALREADY FIXED (see W1_CLOSE above — its save claim came out on 2026-07-26,
// leaving only the value statement). This is the second occurrence, so it is fixed the same way rather than
// reworded: state what she now HAS, claim nothing about where it lives.
const W2_CLOSE =
  `You've got both tools now: the lines that answer the lies, and the image that's stronger than them. ` +
  `That's Rewire starting to hold.`;

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
    // NEVER DROP WHAT THEY GAVE YOU. This beat's opener ends "When you're ready, tell me how that feels" — an explicit
    // ask — and this handler used to compose the picture from what was ALREADY collected without ever reading
    // b.memberMessage. So the answer to the last and most inviting question in the session was discarded. On Jay's
    // walk that cost the richest thing he said: "The energy of a thousand other racers around me and them behind the
    // barriers cheering. The noise, I love that noise and anticipation" — while "Big Sugar for sure" and "No, the
    // Starting Line" made the card ("Should have probably pulled this one").
    //
    // A beat that asks a question owns the answer. isMemberContent keeps it from swallowing a bare reaction ("wow",
    // "that's powerful") as scene material, and is biased to keep, so real detail always lands.
    // FILTERED PER PIECE, NOT AT THE END (Jay's walk, 2026-08-25). The picture is COMPOSED from every message
    // this beat collects, and the harvest seam's guard (harvest.ts) only ever sees the finished join. His card
    // read "Big Sugar Sorry, I thought that was on my Reclaim List. It's a gravel race I'm signed up for in
    // October Can you add it to my list?" — a destination, an apology and a request to the Companion, welded
    // into one sentence and offered back as the scene he had built.
    //
    // Filtering the JOIN cannot work: it would drop "Big Sugar" and the race along with the request. The check
    // has to happen where the pieces are still separate, which is here. Real content survives, the housekeeping
    // does not, and a mixed line is KEPT — losing a member's own detail is the more expensive mistake.
    const lastPiece = (b.memberMessage ?? '').trim();
    if (isMemberContent(lastPiece) && !isConversationalMeta(lastPiece) && !isAboutTheApp(lastPiece)) {
      (b.collected.w2Image ??= []).push(lastPiece);
    }
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
  MEMBER_AGENT_GOVERNED_CORE + '\n\n' +
  "You are the G4L Companion running W2, the Visualization Workshop, in Rewire (Phase 2). You already know this " +
  "member (see MEMBER CONTEXT) — never say you don't. You are helping them build ONE vivid, aspirational mental " +
  "image: themselves at the moment they get back something they named they want. Plain, measured, warm; never judge, " +
  "grade, praise, diagnose, or over-promise. Draw out — reflect in THEIR words, one question at a time; let them set " +
  "the depth. Do NOT invent details they didn't give; make what they DID give a touch more vivid. If a distress or " +
  "crisis signal appears, drop the exercise and route to support (988 US / local) and a human — always on." + SESSION_LIMITS;

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

/** @param carryForward What upstream assets retained (lib/curriculum/retention.ts), rendered, or null. Passed in
 *  rather than read here so the engine stays pure and replayable; null must add NOTHING — an absent upstream is a
 *  member's choice about order, never a gap to name. See liveTurnRebuildB3 for the full note. */
export async function liveTurnRewireW2(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
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
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own instructions are byte-identical
    // on every turn, so they go in the FIRST system block with the breakpoint on it; the member's context, the
    // stage note and any carry-forward change per turn and go in a SECOND block after it. Caching is a prefix
    // match — a single varying byte inside the cached block would invalidate it on every turn and we would pay
    // the 1.25x write premium for nothing.
    //
    // THE BLOCK IS WHAT MAKES CACHING POSSIBLE, WHICH IS THE INVERSION WORTH KNOWING. Sonnet 4.6 will not cache a
    // prefix under 2048 tokens; these prompts were ~650 and therefore uncacheable. Governed, they are ~4700 —
    // over the line. Adding the rules makes a Session CHEAPER than it was ungoverned: the first turn pays 1.25x
    // to write, every turn after reads at 0.1x.
    system: [
      { type: 'text' as const, text: REWIRE_W2_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: w2Context(state.collected) + rewireW2StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
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
//
// THE THREE MOVE NAMES ARE BOLD, ALL THREE (Jay, mid-walk 2026-08-25). Only Redirect was, and not because anyone
// styled it: the MODEL wrote that beat and bolded the label itself, while Reframe and Restart come through as
// scripted strings and arrived plain. So the protocol read as one named move followed by two paragraphs, when it
// is one move in three parts -- and Redirect/Reframe/Restart is vocabulary the member is meant to carry out of
// here and run under pressure. A name you are supposed to remember should look the same every time it appears.
const W3_PROTOCOL_INTRO = `Now we write the plan — for the trigger that gets you most. Three moves.`;
export const W3_REDIRECT =
  `First, **Redirect —** the thing you do instead. When you don't want to do the work, the rule is five minutes: start, ` +
  `and if you still want to quit after five, quit. (Usually you won't.) When it's food, name the specific swap — walk ` +
  `the block, call someone, leave the room. What's yours?`;
export const W3_REFRAME_PROMPT =
  `Now **Reframe —** the true line for a bad day. You've written lines that answer your lies before; here's one for a ` +
  `slip: "A false start is the cost of changing, not proof I can't." Say it your way.`;
export const W3_RESTART =
  `And **Restart —** when the old voice gets loud, you go back to the picture you built of where you're headed, standing ` +
  `in the goal you named. The campaign can't compete with a picture that real.`;
// ── Step 3 — The week of noticing (the week is logged in the Playbook's "This week" tab, moved there 2026-08-08) ──
const W3_STEP3_1 =
  `Here's your work this week: don't try to change anything yet. Just notice. Open This week in your Playbook ` +
  `every day and log your good calls, your false starts and the on-track days where not much happened.`;
const W3_STEP3_2 =
  `And when a false start happens — it will — run your protocol. Redirect, Reframe, Restart.`;
// ── STAGE 3 + STAGE 4 — the expectations, then the commitment (Greg's W3-29, W3-26, W3-30) ──────────────────
//
// NONE OF THIS EXISTED until 2026-08-22. The protocol finished and a tracking grid simply appeared: she was never
// asked whether she was willing, never told when to check in, never told that forgetting is normal. Checked ask by
// ask against his memos — all of Stage 3 and Stage 4 was absent.
//
// HIS WORDS, because the asks are the instrument. Stage 4's three are quoted from the Companion memo; Stage 3's
// three expectations are his phrasing tightened to fit one beat.
const W3_STAGE3 =
  `Before you start — three things, so the week is what it's meant to be.${BEAT_SEP}` +
  `Consistency beats completeness: a day with one line on it counts. A false start is data, not failure — you're ` +
  `collecting information about your own week, not grading it. And forgetting a day is normal. It isn't a broken ` +
  `streak, because there's no streak to break.`;
const W3_WILLING = `Are you willing to track this for the next week — not perfectly, just consistently?`;
// The cue. This is the one that fills the week's first row with HER words rather than our label.
const W3_CUE_ASK = `When would be a natural time for you to check in on your day?`;
const W3_CUE_NUDGE =
  `Anything that already happens daily works — the kettle, the drive home, lights out. What's yours?`;
// Stage 4's closing frame + the missed-day backup (W3-30), stated rather than asked: she has answered enough.
const W3_BOTH_DATA =
  `Good — that's your cue.${BEAT_SEP}You're tracking Smart Choices and False Starts. Both are data. Neither is a ` +
  `verdict. And if you miss the cue, you pick it up at the next one — you don't start the week again.`;
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
/**
 * SHE NAMED THE ARTIFACT INSTEAD OF WRITING ONE — a third way to accept the offer.
 *
 * DONNA, 2026-08-22: her stored Reframe came out as *"Let's use the true line that goes with that instead."*
 * That is her telling the Companion which line to use, saved as the line itself — while her real true line sat
 * in `collected`, offered and ignored.
 *
 * Neither existing test could catch it. W3_CONFIRM_OFFER_RE enumerates ways of saying yes and hers is not on the
 * list (it never will be — that is what the second test is for). And `isMemberContent` reads it as substantive,
 * which it is: it is a whole sentence with a preference in it. Substantive prose is exactly what a NEW line looks
 * like, so the fallback stored it.
 *
 * THE TELL IS OUR OWN VOCABULARY IN HER ANSWER. "The true line" is what WE call the artifact. A member writing
 * her actual bad-day line does not name the form — she writes the line. So a message that REFERS to the thing
 * and expresses a choice about it is an instruction, not content.
 *
 * The same shape ran through her Reclaim List the same day ("we need to make a change to how the Reclaim List is
 * populated", stored as something she wanted back), which is what makes this worth generalising rather than
 * adding one more phrase to the yes-list.
 *
 * BOTH HALVES ARE REQUIRED, deliberately. "My true line is that I can start today" names the artifact but is
 * plainly giving the line, and carries no directive — it stays a new line.
 */
const NAMES_THE_ARTIFACT = /\b(true line|that line|the line|the other one|the first one)\b/i;
const DIRECTS_A_CHOICE = /\b(use|using|go with|pick|choose|keep|prefer|instead|rather)\b/i;
function refersToTheOfferedLine(msg: string): boolean {
  const t = (msg ?? '').trim();
  return NAMES_THE_ARTIFACT.test(t) && DIRECTS_A_CHOICE.test(t);
}

/**
 * AN APPRAISAL OF OUR OFFER, BY ITS GRAMMAR — not by another list of phrasings.
 *
 * Jay's walk: offered his own true line and asked "want that as your bad-day line, or write a new one?", he
 * answered "That would motivate me". Stored as his new line, harvested as a keeper, and printed into his False
 * Start Protocol and this week's tracker: "I reframed — That would motivate me."
 *
 * It cleared all three existing tests. The resolver's own comment predicted this — "one list of 'yes' phrasings
 * will always be incomplete… patching the list would be the third fix of this shape today". His is the fourth.
 *
 * So this reads STRUCTURE instead. A bad-day line is something you say TO YOURSELF — first person or imperative.
 * A reply that opens with a bare demonstrative subject and a modal or copula ("that would…", "it works",
 * "this helps") is a sentence ABOUT our offer, which is an acceptance of it. The grammar is the tell, and it does
 * not need to be enumerated:
 *   "That would motivate me"          → subject = our line       → acceptance
 *   "It works"                        → subject = our line       → acceptance
 *   "That version of me is still here" → next word is a noun     → a real line, untouched
 */
const APPRAISES_THE_OFFER = /^(that|this|it)\s+(would|will|could|can|does|do|is|isn'?t|was|works?|helps?|sounds?|feels?|fits?)\b/i;

function resolveReframe(msg: string, c: Collected): { line: string; reused: boolean } {
  const line0 = firstTrueLine(c);
  const m = msg.trim().replace(/[.,!?]+$/, '');
  // TWO TESTS, because one list of "yes" phrasings will always be incomplete. W3_CONFIRM_OFFER_RE enumerates the
  // ways a member accepts an offer — "use it", "that one", "perfect", "sounds good" — and Jay said "I like it",
  // which was not on it. So his acceptance was read as a NEW bad-day line and stored, and harvested as a keeper
  // ("Reframe — 'I like it'" on his card, 2026-08-11).
  //
  // Patching the list would be the third fix of this shape today. The general truth underneath it: a reply that
  // carries no content of its own CANNOT be a new true line. If there is a line on the table and they answered with
  // a reaction, they accepted it. So the enumeration stays for the phrasings it gets right, and isMemberContent —
  // the same vocabulary W1 and W2 now use — covers everything it doesn't.
  if (line0 && (W3_CONFIRM_OFFER_RE.test(m) || refersToTheOfferedLine(msg) || APPRAISES_THE_OFFER.test(m) || !isMemberContent(msg))) {
    return { line: line0, reused: true };
  }
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
    // RESTART CARRIES HER PICTURE (2026-08-22). This line was hard-coded — the same sentence for every member, on
    // the one move whose entire mechanism is a SPECIFIC image. Greg: "go back to the image from the Visualization
    // Workshop. The person you're becoming. The scene. The feeling." Her scene is in w3Image, from W2, and was
    // never used here. The generic line survives as the fallback for a member whose W2 image did not capture — a
    // Restart with no image is still a Restart — but it stops being what everyone gets.
    w3ImageOf(c) ? `Restart — go back to ${w3ImageOf(c)}` : 'Restart — go back to your picture, standing in the goal you named.',
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
      //
      // AND THE FRAME LEADS. W3_PROTOCOL_INTRO — "Now we write the plan … Three moves." — was written for this
      // exact moment and had ZERO readers, so the member came out of the trigger draw-out straight into "First,
      // **Redirect** —" with nothing saying a plan had started or that there were three parts to it. The three
      // move names are vocabulary he is meant to carry out of here and run under pressure; announcing that there
      // are three is what makes them a set rather than three paragraphs.
      // Same shape as the identity chips: authored copy that exists, is right, and cannot be reached.
      b.stage = 'protocol';
      b.reply = `${W3_PROTOCOL_INTRO}${BEAT_SEP}${reply || W3_REDIRECT}`;
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
      // REDIRECT IS THE THING YOU DO INSTEAD — and Jay's stored protocol reads "Redirect — A cocktail or the
      // wrong food", which is what he'd be redirecting AWAY from. His recovery move, on his card and in his
      // weekly tracker, is the thing he is recovering from.
      //
      // The engine cannot judge whether a phrase is a substitute or a temptation, and a keyword list of vices is
      // exactly the shape that has failed four times at the Reframe. So the ENGINE stores what it is given and
      // the MODEL is told to catch it — see the W3 steering, which now names this case and tells it to reflect
      // and re-ask rather than accept a temptation as a swap. If the model misses it, the member still owns the
      // words; what we must not do is invent a swap they did not name.
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
      // No line on the table AND nothing in what they wrote — re-offer rather than keep a reaction as their bad-day
      // line. Without this the same reaction still lands whenever W1 left no true line to reuse.
      if (!isMemberContent(msg) && !firstTrueLine(b.collected)) {
        b.reply = reframeFallback(b.collected);
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
    // Step 3 (the monitoring target) then STAGE 3 (the expectations) and the first of Stage 4's asks. The close no
    // longer fires here — she is asked to commit before the week starts, which is Greg's order and was missing.
    b.reply = `${receipt ? `${receipt}${BEAT_SEP}` : ''}${W3_STEP3_1}${BEAT_SEP}${W3_STEP3_2}${BEAT_SEP}${W3_STAGE3}${BEAT_SEP}${W3_WILLING}`;
    b.stage = 'commit';
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
    ? `And Restart — when the old voice gets loud, go back to the picture you built:\n\n“${img}”\n\nGive it a second — does it feel like enough to reach for on the hard day?`
    : `${W3_RESTART} When you picture it — does it feel like enough to reach for on the hard day?`;
}

// STAGE 4 — the commitment turn. Two member answers: willing, then WHEN.
//
// IT NEVER BLOCKS HER, which is the same rule as the Doors board (#7) and the Independence Guarantee. "No" to the
// willingness ask is a real answer and the week still opens — a member who says she cannot commit to a week is
// telling us something true, and refusing to continue would punish the honesty the whole product asks for.
//
// THE CUE IS CAPTURED VERBATIM. It becomes the label on the week's first row, so a rewrite here is a rewrite of
// what she said about her own day. Short answers are fine ("mornings") — that IS the cue.
const commitStage: StageDef = {
  id: 'commit',
  mode: 'drawout',
  opener: () => W3_WILLING,
  offersSubstance: (message) => message.trim().length >= 2,
  gather(b) {
    const sc = b.scratch as { asked?: boolean };
    const msg = b.memberMessage.trim();
    const reply = (b.modelText ?? '').trim();

    // Turn 1 — she answered the willingness ask. Acknowledge (model, question stripped) and ask for the cue. The
    // ENGINE poses this one rather than the model: it is a specified instrument question whose answer we store,
    // and the draw-out rule that the model owns the questions applies to exploration, not to a captured field.
    if (!sc.asked) {
      sc.asked = true;
      const ack = dropTrailingQuestion(reply);
      b.reply = `${ack ? `${ack}${BEAT_SEP}` : ''}${W3_CUE_ASK}`;
      return;
    }

    // Turn 2 — the cue itself. Anything substantive is hers; a blank or a shrug gets one nudge, never a second.
    if (msg.length < 2) {
      b.reply = W3_CUE_NUDGE;
      return;
    }
    b.collected.w3CheckInCue = msg;
    b.reply = `${W3_BOTH_DATA}${BEAT_SEP}${W3_CLOSE_1}${BEAT_SEP}${W3_CLOSE_2}`;
    b.stage = 'complete';
    b.complete = true;
  },
  confirm(b) {
    commitStage.gather(b);
  },
};

export const REWIRE_W3_ARC: ArcConfig = {
  id: 'rewire-w3',
  stageOrder: ['triggers', 'protocol', 'commit'],
  stages: { triggers: triggersStage, protocol: protocolStage, commit: commitStage },
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
  MEMBER_AGENT_GOVERNED_CORE + '\n\n' +
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
  "distress or crisis signal appears, drop the exercise and route to support (988 US / local) and a human — always on." + SESSION_LIMITS;

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
        "specifically in a line, then pose the second move — NAME IT, open with '**Reframe —**' (bold, exactly so) so they see the step — as " +
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
        "then pose the third move — NAME IT, open with '**Restart —**' (bold, exactly so) so they see the step: " +
        (img
          ? `point them to the picture they built, quoting it: "Restart: when the old voice gets loud, go back to this — '${img}'." Then invite them to stay with it (a gentle question so it's not a dead end — e.g. does it feel like enough to reach for?).`
          : "remind them to go back to the picture they built of where they're headed, and invite them to stay with it (a gentle question so it's not a dead end).")
      );
    }
    return "\n\nRIGHT NOW: the member is responding to the Restart. Receive their reaction warmly in ONE line — no new question; you're about to close.";
  }
  if (isTriggerHandoffTurn(state))
    return (
      "\n\nRIGHT NOW: you've drawn out enough triggers — do NOT ask for another. Reflect briefly, name the ONE or TWO " +
      "that seem heaviest (their words), then move into building THEIR PROTOCOL. Tell them it's THREE MOVES — Redirect, " +
      "Reframe, Restart — so they see the shape, then pose the first: NAME IT, open with '**Redirect —**' (bold, exactly so) — what do you do " +
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

/** @param carryForward What upstream assets retained (lib/curriculum/retention.ts), rendered, or null. Passed in
 *  rather than read here so the engine stays pure and replayable; null must add NOTHING — an absent upstream is a
 *  member's choice about order, never a gap to name. See liveTurnRebuildB3 for the full note. */
export async function liveTurnRewireW3(state: ConvState, history: ConvMessage[], memberMessage: string, carryForward?: string | null): Promise<Turn> {
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
    // CACHED PREFIX / VOLATILE SUFFIX. The governed core plus this Session's own instructions are byte-identical
    // on every turn, so they go in the FIRST system block with the breakpoint on it; the member's context, the
    // stage note and any carry-forward change per turn and go in a SECOND block after it. Caching is a prefix
    // match — a single varying byte inside the cached block would invalidate it on every turn and we would pay
    // the 1.25x write premium for nothing.
    //
    // THE BLOCK IS WHAT MAKES CACHING POSSIBLE, WHICH IS THE INVERSION WORTH KNOWING. Sonnet 4.6 will not cache a
    // prefix under 2048 tokens; these prompts were ~650 and therefore uncacheable. Governed, they are ~4700 —
    // over the line. Adding the rules makes a Session CHEAPER than it was ungoverned: the first turn pays 1.25x
    // to write, every turn after reads at 0.1x.
    system: [
      { type: 'text' as const, text: REWIRE_W3_SYSTEM, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: w3Context(state.collected) + rewireW3StageNote(state) + (carryForward ? `\n\n${carryForward}` : '') },
    ],
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
// SPLIT IN TWO (2026-08-28). This was one paragraph: the recap, then the framing, then item 1 — so the Checkpoint
// told the member what they had done and immediately asked for six numbers. Jay, walking it: "This is
// underdeveloped for a Checkpoint." The recap is now the doorway's frame, with CHECKPOINT_ENGAGE_Q between it and
// the instrument, so the phase gets closed in the member's words before it gets closed in ours.
const W3_CHECKPOINT_RECAP =
  'You just did the real work of Rewire — you caught the lies, built the picture, wrote the protocol.';
const W3_CHECKPOINT_OPEN =
  'Now a quick read on where your commitment sits. Six of these, one to five. They set your Rewire read ' +
  "— you'll see how it moved your Grinta Index at the close.";
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
  ...AGREEMENT_1_5, // Greg's verbatim 1–5 anchors, one definition (onboarding-staged.ts)
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

const rewireCheckpointEngage = checkpointEngagement({
  next: 'checkpoint',
  recap: W3_CHECKPOINT_RECAP,
  handIn: () => rewireCheckpointOpener(),
});

export const REWIRE_CHECKPOINT_ARC: ArcConfig = {
  id: 'rewire-checkpoint',
  stageOrder: ['checkpoint-open', 'checkpoint', 'ceremony'],
  stages: {
    'checkpoint-open': engagementStage(rewireCheckpointEngage),
    checkpoint: rewireCheckpointStage,
    ceremony: rewireCeremonyStage,
  },
  onComplete: () => REWIRE_CEREMONY_LEAD,
};

export function applyRewireCheckpointTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(REWIRE_CHECKPOINT_ARC, state, history, memberMessage, model);
}

export function rewireCheckpointOpening(): Turn {
  // Opens on the doorway. No `expects`: the 1–5 chips belong to the instrument, and putting them under an open
  // question is how the doorway turns back into the assessment it exists to precede.
  return { reply: engagementOpening(rewireCheckpointEngage), state: { stage: 'checkpoint-open', collected: {} }, complete: false };
}

// The Checkpoint is ADMINISTERED (deterministic Likert parse) — no model call needed. The action passes empty text.
export function liveTurnRewireCheckpoint(state: ConvState, history: ConvMessage[], memberMessage: string): Turn {
  return applyRewireCheckpointTurn(state, history, memberMessage, { text: '' });
}
