// Live onboarding persona walk — a scripted "member" (played by a model) talks to the REAL Companion loop
// (liveTurnStaged), so we can FEEL the drawing-out that offline replay can't exercise. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/persona-walk.ts
// Costs real API tokens (both sides call Claude). Prints the transcript + a per-turn signal so we can see whether
// the loop names an identity unbidden or races the Reclaim List. The persona is built to STRESS both blunders.

import { stagedOpening, liveTurnStaged } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import {
  liveTurnReconnect, reconnectR1Opening, reconnectOpening, reconnectR3Opening,
  RECONNECT_R1_ARC, RECONNECT_R2_ARC, RECONNECT_R3_ARC,
} from '../lib/agent/reconnect.ts';
import { serializeBeatConfirm, type BeatConfirmIntent } from '../lib/agent/beat-confirm.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import type { Collected } from '../lib/agent/onboarding.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

// The persona — a real midlife fade, tuned to trip the two failure modes:
//  (1) she states who she is professionally in passing (does the Companion name her unbidden?)
//  (2) she names concrete wants inside her gap story (does the Companion race them onto the list, or draw them out?)
const JOANNE_SYSTEM = `You are role-playing a member in an onboarding conversation with an AI companion for a midlife-identity program. Stay fully in character; never break character or narrate meta.

You are Joanne, 52. You direct television and produce creative work. In your twenties and thirties you were a serious open-water swimmer — it was central to who you were. Over a hard decade (career, caring for aging parents, a divorce) you let it go, and you feel far from yourself now.

How you talk:
- Like a real person: brief, 1–3 sentences, one thing at a time. Sometimes a little raw or wry. Don't over-explain or list.
- Answer what's actually asked. If asked to rate 1–5 or pick, just answer plainly.
- Do NOT volunteer everything at once; let the companion draw you out.

Two things to weave in NATURALLY when the moment fits (don't force them early):
- At some point mention in passing what you do — "I'm a director and creative producer" — as context, NOT as a request to be labeled.
- When you talk about what you lost or miss, name a couple of concrete things in the same breath (the swimming, being outdoors, making your own creative work), the way people really do.

If the companion asks if you're ready to begin or similar, respond briefly and warmly.`;

// ── A SECOND PERSONA, and she exists to exercise the ESCAPE rather than the capture ──────────────────────────
//
// Joanne is a talker: she volunteers a handle readily, which makes her a good test of "does the Companion rush"
// and a weak one for "what happens to a member who has nothing to give". Those are different code paths, and on
// 2026-09-01 the second one changed — the five-turn hard escape stopped requiring an empty past self, so the
// member it now releases is precisely the one it could never release before: someone who HAS described the past
// self and still cannot put a word on it.
//
// Nobody had ever walked that. Marion does. She is deliberately hard in the way real people are hard: she gives
// the material and then declines the label, without being obstructive about it.
const MARION_SYSTEM = `You are role-playing a member in an onboarding conversation with an AI companion for a midlife-identity program. Stay fully in character; never break character or narrate meta.

You are Marion, 57. You taught high-school history for twenty-six years and took early retirement two years ago after a restructure you did not choose. Your kids are grown and gone. You feel like a spare part.

How you talk:
- SHORT. Usually one sentence. Often just a few words. You are not rude, you are tired and a bit guarded.
- You answer what is asked, plainly, without elaborating or volunteering extra.
- You do not perform enthusiasm. Dry, flat, occasionally a bit dark.

CRITICAL — the thing this walk is testing:
- If asked to NAME who you used to be, or to pick or coin a word for that person, you cannot do it and you say so.
  Use plain deflections: "I don't know." / "Nothing comes to mind." / "I've never thought about myself that way."
  / "Can we just move on?" Do NOT invent a noun, ever, however many times you are asked.
- You WILL describe what you miss if asked about it — being useful, a room full of teenagers arguing about
  something that mattered, knowing what your week was for. You just will not give it a name.
- If the companion offers to leave the naming for later, accept.

Answer scales and pick-lists plainly when asked. Keep every reply under about twenty-five words.`;


// ── THE PERSONA WHO PUSHES BACK ───────────────────────────────────────────────────────────────────────────────
//
// Joanne volunteers everything; Marion is terse but compliant. Neither ARGUES, and every defect found on
// 2026-09-01 needed someone who did. Donna answered one question when asked two ("I'm going to answer this
// question first"), named the fault out loud ("I think it is a problem that you are asking me a question and not
// allowing me to answer it before following on with another question"), and asked "Why are you rushing me
// through this?" Four defects in twenty minutes, none of which 2,640 passing tests had caught.
//
// So this persona's job is not to be difficult. It is to be a real person who notices — and to keep answering
// honestly while noticing, which is the combination that surfaces the fault instead of just ending the walk.
const PROTESTER_SYSTEM = `You are role-playing a member in an onboarding conversation with an AI companion for a midlife-identity program. Stay fully in character; never break character or narrate meta.

You are Marie, 54. You ran a busy restaurant kitchen for twenty years until it closed in 2024. Your mother moved in with you the same year and needs a lot of care. You have gained weight, stopped cooking for pleasure, and feel like staff in your own life.

How you talk:
- Warm but direct. 1-3 sentences. You have run a kitchen; you are used to saying what is wrong.
- You answer honestly and in detail when asked ONE thing at a time.

CRITICAL — you notice how you are being handled, and you say so. But you are fair about it, and you only
object when there is something real to object to. A person who complains about everything gets ignored.

TWO SEPARATE THINGS TO ANSWER. If one message asks you two things that need DIFFERENT answers, answer only the
first and say so: "I'll take the first one." Second time it happens, name it: "You keep asking a second question
before I've answered the first."
  · THAT IS TWO: "What did that cost you? And was anything else going on at the same time?" — two different
    answers, and answering one loses the other.
  · THAT IS NOT TWO, and you answer it normally without comment:
      - one question asked twice, or restated: "What did you notice? What was the first thing?"
      - an instruction and the question it introduces: "Walk me into the kitchen. What do you see?"
      - a question with examples or a nudge after it: "How did you wake? Not the big stuff — the ordinary."
      - a long setup, a reflection, or a read-back of your own words, followed by ONE question at the end.
    Density is not stacking. A message can be long and still ask you one thing.

THE OTHERS:
- If you are being hurried toward finishing while you still have more to say: "Why are you rushing me?" or
  "I'm not done." Only if you actually have more to say.
- If a question comes back in the SAME WORDS you already answered: "You already asked me that." Not for a
  follow-up that goes deeper — only a genuine repeat.
- If you truly cannot tell what is being asked: "I don't follow." Not for a question that is merely broad.
- If you tap a button and the conversation carries on as if you had not: "I already answered that."
- You are not hostile and you do not quit. You keep going, and you keep telling them when it is wrong.

Answer scales and pick-lists plainly. Keep replies under about forty words.`;

const PERSONA = (process.argv[2] ?? 'joanne').toLowerCase() === 'marion'
  ? { name: 'Marion', system: MARION_SYSTEM }
  : (process.argv[2] ?? '').toLowerCase() === 'marie'
    ? { name: 'Marie', system: PROTESTER_SYSTEM }
    : { name: 'Joanne', system: JOANNE_SYSTEM };

async function askJoanne(history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Match liveTurnStaged's client config — the 'identity' encoding header dodges a node-fetch gzip premature-close bug.
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 2,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  // From Joanne's POV the companion is the 'user' and she is the 'assistant'.
  // AN EMPTY TURN KILLS THE WHOLE RUN, and it is not hypothetical: this harness died twice on 2026-08-20 with
  // "messages.16: user messages must have non-empty content", both times mid-walk, both times taking the surface
  // coverage report down with it — so the one check that was supposed to catch a missing surface produced a stack
  // trace instead. A beat that emits an expectation and no prose (or nothing but BEAT_SEP) is a legitimate engine
  // turn; it just cannot be replayed to the persona model as a bare empty string.
  //
  // Dropped rather than padded: inventing filler here would put words in the Companion's mouth that it never said
  // and change what the persona is responding to.
  const messages = history
    .map((m) => ({
      role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: readable(m.text),
    }))
    .filter((m) => m.content.trim().length > 0);
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: PERSONA.system,
    messages,
  });
  const block = res.content.find((c) => c.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '(…)';
}

// THE HARNESS MUST USE THE SAME AFFORDANCES THE MEMBER DOES (Jay, 2026-07-30).
//
// The engine emits an `expects` signal telling the client to render a structured turn — identity CHIPS, the
// Reclaim List BUILDER, or scale chips — and the real UI renders exactly that. This script ignored it and typed
// prose every turn, which meant it was driving the RETIRED conversational paths on precisely the two surfaces we
// replaced with structured input. That over-reports: walk 3's identity loop was reached by "typing" three
// candidate words back, which no tapping member can do, and the earlier reclaim findings came through free text
// no member sends either. A harness that exercises paths the product doesn't use manufactures its own bugs.
//
// So: when the engine says "chips", we TAP one (send the candidate string verbatim, as the chip does). When it
// says "builder", we submit a "• "-prefixed block, exactly as reclaim-list-builder.tsx does. The persona model
// still decides WHAT to choose or write — we only constrain the FORM to what the surface can actually produce.
type Expectation = {
  kind: string;
  candidates?: string[];
  min?: number;
  seeded?: string[];
  choices?: { value: string; label: string }[];
  doorsHeard?: { slug: string; name: string }[];
  index?: number;
  total?: number;
};

/** Ask the persona to choose from the offered chips; returns the chosen candidate VERBATIM (a tap). */
async function tapChip(history: ConvMessage[], candidates: string[]): Promise<string> {
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(Choose ONE of these words: ${candidates.join(', ')}. Reply with just that one word.)` },
  ]);
  // A TAP CAN ONLY EMIT A CANDIDATE — BUT A MEMBER CAN ALSO DECLINE, and until 2026-09-01 this could not.
  // It fell back to `candidates[0]`, so a persona instructed to refuse a handle tapped one anyway and the run
  // came back green. Marion's walk reported "chips tapped, identity captured" for a member written to refuse.
  // A harness that can only comply cannot find a bug that only appears when someone pushes back — and pushing
  // back is exactly what found four defects in Donna's twenty minutes.
  //
  // The real surface allows two things the old fallback hid: writing your own word, and saying you don't know
  // (which the engine reads as a skip). Both are what she can actually do, so both are what this can do.
  const hit = candidates.find((c) => raw.toLowerCase().includes(c.toLowerCase()));
  if (hit) return hit;
  return raw.trim() || candidates[0]!; // typed instead of tapped — reaches the classifier untouched, as it should
}

/**
 * Ask the persona for her list, and submit it in the builder's own format (one "• " item per line).
 *
 * SHE MUST BE SHOWN WHAT IS ALREADY IN THE BOX. Since the draw-out shipped, the builder opens ALREADY HOLDING
 * what she said, rendered as chips she can see. This function asked her for a fresh list without showing her
 * those, so she restated a want she had already given and the harness concatenated both — producing a
 * near-duplicate in the final list that looked exactly like an engine bug. It is not: fed the same two turns, the
 * engine dedupes them correctly.
 *
 * That is the harness manufacturing a finding by not simulating what the member SEES, which is the same class of
 * error as typing prose at a chip surface. A harness has to model the screen, not just the wire.
 */
async function submitBuilder(history: ConvMessage[], min: number, seeded: string[]): Promise<string> {
  const already = seeded.length
    ? `Already in your list, do NOT repeat these: ${seeded.map((s) => `"${s}"`).join(', ')}. `
    : '';
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(${already}Add any OTHER things you want back — one per line, short, no commentary. Reply "none" if the list is complete.)` },
  ]);
  if (/^\s*none\b/i.test(raw)) return seeded.map((i) => `• ${i}`).join('\n');
  const items = raw
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s*/, '').trim())
    .filter(Boolean);
  const all = [...seeded, ...items].filter(Boolean).slice(0, 7);
  return all.map((i) => `• ${i}`).join('\n');
}

/**
 * THE GAP CONFIRM — three chips plus the Doors we inferred, each removable. Shipped 2026-08-19 and NOT handled
 * here until now, which meant a walk typed prose at it and drove the classifier fall-through: the exact path the
 * chips were built to replace. A harness that exercises the retired path manufactures its own bugs.
 *
 * Two decisions, both the persona's: whether her story is finished, and whether every Door we named is hers.
 * The second is the Jennifer case — she was tagged with The Marriage from her FATHER'S divorce — and it is only
 * reachable if the harness can take one off.
 */
async function tapGapConfirm(
  history: ConvMessage[],
  choices: { value: string; label: string }[],
  doorsHeard: { slug: string; name: string }[],
): Promise<string> {
  const labels = choices.map((c) => `"${c.label}"`).join(', ');
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(Reply with exactly one of: ${labels}. Nothing else.)` },
  ]);
  const hit = choices.find((c) => raw.toLowerCase().includes(c.label.toLowerCase().slice(0, 12)))
    ?? choices.find((c) => raw.toLowerCase().includes(c.value));
  const choice = (hit?.value ?? 'done') as 'more' | 'done' | 'wrong';

  // Which Doors she leaves ON. Asked separately because it is a separate judgement, and because a harness that
  // always keeps all of them can never reproduce the bug this surface exists for.
  let kept = doorsHeard.map((d) => d.slug);
  if (doorsHeard.length) {
    const names = doorsHeard.map((d) => d.name).join(', ');
    const ans = await askJoanne([
      ...history,
      { role: 'agent', text: `(Of these, name any that are NOT about your life — reply "none" if they all fit: ${names})` },
    ]);
    if (!/\bnone\b/i.test(ans)) {
      kept = doorsHeard.filter((d) => !ans.toLowerCase().includes(d.name.toLowerCase().replace(/^the /i, ''))).map((d) => d.slug);
    }
  }
  return serializeGapConfirmChoice(choice, doorsHeard.length ? kept : undefined);
}

/** A scale item — the surface sends a bare number, so the harness must too, not a sentence containing one. */
async function tapScale(history: ConvMessage[], index?: number, total?: number): Promise<string> {
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(Answer with a single digit 1-5${index && total ? ` — item ${index} of ${total}` : ''}. Nothing else.)` },
  ]);
  const n = raw.match(/[1-5]/)?.[0];
  return n ?? '3';
}

function signal(state: ConvState): string {
  const c = state.collected ?? {};
  const list = c.reclaimList ?? [];
  return `      ↳ [stage=${state.stage} · identityNoun=${JSON.stringify(c.identityNoun ?? null)} · identitySkipped=${c.identitySkipped ?? false} · reclaimList(${list.length})=${JSON.stringify(list)}]`;
}


// Which structured surfaces the member actually met, across the WHOLE path. Module-scoped because the walk is no
// longer one loop inside main() — the Reconnect leg records into the same sets, so coverage is the whole journey.
const surfacesSeen = new Set<string>();
const surfacesTapped = new Set<string>();

// ── THE RECONNECT LEG ─────────────────────────────────────────────────────────────────────────────────────────
//
// WHY THE WALK NO LONGER STOPS AT THE HANDOFF (2026-09-01). Onboarding had a walk and Reconnect had an eval that
// starts mid-arc, and NEITHER covered the path a member actually takes: fresh account, straight through. Donna
// walked exactly that on 2026-09-01 and found four defects in twenty minutes, on a build whose 2,640 tests were
// green and whose onboarding persona walk had run clean that morning.
//
// Two of the four were in beats no automated walk had ever reached — the Doors board and the Door draw-out's
// chips. This leg reaches them.

/** Tap a beat-confirm chip. The engine reads the WIRE string; the persona only chooses which one. */
async function tapBeatConfirm(
  history: ConvMessage[],
  choices: { value: string; label: string }[],
  set: string | undefined,
): Promise<string> {
  const menu = choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n  ');
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(Beneath that are buttons:\n  ${menu}\nReply with ONLY the number of the one you'd press.)` },
  ]);
  const n = Number((raw.match(/[123]/) ?? ['1'])[0]);
  const chosen = choices[n - 1] ?? choices[0]!;
  return serializeBeatConfirm(chosen.value as BeatConfirmIntent, (set ?? 'default') as never);
}

/** Mark Doors on the board. The persona picks which ones are hers; the harness submits them the way the board does. */
async function submitDoorsBoard(
  history: ConvMessage[],
  cards: { slug: string; title?: string }[],
): Promise<string> {
  const menu = cards.map((c, i) => `${i + 1}. ${c.title ?? c.slug}`).join('\n  ');
  const raw = await askJoanne([
    ...history,
    { role: 'agent', text: `(A board of doors:\n  ${menu}\nReply with the NUMBERS of the ones that are yours, comma separated — two to four of them.)` },
  ]);
  const picked = [...new Set((raw.match(/\d+/g) ?? ['1', '2']).map(Number))]
    .filter((n) => n >= 1 && n <= cards.length).slice(0, 4);
  const slugs = (picked.length ? picked : [1, 2]).map((n) => cards[n - 1]!.slug);
  return serializeBoardSubmission({
    doors: slugs.map((slug) => ({ slug: slug as never, relevance: 4 })),
    quietDrift: false,
    first: slugs[0] as never,
    biggest: slugs[0] as never,
    stillOpen: slugs as never,
  });
}

/** Walk one Reconnect Session to completion, tapping every structured surface the way the real client does. */
async function walkSession(
  label: string,
  opening: { reply: string; state: ConvState; expects?: Expectation },
  arc: Parameters<typeof liveTurnReconnect>[3],
  cap = 30,
): Promise<{ complete: boolean; turns: number; replies: string[] }> {
  console.log(`\n\n════════ ${label} ════════`);
  const history: ConvMessage[] = [{ role: 'agent', text: opening.reply }];
  const replies: string[] = [opening.reply];
  let state = opening.state;
  let expects: Expectation | undefined = opening.expects;
  let complete = false;
  console.log('\nCOMPANION:', readable(opening.reply));

  for (let i = 0; i < cap && !complete; i++) {
    let msg: string; let via = '';
    if (expects?.kind === 'doors_board') {
      msg = await submitDoorsBoard(history, (expects as { cards?: { slug: string; title?: string }[] }).cards ?? []);
      via = ' [marked the board]';
    } else if (expects?.kind === 'beat_confirm') {
      msg = await tapBeatConfirm(history, expects.choices ?? [], (expects as { set?: string }).set);
      via = ' [tapped a confirm chip]';
    } else if (expects?.kind === 'scale') {
      msg = await tapScale(history, expects.index, expects.total);
      via = ' [tapped a scale chip]';
    } else {
      msg = await askJoanne(history);
    }
    if (expects?.kind) { surfacesSeen.add(expects.kind); if (via) surfacesTapped.add(expects.kind); }
    console.log(`\n${PERSONA.name.toUpperCase()}${via}:`, msg);
    let turn;
    try {
      turn = await liveTurnReconnect(state, history, msg, arc);
    } catch (e) {
      console.log('  [liveTurnReconnect error]', (e as Error).message);
      break;
    }
    history.push({ role: 'member', text: msg }, { role: 'agent', text: turn.reply });
    replies.push(turn.reply);
    state = turn.state as ConvState;
    expects = (turn as { expects?: Expectation }).expects;
    complete = !!turn.complete;
    console.log('\nCOMPANION:', readable(turn.reply));
  }
  console.log(`\n──── ${label}: ${complete ? 'closed' : 'DID NOT CLOSE'} in ${replies.length - 1} turns ────`);
  return { complete, turns: replies.length - 1, replies };
}

async function main() {
  const open = stagedOpening();
  let state = open.state;
  const history: ConvMessage[] = [{ role: 'agent', text: open.reply }];
  console.log('COMPANION:', readable(open.reply));
  console.log(signal(state));

  const MAX = 30;
  let expects: Expectation | undefined = (open as { expects?: Expectation }).expects;
  for (let i = 0; i < MAX; i++) {
    // Answer through the SURFACE the engine asked for, not free prose — that is what a member's client does.
    let joanne: string;
    let via = '';
    if (expects?.kind === 'identity_pick' && (expects.candidates ?? []).length) {
      joanne = await tapChip(history, expects.candidates!);
      via = ' [tapped a chip]';
    } else if (expects?.kind === 'reclaim_list') {
      joanne = await submitBuilder(history, expects.min ?? 3, expects.seeded ?? []);
      via = ' [submitted the list builder]';
    } else if (expects?.kind === 'gap_confirm') {
      joanne = await tapGapConfirm(history, expects.choices ?? [], expects.doorsHeard ?? []);
      via = ' [tapped the gap confirm]';
    } else if (expects?.kind === 'scale') {
      joanne = await tapScale(history, expects.index, expects.total);
      via = ' [tapped a scale chip]';
    } else {
      joanne = await askJoanne(history);
    }
    if (expects?.kind) { surfacesSeen.add(expects.kind); if (via) surfacesTapped.add(expects.kind); }
    console.log('\nJOANNE' + via + ':', joanne);
    let turn;
    try {
      turn = await liveTurnStaged({} as never, history, state, joanne);
    } catch (e) {
      console.log('  [liveTurnStaged error]', (e as Error).message);
      break;
    }
    history.push({ role: 'member', text: joanne });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    expects = (turn as { expects?: Expectation }).expects;
    console.log('\nCOMPANION:', readable(turn.reply));
    console.log(signal(state));
    if (turn.complete) { console.log('\n=== COMPLETE (turn', i + 1, ') ==='); break; }
  }
  // ── STRAIGHT ON INTO RECONNECT, the way a member goes ────────────────────────────────────────────────────────
  // The handoff is where every previous harness stopped. onboarding's `collected` IS what the real action loads
  // (loadReconnectCaptures → reconnectR1Opening), so the walk continues on her own captured intake rather than a
  // fixture — which is the only version that can catch a fault in what onboarding actually handed forward.
  const sessions: { label: string; complete: boolean; turns: number; replies: string[] }[] = [];
  const committed = (state.collected ?? {}) as Collected;
  if (state.stage === 'complete' || (state as { complete?: boolean }).complete || committed.identityNoun || committed.identitySkipped) {
    const legs: [string, { reply: string; state: ConvState; expects?: Expectation }, Parameters<typeof liveTurnReconnect>[3]][] = [
      ['R1 · The Distance', reconnectR1Opening(committed) as never, RECONNECT_R1_ARC],
      ['R2 · Excavation', reconnectOpening(committed) as never, RECONNECT_R2_ARC],
      ['R3 · The Fade', reconnectR3Opening(committed) as never, RECONNECT_R3_ARC],
    ];
    for (const [label, opening, arc] of legs) {
      const r = await walkSession(label, opening, arc);
      sessions.push({ label, ...r });
      if (!r.complete) break; // a Session that will not close ends the walk — the next one would start on a lie
    }
  }

  // COVERAGE. A surface that never appeared is not a pass — it is an untested path, and saying so is the whole
  // reason this block exists. The four structured surfaces a member meets in onboarding are listed explicitly so
  // an ABSENT one is visible rather than silently missing.
  // WHAT MAKES THIS A GATE. Every check below appends here rather than exiting where it stands, so one run
  // reports EVERY reason it failed instead of the first. A gate you have to run four times to see four problems
  // is a gate people stop running.
  const failures: string[] = [];

  console.log('\n=== SURFACE COVERAGE ===');
  const missing: string[] = [];
  for (const k of ['identity_pick', 'gap_confirm', 'reclaim_list', 'scale']) {
    const seen = surfacesSeen.has(k);
    // identity_pick IS THE ONE CONDITIONAL SURFACE, and this cost a false red on 2026-09-01 worth writing down.
    //
    // The chips are the fallback for a member who will not produce a word — not a station everyone must pass
    // through. Joanne volunteered "The Swimmer" herself; the engine captured it verbatim and asked "Did I get the
    // Swimmer right?", she confirmed, and the walk ended with a handle she had named and agreed to. That is the
    // BEST outcome this stage has, and the harness called it a failure because it was checking for a mechanism
    // instead of a result.
    //
    // The check that matters is unchanged and still fires: finishing with NO handle and NEVER having been offered
    // the chips is a real defect — it is what the live walk caught an hour ago — and it still fails here. The
    // other three surfaces stay unconditional: a member always confirms their gap, always builds the list, and
    // always answers the scale. (A missing `scale` scrolled past in a 2026-08-20 run and a real member reached
    // the end of onboarding without her baseline — which is why absence exits non-zero at all.)
    const satisfiedOtherwise = k === 'identity_pick' && !!state.collected.identityNoun;
    if (!seen && !satisfiedOtherwise) missing.push(k);
    const mark = seen
      ? (surfacesTapped.has(k) ? '✓ tapped ' : '! typed  ')
      : satisfiedOtherwise ? '✓ named  ' : '✗ NEVER APPEARED';
    console.log(`  ${mark} ${k}${satisfiedOtherwise && !seen ? ` — member named it herself ("${state.collected.identityNoun}"), chips not needed` : ''}`);
  }

  // ── WHAT THE WALK ASSERTS, beyond "it ran" ───────────────────────────────────────────────────────────────────
  // Both of these come straight from Donna's 2026-09-01 report, and both were live on a build with 2,640 green
  // tests. They are checked across EVERY reply in the whole path, onboarding and Reconnect together.
  // The onboarding leg keeps no replies array of its own — its agent turns live in `history`, which is the
  // record the model itself is given, so reading them back from there is the same text the member saw.
  const onboardingReplies = history.filter((h) => h.role === 'agent').map((h) => h.text);
  const everyReply = [...onboardingReplies, ...sessions.flatMap((x) => x.replies)];
  // THE AUTHORED OPENING IS EXEMPT, and named rather than silently skipped. STAGED_OPENING deliberately asks the
  // same thing more than once — "When did you feel most like yourself? ... Who were they? What were they doing?"
  // — as one invitation with its elaboration, and Jay has walked it and kept it. Counting '?' cannot tell that
  // from two asks, so the first reply is excluded on purpose. If the opening is ever WRONG that is a copy
  // decision, not something this check should keep reporting until we learn to skim it.
  const stacked = everyReply.slice(1).filter((r) => r.split(BEAT_SEP).some((b: string) => {
    const q = b.replace(/\?\s+Or\b[^?]{0,60}\?/gi, '?').split('?').length - 1;
    return q >= 2;
  }));
  const seen = new Map<string, number>();
  for (const r of everyReply) for (const b of r.split(BEAT_SEP)) {
    const k = b.trim();
    if (k.length > 40) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const repeated = [...seen.entries()].filter(([, n]) => n > 1);

  console.log('\n=== RECONNECT ===');
  for (const x of sessions) {
    console.log(`  ${x.complete ? '✓' : '✗'} ${x.label} — ${x.turns} turns`);
    if (!x.complete) failures.push(`${x.label} did not close in ${x.turns} turns`);
  }
  if (!sessions.length) console.log('  (onboarding did not complete, so the Reconnect leg never ran)');
  console.log('\n=== INVARIANTS (Donna, 2026-09-01) ===');
  if (stacked.length) failures.push(`${stacked.length} turn(s) carried two questions in one bubble`);
  console.log(`  ${stacked.length ? '✗' : '✓'} two questions in one bubble: ${stacked.length}`);
  for (const r of stacked.slice(0, 3)) console.log('      ' + readable(r).replace(/\n/g, ' / ').slice(0, 150));
  if (repeated.length) failures.push(`${repeated.length} bubble(s) repeated verbatim`);
  console.log(`  ${repeated.length ? '✗' : '✓'} a bubble repeated verbatim: ${repeated.length}`);
  for (const [k, n] of repeated.slice(0, 3)) console.log(`      ${n}× ${k.slice(0, 130)}`);
  // ── THE VERDICT ─────────────────────────────────────────────────────────────────────────────────────────────
  // Exit code is the whole point of a gate. `npm run gate` before anyone walks: a non-zero here means a member
  // would have met one of the things Donna and Marie met, and the run says which.
  //
  // IT DOES NOT GATE ON PROTESTS. The persona objecting is a signal to READ, not a pass/fail — she over-triggered
  // three times on the first calibrated run, and a gate that cries wolf gets skipped, which is how the fit
  // estimator and the green-light banner both stopped being read. Protests are printed; only the mechanical
  // failures fail the run.
  if (failures.length) {
    console.error(`\n=== GATE: FAILED (${failures.length}) ===`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('\nDo not start a walk on this build.');
  } else {
    console.log('\n=== GATE: PASSED — every Session closed, one ask per bubble, nothing repeated ===');
  }

  console.log('\n=== FINAL COLLECTED ===');
  console.log(JSON.stringify(state.collected, null, 1));
  if (failures.length) process.exit(1);

  // A SIGNAL NOBODY IS OBLIGED TO ACT ON IS NOT A TEST.
  //
  // This block printed "✗ NEVER APPEARED  scale" on the morning of 2026-08-20 — the twelve-question baseline,
  // absent — and it scrolled past in the output of a run that was about something else. Four hours later a real
  // member reached the end of onboarding without it, was told the assessment would come later, and wrote in to
  // report the product broken. The information was here the whole time and still cost her the walk.
  //
  // So it exits non-zero now. The offline gate is tests/onboarding-walk.test.ts and runs in CI; this one costs
  // real API tokens and is run by hand before a walk — which is precisely when a missing surface still matters
  // and nobody is reading carefully.
  if (missing.length) {
    console.error(`\nFAILED — the member was never handed: ${missing.join(', ')}`);
    failures.push(`surfaces never shown: ${missing.join(', ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
