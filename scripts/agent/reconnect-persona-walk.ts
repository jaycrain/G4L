// Live persona walk of the §2b Doors Excavation (Reconnect arc, increment 1). A second model in PERSONA plays the
// member through the REAL Reconnect engine (reconnectOpening → applyReconnectTurn → liveTurnReconnect) so a deep,
// consistent walk can be reproduced on demand — no manual re-improvising, and NO account/DB (state is in-memory,
// captures are seeded from the persona). Mirrors scripts/onboarding-eval.ts.
//
// It calls the engine directly, so it BYPASSES the RECONNECT route-gate — it walks the NEW arc regardless of the
// preview flag. Needs ANTHROPIC_API_KEY (e.g. in .env.local).
//
// Run:  node --env-file=.env.local --experimental-strip-types scripts/agent/reconnect-persona-walk.ts
//       node --env-file=.env.local --experimental-strip-types scripts/agent/reconnect-persona-walk.ts grind   (by name)
//
// It's a felt-read REPORT, not a CI gate (cost + nondeterminism). Read the transcript — especially the INSIGHT
// REFLECT — against the bar: does it make you go "huh, I hadn't put it together like that," or does it just say
// your doors back? Is it presumptuous? Does it degrade gracefully on a thin answer?

import { reconnectOpening, applyReconnectTurn, liveTurnReconnect } from '../../lib/agent/reconnect.ts';
import type { Collected, ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY (e.g. add it to .env.local) — this walk drives the real model.');
  process.exit(1);
}

type Persona = { name: string; committed: Collected; system: string };

const PERSONAS: Persona[] = [
  {
    // Jay's deep walk persona, reconstructed from the walk screenshots. ADJUST `committed` to match the real
    // committed captures if they differ (identity noun / door slugs / gap / reclaim). The `system` brief is the
    // character that answers the excavation.
    name: 'grind',
    committed: {
      identityNoun: 'Racer', // the code renders this as "the Racer" (natural case)
      doors: ['grind', 'marriage'], // The Grind (primary) + The Marriage (second)
      gap:
        'I built a business, and over the years the weight of everyone counting on me — my family, my employees, my ' +
        'investors — turned my own ambitions into something that felt selfish, even dangerous. The guilt closed the ' +
        'gap. The bike, the risk, the thing that was mine got handed over to everyone else\'s need for me to be safe.',
      reclaimList: [
        'Riding my bike, 2-3 short rides a week to start',
        'Lose about 25 lbs',
        'Core work, 2-3 days a week',
        'Ride with groups and friends more',
      ],
    },
    system: `You are role-playing a 54-year-old man named Marcus in a one-on-one conversation with a reflective guide
about the "doors" that opened the gap between who he was and who he is now. Respond ONLY as Marcus — first person,
1-3 honest sentences at a time, measured and a little guarded, sometimes terse ("Hard to say."). Reveal depth when
the guide genuinely draws you out; don't dump it all at once.

Your story (give it in fragments as the guide draws it out — do NOT recite it):
- At your best you were a triathlete. Cycling was your favorite and what you were best at — the version of you that
  moved, competed, took a risk. Disciplined, up early, fit.
- THE GRIND (the main door): you built a company. Over years the weight of everyone counting on you — family,
  employees, investors — turned your own ambitions (the bike, the racing, the risk) into something that felt selfish,
  even dangerous. Guilt closed the gap. You handed the thing that was yours over to everyone else's need for you to
  be safe and reliable. You "just did what had to be done" — you stopped counting the cost.
- THE MARRIAGE (the second door): you were unhappy in your marriage. Your wife believed she was supporting you while
  doing things that quietly undermined your confidence. It was already there, inside the house, running alongside the
  grind — and honestly it landed deeper.

How to play it:
- Answer the guide's questions in character. If asked what actually happened / when you first felt it / what it cost,
  give a real, specific fragment — not a summary.
- When the guide reflects an INSIGHT back (a pattern or connection across it), react honestly: if it genuinely lands
  and shows you something you hadn't put into words, say so plainly ("Yeah. That's it." / "...huh. I hadn't thought of
  it that way, but yes."). If it's off or presumptuous, push back and correct it ("No — it wasn't really about X.").
- Keep every message short. One thought at a time.`,
  },
];

async function member(system: string, history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
    defaultHeaders: { 'accept-encoding': 'identity' },
  });
  // From the persona's POV the guide (agent) speaks as 'user', the persona itself as 'assistant'.
  const messages = history.map((m) => ({
    role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.text,
  }));
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 250,
    system,
    messages: messages.length ? messages : [{ role: 'user', content: '(the guide is ready for you)' }],
  });
  return (res.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim();
}

const stageOf = (s: ConvState) => (s as { stage?: string }).stage ?? '-';
const confOf = (s: ConvState) => ((s as { awaitingConfirm?: boolean }).awaitingConfirm ? ' ⟵ INSIGHT REFLECT (awaiting confirm)' : '');

async function runPersona(p: Persona): Promise<void> {
  console.log(`\n══════════ persona: ${p.name} ══════════`);
  console.log(`seeded doors: ${JSON.stringify(p.committed.doors)}  identity: ${p.committed.identityNoun ?? '(skipped)'}\n`);

  let turn: Turn = reconnectOpening(p.committed); // stage 'entry', reply = the callback
  let state = turn.state;
  const history: ConvMessage[] = [{ role: 'agent', text: turn.reply }];
  console.log(`[COMPANION | ${stageOf(state)}]\n${turn.reply}\n`);

  // Walk until the Doors beat hands off (stage advances past 'doors') or completes, capped for safety.
  for (let i = 0; i < 16 && !turn.complete && stageOf(state) !== 'measurement'; i++) {
    const m = await member(p.system, history); // history holds prior turns only — the engine appends this message
    console.log(`[MARCUS]\n${m}\n`);
    turn =
      stageOf(state) === 'entry'
        ? applyReconnectTurn(state, history, m, { text: '' }) // entry → doors is deterministic (mirrors the action)
        : await liveTurnReconnect(state, history, m);
    history.push({ role: 'member', text: m });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    console.log(`[COMPANION | ${stageOf(state)}]${confOf(state)}\n${turn.reply}\n`);
  }

  console.log('──────────');
  console.log(`ended at stage: ${stageOf(state)}  ${stageOf(state) === 'measurement' ? '(Doors beat handed off ✓)' : '(did not hand off — read why above)'}`);
}

const only = process.argv[2];
const toRun = only ? PERSONAS.filter((p) => p.name === only) : PERSONAS;
if (toRun.length === 0) {
  console.error(`no persona named "${only}". available: ${PERSONAS.map((p) => p.name).join(', ')}`);
  process.exit(1);
}
for (const p of toRun) {
  try {
    await runPersona(p);
  } catch (e) {
    console.log(`\n### ${p.name} — ✗ errored: ${(e as Error)?.message}`);
  }
}
