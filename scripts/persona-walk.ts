// Live onboarding persona walk — a scripted "member" (played by a model) talks to the REAL Companion loop
// (liveTurnStaged), so we can FEEL the drawing-out that offline replay can't exercise. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/persona-walk.ts
// Costs real API tokens (both sides call Claude). Prints the transcript + a per-turn signal so we can see whether
// the loop names an identity unbidden or races the Reclaim List. The persona is built to STRESS both blunders.

import { stagedOpening, liveTurnStaged } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
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
  for (let i = 0; i < MAX; i++) {
    const joanne = await askJoanne(history);
    console.log('\nJOANNE:', joanne);
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
    console.log('\nCOMPANION:', readable(turn.reply));
    console.log(signal(state));
    if (turn.complete) { console.log('\n=== COMPLETE (turn', i + 1, ') ==='); break; }
  }
  console.log('\n=== FINAL COLLECTED ===');
  console.log(JSON.stringify(state.collected, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
