// Jennifer, part two — Reconnect §2c/§2d, the two keepers.
//
// The draw-out advances on the turn the reflection LANDS, which is exactly the turn a member says something
// appreciative. That turn's message was being stored wholesale, so "Perfectly depicted!" became her Playbook keeper
// under "The drift" — a keeper that tells her nothing about her own life, and that the Companion will later recall
// back to her as if it were her own account. Greg hit the identical thing. The same code runs The Spark.
//
// Unit tests cover the predicate; they cannot cover the SEAM — whether the payload the engine actually queues is the
// substantive line or the praise. That needs a live draw-out, because the model decides when to advance. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/jennifer-reconnect-walk.ts
// Costs real API tokens. No DB — nothing is written, no member data is touched.

import { liveTurnReconnect, driftOpen, BEAT_SEP } from '../lib/agent/reconnect.ts';
import { isKeeperMaterial } from '../lib/agent/reconnect.ts';
import type { Collected, ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

// Her committed captures, as the onboarding walk produced them.
const JENNIFER: Collected = {
  identityNoun: 'Lifter',
  doors: ['aging_parents', 'loss'],
  gap:
    "My dad got sick about two years ago, and caring for him took over — driving him to appointments, managing his " +
    "medications, being the person he called. The lifting stopped first, then the morning walks with Sarah faded " +
    "out. I kept thinking I'd get back to it once things settled down, but they never did. He died a month ago.",
  reclaimList: [
    'I want to get back to feeling like myself before Dad got sick.',
    'Back to lifting 3x a week',
    'Lose 8 lbs',
    'Walk daily with Sarah',
  ],
};

const JENNIFER_SYSTEM = `You are role-playing a member in a reflective conversation with an AI companion for a midlife-identity program. Stay fully in character; never break character or narrate meta.

You are Jennifer, 49. You used to lift three days a week and walk every morning with your friend Sarah. The last two years went to caring for your father; he died a month ago. You are tired and a bit numb, and you talk plainly rather than dramatically.

How you talk:
- Brief, 1-3 sentences. One thing at a time. Let the companion draw you out.
- When you describe how things slipped away, be concrete and specific about YOUR life.
- IMPORTANT: the FIRST time the companion reflects a whole pattern back to you and asks whether it's right, you REJECT it — reply with exactly "Not really, no." and nothing else. No explanation. You are not being difficult; it just hasn't landed yet.
- After that first rejection, when a reflection lands you react with short warm praise and nothing else — exactly things like "Perfectly depicted!" or "That's exactly it." Do NOT add new detail on those turns; just the praise.`;

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

async function main() {
  // Enter at the drift beat with her captures already committed — §2a/§2b (the 24-item IDQ and the Door beat) are
  // upstream of the keepers and exercised elsewhere.
  const opener = driftOpen(JENNIFER);
  let state: ConvState = { stage: 'drift', collected: JENNIFER };
  const history: ConvMessage[] = [{ role: 'agent', text: opener }];
  console.log('COMPANION:', readable(opener));

  const said: string[] = [];
  for (let i = 0; i < 16; i++) {
    const jennifer = await askJennifer(history);
    said.push(jennifer);
    console.log('\nJENNIFER:', jennifer, isKeeperMaterial(jennifer) ? '   [material]' : '   [praise/assent]');
    let turn;
    try {
      turn = await liveTurnReconnect(state, history, jennifer);
    } catch (e) {
      console.log('  [liveTurnReconnect error]', (e as Error).message);
      break;
    }
    history.push({ role: 'member', text: jennifer });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    const queued = (state as { pendingHarvest?: { label: string; payloadRef: string }[] }).pendingHarvest ?? [];
    console.log('\nCOMPANION:', readable(turn.reply));
    console.log(`      ↳ [stage=${state.stage} · keepers queued=${queued.length}]`);
    if (state.stage === 'checkpoint' || turn.complete) break;
  }

  const queued = (state as { pendingHarvest?: { label: string; payloadRef: string }[] }).pendingHarvest ?? [];
  console.log('\n=== THE KEEPERS THIS WALK WOULD COMMIT ===');
  if (!queued.length) console.log('  (none queued — the draw-out did not reach a confirm in this many turns)');
  let bad = 0;
  for (const k of queued) {
    const ok = isKeeperMaterial(k.payloadRef);
    if (!ok) bad++;
    console.log(`  ${ok ? '✓' : '✗'} ${k.label}: "${k.payloadRef}"`);
  }
  const praised = said.filter((s) => !isKeeperMaterial(s));
  console.log(`\n  she gave ${praised.length} praise/assent turn(s): ${JSON.stringify(praised)}`);
  console.log(`  a praise line became a keeper? ${bad ? 'YES — still broken' : 'no ✓'}`);
  const rejected = said.some((s) => /^not really/i.test(s.trim()));
  console.log(`  she rejected a reflection? ${rejected ? 'yes — check the reply above REOPENED rather than moving on' : 'no (persona did not reject)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
