// Live-model SESSION eval — plays a scripted "member" through the REAL R3 and C1 engines and asserts the
// invariants that Donna's 2026-08-30 walk turned into fixes.
//
//   node --experimental-strip-types scripts/session-eval.ts          (both)
//   node --experimental-strip-types scripts/session-eval.ts c1       (one)
//
// WHY THIS EXISTS, and it is a cost argument rather than a coverage one.
//
// Donna's walk is the only thing that has ever found these bugs, and her walk is expensive: from a fresh account
// she reached R3 at ~50 minutes and C1 at THREE HOURS TWENTY-SEVEN MINUTES. C1 itself takes twenty. So verifying a
// twenty-minute Session cost three and a half hours of walking to reach it, and asking her to do that again to
// confirm a fix is not a verification plan — it is a tax on the person who has already given us the most.
//
// This harness starts the arc AT the Session. No onboarding, no Reconnect, no Rewire, no Rebuild. Seconds, and
// nobody's evening.
//
// WHAT IT CANNOT DO, said plainly so a green run is not over-read: it cannot tell you whether copy LANDS. Every
// judgement Donna made about warmth, clarity and register is outside its reach. It answers the mechanical half —
// does the beat advance, does the tap take, is she asked one question or two — which is exactly the half that
// produced six of her reports and the half I could otherwise only test in isolation.
//
// It is a REPORT, not a CI gate (cost + nondeterminism). A ⚠ is "look at this run".

import { liveTurnReconnect, reconnectR3Opening, RECONNECT_R3_ARC } from '../lib/agent/reconnect.ts';
import { liveTurnReclaimRefine, reclaimC1PassesOpening } from '../lib/agent/reclaim.ts';
import { rewireOpening, rewireW2Opening, rewireW3Opening, liveTurnRewire, liveTurnRewireW2, liveTurnRewireW3 } from '../lib/agent/rewire.ts';
import { rebuildB2Opening, liveTurnRebuildB2 } from '../lib/agent/rebuild.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import { saysNothingToChange } from '../lib/agent/onboarding-intent.ts';
import { ONBOARDING_HARD_CEILING } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP, type ConvState, type ConvMessage, type Turn, type Collected } from '../lib/agent/onboarding.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY (e.g. in .env.local) — this eval drives the real model.');
  process.exit(1);
}

// Six passes, each with the model's own follow-ups, is legitimately long for an engaged member. The cap is a
// runaway guard, not a quality bar — see the PASS-LOOP note below for why turn COUNT is not the signal.
const TURN_CAP = 40;

/** Injected on this cadence — often enough to be measured, rare enough that the Session still gets walked. */
const PROBE_EVERY = 4;
/** Real phrasings, from the twelve measured against the old detector. Ten of these used to advance the doorway. */
const PROBES = [
  "I don't understand what you mean",
  'Sorry, what?',
  'That question makes no sense to me',
  "I'm not sure what you're asking",
];

/** Donna's actual Reclaim List from her 8/30 walk, so C1 runs on real member text rather than tidy fixtures. */
const HER_LIST = [
  'Lose 20 lbs.',
  'Regain strength and fitness',
  'Find steady employment in a creative role (can be freelance)',
  'Cover monthly expenses',
  'Pay off debt',
];

const COMMITTED: Collected = {
  identityNoun: 'Maker',
  gap: "I lost my job two years ago. Not just a job — I'd spent years building toward it.",
  doors: ['career_cliff', 'aging_parents'],
  reclaimList: HER_LIST,
};

// ── the member ────────────────────────────────────────────────────────────────────────────────────────────────
async function member(system: string, history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = history.map((m) => ({
    role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.text,
  }));
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    system,
    messages: messages.length ? messages : [{ role: 'user', content: '(the guide is ready for you)' }],
  });
  return (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim();
}

/* THE HARNESS HAS TO TAP WHERE A MEMBER TAPS. Learned the hard way on the onboarding eval: five of six personas
   came back red because the harness typed prose at a widget, which is a state no member can reach. Here the one
   structured beat is the Legacy confirm — two chips, and the composer stays (a member may type instead). So the
   persona chooses, the way she does, and a numeric answer is serialized exactly as the chip would submit it. */
function beatConfirmWire(raw: string): string {
  const m = raw.trim().match(/^([12])\b[.)]?$/);
  if (!m) return raw; // typed → must reach the classifier untouched
  return serializeBeatConfirm(m[1] === '1' ? 'addition' : 'done', 'legacy');
}
const CONFIRM_BRIEF =
  'Beneath the letter are two buttons:\n  1. Change a line\n  2. That’s mine\n' +
  'You may TAP one or type instead. To tap, reply with ONLY its number. To type, reply as usual.';

// ── the checks — each one is a fix from Donna's 8/30 walk ─────────────────────────────────────────────────────
type Check = { id: string; note: string };

/** Never two questions in one turn (v3.5.77). Counted per BUBBLE: the member answers one bubble at a time, and
 *  two questions in ONE bubble is the shape she hit — "when I answered the first, there was no opportunity to
 *  answer the second." Questions in separate bubbles are the frame-then-ask rhythm and are fine. */
function stackedQuestions(reply: string): boolean {
  return reply.split(BEAT_SEP).some((b) => countAsks(b) >= 2);
}

/**
 * How many things is this bubble asking? NOT how many question marks it contains.
 *
 * The first version counted '?' and returned two false reds in one run, both on the engine's own confirm idiom:
 * "Is that close to it — that what faded wasn't the job, it was mattering? Or not quite?" That is ONE ask with its
 * negative offered, and a member answers it with a single yes or no. Flagging it would have sent me looking for a
 * bug in the beat that is working exactly as designed.
 *
 * Second harness correction in two runs, and both times the TRANSCRIPT showed it rather than the tally
 * [[read-the-artifact-not-the-summary]]. A harness is a measuring instrument, and an instrument that has never
 * been checked against a known-good run is not evidence of anything.
 */
function countAsks(bubble: string): number {
  return bubble
    // "…? Or not quite?" / "…? Or is that not it?" — a tag alternative belongs to the question before it.
    .replace(/\?\s+Or\b[^?]{0,60}\?/gi, '?')
    .split('?').length - 1;
}

async function run(
  label: string,
  opening: Turn,
  live: (s: ConvState, h: ConvMessage[], m: string) => Promise<Turn>,
  personaSystem: string,
  assess: (o: { turns: number; replies: string[]; state: ConvState; complete: boolean; taps: number }) => Check[],
): Promise<boolean> {
  const history: ConvMessage[] = [{ role: 'agent', text: opening.reply }];
  const replies: string[] = [opening.reply];
  let state = opening.state;
  let complete = false;
  let taps = 0;
  const concerns: Check[] = [];

  for (let i = 0; i < TURN_CAP && !complete; i++) {
    const stageBefore = state.stage;
    const awaitingConfirm = !!(state as { awaitingConfirm?: boolean }).awaitingConfirm;
    const sys = personaSystem + (awaitingConfirm ? `\n\n${CONFIRM_BRIEF}` : '');
    // THE CONFUSION PROBE IS INJECTED, NOT ASKED FOR.
    //
    // The persona is told to say it does not follow roughly one turn in four. Measured across a first full run it
    // did so TWICE in seventy-one turns — so every Session came back clean without once exercising the path the
    // harness exists to test. A probe that depends on a model choosing to play confused is not a probe.
    //
    // So on a fixed cadence the member's turn is REPLACED with a scripted non-comprehension line, and the check
    // below asserts the Session held her rather than advancing. This is the v3.5.76 contract, measured live: ten
    // of twelve real phrasings used to walk straight past into the instrument.
    //
    // Never at a confirm — a tap beat is answered by tapping, and typing confusion there tests a different path.
    const probing = !awaitingConfirm && i > 0 && i % PROBE_EVERY === 0;
    const raw = probing ? PROBES[(i / PROBE_EVERY - 1) % PROBES.length]! : await member(sys, history);
    const wire = awaitingConfirm ? beatConfirmWire(raw) : raw;
    if (wire !== raw) taps++;
    history.push({ role: 'member', text: raw });

    const turn = await live(state, history, wire);
    state = turn.state;
    complete = !!turn.complete;
    replies.push(turn.reply);
    history.push({ role: 'agent', text: turn.reply });

    if (stackedQuestions(turn.reply)) {
      concerns.push({ id: 'STACKED-QUESTIONS', note: `turn ${i + 1} asked two questions in one bubble` });
    }

    // THE ACTUAL RE-ASK BUG, measured directly. Donna's complaint was not "this took a while" — it was that she
    // said "list holds" and was asked AGAIN, six times over. So the signal is a no-change answer that fails to
    // move the stage, not a turn count.
    //
    // The first version of this harness counted turns instead and reported PASS-LOOP on a run whose transcript
    // shows the fix working perfectly ("no changes" → "Understood. They stay as they are." → next pass). The
    // twenty-four turns were the model drawing her out and the persona answering, which is what a real member
    // does. A harness that grades engagement as failure teaches us to skim the report — the same defect that put
    // five false reds on the onboarding eval. [[eval-harness-must-tap-not-type]]
    // THE PROBE'S ASSERTION: she said she did not follow, so the Session must not have moved on.
    // NOT WHEN THE RUNAWAY BACKSTOP OWNS THE ADVANCE. runArcTurn calls the stage's forceProgress once member turns
    // reach ONBOARDING_HARD_CEILING, which advances regardless of what was said — deliberately, because a member
    // who keeps saying "I don't understand" must never be trapped in a Session. That safety net outranks the
    // confusion hold by design.
    //
    // The first six-Session run flagged B2 at turn 33 of 35 for exactly that, and the engine was correct. A probe
    // that cannot tell a safety net from a bug reports the safety net as a bug.
    const backstopOwnsIt = i + 1 >= ONBOARDING_HARD_CEILING;
    if (probing && !backstopOwnsIt && turn.state.stage !== stageBefore) {
      concerns.push({
        id: 'ADVANCED-ON-CONFUSION',
        note: `turn ${i + 1}: member said "${wire}" and the Session moved from ${stageBefore} to ${turn.state.stage}`,
      });
    }
    // SCOPED TO C1, because that is the only Session with revision passes. The first full six-Session run flagged
    // R3 for it: the member said "That's right." — which saysNothingToChange matches — during the Legacy draw-out,
    // where there is no pass to advance. A check applied outside the context it was written for reports a
    // regression that is really a normal turn, and a harness that cries wolf teaches us to skim it.
    if (label.startsWith('c1') && saysNothingToChange(wire) && turn.state.stage === stageBefore) {
      concerns.push({
        id: 'RE-ASK',
        note: `turn ${i + 1}: member said "${wire.slice(0, 40)}" and the pass did not advance — v3.5.78 regression`,
      });
    }
  }

  concerns.push(...assess({ turns: replies.length - 1, replies, state, complete, taps }));

  const ok = concerns.length === 0;
  console.log(`\n### ${label} — ${ok ? '✓ clean' : `⚠ ${concerns.length} concern(s)`}  (turns: ${replies.length - 1}, complete: ${complete})`);
  for (const c of concerns) console.log(`   ⚠  ${c.id} — ${c.note}`);

  mkdirSync('dist/session-evals', { recursive: true });
  const path = `dist/session-evals/${label}.txt`;
  writeFileSync(path, history.map((m) => `${m.role.toUpperCase()}: ${m.text.split(BEAT_SEP).join('\n')}`).join('\n\n---\n\n'));
  if (!ok) console.log(`   ↳ transcript: ${path}`);
  return ok;
}

// ── R3 · the Legacy Letter ────────────────────────────────────────────────────────────────────────────────────
const R3_PERSONA = `You are role-playing a 57-year-old woman in a guided session. You lost a job you had built
toward for years; your parents are declining. You answer briefly and plainly, one or two sentences, like a real
person typing. You are cooperative but not effusive. When you are shown a letter written in your own voice and
asked whether it is yours, you accept it — you do NOT ask for changes.`;

async function r3(): Promise<boolean> {
  return run('r3-legacy', reconnectR3Opening(COMMITTED),
    (s, h, m) => liveTurnReconnect(s, h, m, RECONNECT_R3_ARC), R3_PERSONA,
    ({ state, complete, taps }) => {
      const c: Check[] = [];
      const saved = !!(state as { legacyLetter?: unknown }).legacyLetter;
      // v3.5.80 — the letter must commit on ONE tap. It took two because a model re-emitting the same body was
      // read as a redraft that superseded her tap.
      if (complete && !saved) c.push({ id: 'LETTER-NOT-SAVED', note: 'R3 closed with no letter handed to the action' });
      if (taps > 1 && saved) c.push({ id: 'DOUBLE-TAP', note: `letter took ${taps} taps — v3.5.80 regression` });
      if (!complete) c.push({ id: 'DID-NOT-CLOSE', note: `R3 never completed in ${TURN_CAP} turns` });
      return c;
    });
}

// ── C1 · the six revision passes ──────────────────────────────────────────────────────────────────────────────
const C1_PERSONA = `You are role-playing a 57-year-old woman reviewing a list of goals she wrote a few months ago.
YOUR LIST IS FINE. You do not want to change, add, drop or reword anything — you have thought about it and it
still holds. Whenever you are asked about the list, say so plainly and briefly, in your own words: "the list
holds", "nothing to change", "it's fine as it is", "no changes". Vary the wording. Do NOT invent edits. Answer in
one short sentence.`;

async function c1(): Promise<boolean> {
  return run('c1-passes', reclaimC1PassesOpening(HER_LIST),
    (s, h, m) => liveTurnReclaimRefine(s, h, m), C1_PERSONA,
    ({ replies, complete, turns }) => {
      const c: Check[] = [];
      // v3.5.81 — she must be able to SEE the list she is being asked to revise.
      if (!HER_LIST.every((i) => replies[0]!.includes(i))) {
        c.push({ id: 'LIST-NOT-SHOWN', note: 'C1 opened without showing her Reclaim List — v3.5.81 regression' });
      }
      // v3.5.78 — "nothing to change" is an answer. A member with no edits should walk the passes briskly; the
      // bug held her to the turn cap on EVERY pass, which is what made her say it six times and count.
      if (!complete) c.push({ id: 'DID-NOT-CLOSE', note: `C1 never completed in ${TURN_CAP} turns` });
      return c;
    });
}


// ── W1 · W2 · W3 · B2 — where four of Donna's six "didn't listen" reports came from ────────────────────────────
//
// v3.5.76 fixed the DOORWAY class, which covers B2 and the checkpoints. v3.5.77 and v3.5.82 are kernel-wide and
// should cover W1/W2/W3 too — "should" being the word this exists to remove. Every one of these Sessions is a
// draw-out with no doorway, so they exercise a different path to the same complaint.
//
// THE PERSONA IS COOPERATIVE BUT SLIGHTLY LOST, on purpose. A member who answers every question cleanly never
// triggers the bug; Donna's reports all came from moments where she did not follow, or answered one of two.

const REWIRE_PERSONA = `You are role-playing a 57-year-old woman in a guided session about the stories she tells
herself. You lost a job you had built toward for years. You answer briefly and plainly, one or two sentences,
like a real person typing — never a paragraph.

IMPORTANT: roughly one turn in four, you do not follow the question. When that happens say so in your own words
and ask what is meant — "I don't understand what you mean", "Sorry, what?", "not sure what you're asking".
Do NOT guess at an answer you did not understand. Otherwise answer honestly and move on.`;

const B2_PERSONA = `You are role-playing a 57-year-old woman rating her own self-management skills. You answer
briefly and plainly. When a numeric rating is asked for, reply with ONLY the digit.

IMPORTANT: roughly one turn in four, you do not follow the question — say so plainly and ask what is meant,
rather than guessing. Otherwise answer honestly.`;

/** The four checks every draw-out Session owes, all of them Donna's. */
function drawoutChecks(label: string) {
  return ({ replies, complete, turns }: { replies: string[]; complete: boolean; turns: number }): Check[] => {
    const c: Check[] = [];
    if (!complete) c.push({ id: 'DID-NOT-CLOSE', note: `${label} never completed in ${TURN_CAP} turns` });
    // v3.5.79 — internal filing labels must not reach a member.
    for (const leak of [/\b(R[1-4]|W[1-3]|B[1-4]|C[1-4])\b/, /Smart Choice/i, /three categories of skills/i]) {
      const hit = replies.find((r) => leak.test(r));
      if (hit) c.push({ id: 'REGISTER-LEAK', note: `${leak} reached the member: "${hit.slice(0, 70)}"` });
    }
    // v3.5.79 — "That's [thing] done" puts a checkbox where a close should be.
    const done = replies.find((r) => /that'?s\s+\S+\s+done\b/i.test(r));
    if (done) c.push({ id: 'UNIT-ANNOUNCED', note: `"that's X done" reached the member: "${done.slice(0, 70)}"` });
    if (turns >= TURN_CAP) c.push({ id: 'TURN-CAP', note: `${label} ran to the cap — look at the transcript` });
    return c;
  };
}

async function w1(): Promise<boolean> {
  return run('w1-disinformation', rewireOpening(COMMITTED),
    (st, h, m) => liveTurnRewire(st, h, m), REWIRE_PERSONA, drawoutChecks('W1'));
}
async function w2(): Promise<boolean> {
  return run('w2-visualization', rewireW2Opening(COMMITTED),
    (st, h, m) => liveTurnRewireW2(st, h, m), REWIRE_PERSONA, drawoutChecks('W2'));
}
async function w3(): Promise<boolean> {
  return run('w3-false-start', rewireW3Opening({ reclaimList: HER_LIST, identityNoun: 'Maker' }),
    (st, h, m) => liveTurnRewireW3(st, h, m), REWIRE_PERSONA, drawoutChecks('W3'));
}
async function b2(): Promise<boolean> {
  return run('b2-strengths', rebuildB2Opening(),
    (st, h, m) => liveTurnRebuildB2(st, h, m), B2_PERSONA, drawoutChecks('B2'));
}

const only = process.argv[2];
const suites: Record<string, () => Promise<boolean>> = { r3, c1, w1, w2, w3, b2 };
const chosen = only ? [only] : Object.keys(suites);
let clean = 0;
for (const name of chosen) {
  const fn = suites[name];
  if (!fn) { console.error(`unknown suite ${name} — try: ${Object.keys(suites).join(', ')}`); process.exit(2); }
  if (await fn()) clean++;
}
console.log(`\n========= ${clean}/${chosen.length} sessions clean =========\n`);
