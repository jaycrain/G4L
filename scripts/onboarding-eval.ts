// Live-model onboarding eval — plays a scripted "member" (a second model in persona) through the REAL
// onboarding model + engine, then reports what got captured. Spares a human tester and exercises the live
// model the replay fixtures can't. No DB writes (onboardingNextTurn doesn't persist). Needs ANTHROPIC_API_KEY.
//
// Run: node --env-file-if-exists=.env.local --experimental-strip-types scripts/onboarding-eval.ts
//
// The persona is Rita/Donna's multi-Door fade — the case that exposed the "Doors dropped" bug — so the
// Door check at the end tells us whether the real model + the accumulate fix now land all of them.

import { onboardingNextTurn, INITIAL_STATE, type ConvState, type ConvMessage } from '../lib/agent/onboarding.ts';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY (e.g. add it to .env.local) — this eval drives the real model.');
  process.exit(1);
}

const RITA = `You are role-playing "Rita", a 57-year-old woman in an onboarding conversation with a guide.
Respond ONLY as Rita — 1-3 short, honest sentences, one thought at a time. Reveal your story progressively;
do not dump it all at once. Your story:
- Laid off at 57 after 12 years, right before a promotion that would have secured your family's future. You'd felt at the top of your game; suddenly you were treated as having no value.
- You've been the sole breadwinner for years while your husband has been out of work — you funded his bikes and European cycling trips, always expecting he'd return to work. When you were laid off you needed him to step up; he didn't. Savings are gone; the house (20 years, 7 blocks from your daughter who will soon have kids) is at risk — he'd sell it without trying.
- Around the same time your father fell into a coma twice and nearly died, and back in your hometown you saw how much your mother's health and independence had declined — you're becoming the one who cares for them.
- Who you were at your best: energetic, optimistic, led big teams, mentored people, supported friends and family, fun and funny, healthy.
- If asked to name that person in ONE word, you're not sure yet — you'd rather find it later through the work.
- What you want back (reclaim list): more paid design and writing work, finish the podcast you're developing, direct and produce another short documentary, lose 20 pounds, feel at ease in your own home without walking on eggshells.
- If asked how the gap opened, tell the layered story: the job loss, carrying the household alone, AND your parents' decline.
Answer the guide's latest message as Rita. If asked whether there's more, share another true piece until your whole story is out, then say that's the full picture.`;

async function rita(history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
    defaultHeaders: { 'accept-encoding': 'identity' }, // sidestep node-fetch gzip bug on newer Node
  });
  const messages = history.map((m) => ({
    role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.text,
  }));
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    system: RITA,
    messages: messages.length ? messages : [{ role: 'user', content: '(the guide is ready for you)' }],
  });
  return (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join(' ')
    .trim();
}

const ctx = { name: 'Rita', email: 'rita-eval@example.test' };
let state: ConvState = INITIAL_STATE;
const history: ConvMessage[] = [];

let turn = await onboardingNextTurn({ ctx, state, history, memberMessage: null });
console.log('GUIDE:', turn.reply.replace(/\n+/g, ' ').slice(0, 220), '…\n');
history.push({ role: 'agent', text: turn.reply });
state = turn.state;

for (let i = 0; i < 30 && !turn.complete; i++) {
  const memberMsg = await rita(history);
  console.log('RITA :', memberMsg, '\n');
  history.push({ role: 'member', text: memberMsg });
  turn = await onboardingNextTurn({ ctx, state, history, memberMessage: memberMsg });
  console.log('GUIDE:', turn.reply.replace(/\n+/g, ' '), '\n');
  history.push({ role: 'agent', text: turn.reply });
  state = turn.state;
}

const c = state.collected;
console.log('\n========= CAPTURED =========');
console.log('complete     :', turn.complete);
console.log('doors        :', c.doors ?? []);
console.log('identity     :', c.identitySkipped ? '(skipped)' : (c.identityNoun ?? '(none)'));
console.log('reclaim items:', (c.reclaimList ?? []).length);
console.log('gap          :', (c.gap ?? '').slice(0, 500));
const want = ['career_cliff', 'load_bearer', 'aging_parents'];
const got = new Set(c.doors ?? []);
console.log('\nDoor check   :', want.map((d) => `${d}:${got.has(d) ? '✓' : '✗ MISSING'}`).join('   '));
console.log('(career_cliff = job loss · load_bearer = carrying the household · aging_parents = her parents)');
