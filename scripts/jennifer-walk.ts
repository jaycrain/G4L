// Jennifer's walk — the live onboarding loop against the three things her real run got wrong (2026-08-05):
//
//   1. Her whole Reclaim List arrived as ONE item, because she typed her goals numbered on a single line.
//   2. Her father's second marriage was tagged as HER Marriage door.
//   3. Her father died a month ago and no Loss door was tagged.
//
// Offline replay can't reach any of these: (1) needs the builder's real submission shape, and (2)+(3) are the
// model's tagging judgement, which only a live turn exercises. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/jennifer-walk.ts
// Costs real API tokens (both sides call Claude). No DB — nothing is written, no member data is touched.

import { stagedOpening, liveTurnStaged } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

const JENNIFER_SYSTEM = `You are role-playing a member in an onboarding conversation with an AI companion for a midlife-identity program. Stay fully in character; never break character or narrate meta.

You are Jennifer, 49. You used to lift seriously and walk every morning with your friend Sarah. The last two years went to your father: he got sick, you drove him to appointments, you managed everything. He died a month ago. You are still numb about it and you say so plainly rather than dramatically.

Something you mention IN PASSING at some point, as background about him and NOT about yourself: your dad's second marriage fell apart a few years before he got sick, and you ended up being the one who held things together for him. This is HIS divorce, not yours — your own marriage is fine and you'd say so if asked.

How you talk:
- Like a real person: brief, 1-3 sentences, one thing at a time. A bit flat and tired.
- Answer what's actually asked. If asked to rate 1-5 or pick, just answer plainly.
- Don't volunteer everything at once; let the companion draw you out.
- If a reflection lands well, you say something short and appreciative like "Perfectly depicted!" or "That's exactly it."`;

// What she types into the list builder — ONE field, her goals numbered inline. This is the verbatim shape of her
// real entry, and the whole reason the list arrived as a single blob.
const JENNIFER_LIST_ENTRY =
  'I want to get back to feeling like myself before Dad got sick. My goals: 1. Back to lifting 3x a week ' +
  '2. Lose 8 lbs 3. Walk daily with Sarah';

async function askJennifer(history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25000,
    maxRetries: 2,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  const messages = history.map((m) => ({
    role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: readable(m.text),
  }));
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: JENNIFER_SYSTEM,
    messages: messages.length ? messages : [{ role: 'user', content: 'Hello.' }],
  });
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

type Expectation = { kind: string; candidates?: string[]; min?: number; seeded?: string[] };

async function tapChip(history: ConvMessage[], candidates: string[]): Promise<string> {
  const raw = await askJennifer([
    ...history,
    { role: 'agent', text: `(Choose ONE of these words: ${candidates.join(', ')}. Reply with just that one word.)` },
  ]);
  return candidates.find((c) => raw.toLowerCase().includes(c.toLowerCase())) ?? candidates[0]!;
}

// THE POINT OF THIS HARNESS: she puts the whole list in one field. The builder now splits an inline enumeration at
// Add-time, so what reaches the engine is one "• " line per want — the same thing the client would send. Running the
// real split here (rather than hand-writing the expected output) is what makes this a test of the shipped code.
async function submitBuilderAsOneField(seeded: string[]): Promise<string> {
  const { splitInlineEnumeration } = await import('../lib/agent/reclaim-shape.ts');
  const added = splitInlineEnumeration(JENNIFER_LIST_ENTRY) ?? [JENNIFER_LIST_ENTRY];
  const all = [...seeded, ...added].filter(Boolean);
  console.log(`      ↳ [she typed ONE field; the builder added ${added.length} chip(s)]`);
  return all.map((i) => `• ${i}`).join('\n');
}

function signal(state: ConvState): string {
  const c = state.collected ?? {};
  const list = c.reclaimList ?? [];
  return `      ↳ [stage=${state.stage} · doors=${JSON.stringify(c.doors ?? [])} · reclaimList(${list.length})=${JSON.stringify(list)}]`;
}

async function main() {
  const open = stagedOpening();
  let state = open.state;
  const history: ConvMessage[] = [{ role: 'agent', text: open.reply }];
  console.log('COMPANION:', readable(open.reply));

  const MAX = 30;
  let expects: Expectation | undefined = (open as { expects?: Expectation }).expects;
  for (let i = 0; i < MAX; i++) {
    let jennifer: string;
    let via = '';
    if (expects?.kind === 'identity_pick' && (expects.candidates ?? []).length) {
      jennifer = await tapChip(history, expects.candidates!);
      via = ' [tapped a chip]';
    } else if (expects?.kind === 'reclaim_list') {
      jennifer = await submitBuilderAsOneField(expects.seeded ?? []);
      via = ' [submitted the list builder]';
    } else {
      jennifer = await askJennifer(history);
    }
    console.log('\nJENNIFER' + via + ':', jennifer);
    let turn;
    try {
      turn = await liveTurnStaged({} as never, history, state, jennifer);
    } catch (e) {
      console.log('  [liveTurnStaged error]', (e as Error).message);
      break;
    }
    history.push({ role: 'member', text: jennifer });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    expects = (turn as { expects?: Expectation }).expects;
    console.log('\nCOMPANION:', readable(turn.reply));
    console.log(signal(state));
    if (turn.complete) { console.log('\n=== COMPLETE (turn', i + 1, ') ==='); break; }
  }

  const c = state.collected ?? {};
  const doors: string[] = (c.doors ?? []) as string[];
  const list: string[] = c.reclaimList ?? [];
  console.log('\n=== THE THREE THINGS HER REAL RUN GOT WRONG ===');
  const blob = list.find((x) => x.length > 200);
  console.log(`  1. list arrived split?      ${blob ? `NO — a ${blob.length}-char blob survived` : `YES — ${list.length} items, longest ${Math.max(0, ...list.map((x) => x.length))} chars`}`);
  console.log(`     "Lose 8 lbs" reachable?  ${list.some((x) => /lose 8/i.test(x)) ? 'YES' : 'NO — the goal is lost again'}`);
  console.log(`  2. her father's divorce → marriage door?  ${doors.includes('marriage') ? 'TAGGED — still wrong' : 'not tagged ✓'}`);
  console.log(`  3. her father's death → loss door?        ${doors.includes('loss') ? 'TAGGED ✓' : 'MISSED — still wrong'}`);
  console.log(`     doors: ${JSON.stringify(doors)}`);
  console.log('\n=== FINAL COLLECTED ===');
  console.log(JSON.stringify(c, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
