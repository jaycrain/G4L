// Live onboarding persona walk — a scripted "member" (played by a model) talks to the REAL Companion loop
// (liveTurnStaged), so we can FEEL the drawing-out that offline replay can't exercise. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/persona-walk.ts
// Costs real API tokens (both sides call Claude). Prints the transcript + a per-turn signal so we can see whether
// the loop names an identity unbidden or races the Reclaim List. The persona is built to STRESS both blunders.

import { stagedOpening, liveTurnStaged } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
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
  const messages = history.map((m) => ({
    role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: readable(m.text),
  }));
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: JOANNE_SYSTEM,
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
  // A tap can only ever emit an exact candidate. Match loosely on the model's reply, else take the first.
  const hit = candidates.find((c) => raw.toLowerCase().includes(c.toLowerCase()));
  return hit ?? candidates[0]!;
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

async function main() {
  const open = stagedOpening();
  let state = open.state;
  const history: ConvMessage[] = [{ role: 'agent', text: open.reply }];
  console.log('COMPANION:', readable(open.reply));
  console.log(signal(state));

  const MAX = 30;
  const surfacesSeen = new Set<string>();
  const surfacesTapped = new Set<string>();
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
  // COVERAGE. A surface that never appeared is not a pass — it is an untested path, and saying so is the whole
  // reason this block exists. The four structured surfaces a member meets in onboarding are listed explicitly so
  // an ABSENT one is visible rather than silently missing.
  console.log('\n=== SURFACE COVERAGE ===');
  for (const k of ['identity_pick', 'gap_confirm', 'reclaim_list', 'scale']) {
    const seen = surfacesSeen.has(k);
    console.log(`  ${seen ? (surfacesTapped.has(k) ? '✓ tapped ' : '! typed  ') : '✗ NEVER APPEARED'} ${k}`);
  }
  console.log('\n=== FINAL COLLECTED ===');
  console.log(JSON.stringify(state.collected, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
