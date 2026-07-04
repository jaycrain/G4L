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
  {
    // GRACEFUL-DEGRADATION stress test: a real Fade, but answered in the fewest possible words. The excavation has
    // little to synthesize — watch that it reflects HONESTLY ("we're still finding the shape") and never manufactures
    // a pattern out of thin material. One door only.
    name: 'terse',
    committed: {
      identityNoun: 'Runner',
      doors: ['body'],
      gap: 'A knee injury stopped the running, and it never really came back.',
      reclaimList: ['Run again', 'Sleep better', 'Feel like myself'],
    },
    system: `You are role-playing "Sam", who answers in the FEWEST possible words — usually 2-5 words, never more than
one short sentence. Not hostile, just terse and guarded. You do not volunteer; you give a fragment only if asked, and
even then it's minimal.

Your truth (in fragments only): you were a runner — it was how you cleared your head. A knee injury stopped it. You
kept meaning to get back and never did. That's most of it; there isn't a big dramatic story, and you won't invent one.

How to play it:
- Answer in 2-5 words. "Yeah." "Knee gave out." "Didn't go back." "Not sure."
- If the guide digs for meaning or a pattern, stay minimal — "Maybe." "I guess." "Hadn't thought about it." Do NOT
  suddenly become eloquent or hand them a neat insight. You're just not very forthcoming.
- If the guide reflects something back, react briefly and honestly — a small "Yeah, sort of" if it's close, "Not
  really" if it's a reach. Don't over-confirm a pattern you don't feel.`,
  },
  {
    // NO-ADJACENT path: a clean SINGLE-door Fade with real depth, but genuinely no second door. Watch that the
    // excavation goes deep on the one door and does NOT fish for / fabricate an adjacent (the primary-only case).
    name: 'single',
    committed: {
      identityNoun: 'Traveler',
      doors: ['aging_parents'],
      gap:
        'My mother\'s dementia came on fast, and I became her caregiver almost overnight. The version of me that ' +
        'explored and made things just got folded up and put away while I held everything together for her.',
      reclaimList: ['Travel again — even a small trip', 'Get back to painting', 'A morning that\'s mine'],
    },
    system: `You are role-playing "Elena", a 58-year-old woman, warm and thoughtful, who speaks in 2-4 real sentences.
You give genuine depth when the guide draws you out — this door matters to you and you're willing to look at it.

Your story: you were the traveler, the maker — always a trip planned, always painting. Then your mother's dementia
came on fast and you became her full-time caregiver almost overnight. That version of you got folded up and put away
while you held everything together for her. It's been four years.

IMPORTANT — there is only ONE door here:
- Your marriage is steady and good; your husband is supportive. Your own health is fine. Your work was already wound
  down by choice. There is NO second hidden door — the caregiving is simply what took everything.
- If the guide fishes for another door ("was there something else alongside it?"), answer honestly and gently that
  no — there wasn't another thing. This one just quietly took all the room. Don't manufacture a second door to be
  helpful.
- When the guide reflects a real insight about the caregiving and who it pushed out, respond honestly — confirm it
  when it lands ("Yes… that's exactly it"), correct it if it overreaches.`,
  },
  {
    // REVISION (Decision L, slice 1) Gate-3 walk: comes in having named The Marriage, but the drawn-out story is
    // really about carrying everyone — so the excavation should PROPOSE a re-seeing to The Load-Bearer (offered, not
    // asserted), and on confirm swap the primary door + emit the tell. The felt read: does the shift land as "heard
    // more precisely," not "re-interviewed"?
    name: 'revision',
    committed: {
      identityNoun: 'Builder',
      doors: ['marriage'],
      gap: 'My marriage went flat, and somewhere in there the version of me that built things and took chances just went quiet.',
      reclaimList: ['Start making things again', 'One real risk this year', "A weekend that's actually mine"],
    },
    system: `You are role-playing "Dan", 56, measured and honest, 2-4 sentences at a time. When onboarding asked where
the distance started, you reached for THE MARRIAGE — that's the label you named. But as you actually tell the story,
it becomes clear it was never really the marriage as a relationship: you became the one who carried EVERYONE — the
household, the money, your aging father, the business — and there was no room left for you. The marriage is just where
you first noticed the quiet.

Your story (in fragments, as the guide draws it out — don't dump it):
- You were the builder — the one who made things and took chances.
- Over years you became the load-bearer for everyone. You "just handled it." You stopped making things because there
  was no room. You carried the money, the household, your father's care, the business.
- The marriage went flat mostly because you were too depleted to be present — not really the other way around.

How to play it:
- Answer in character, a few sentences at a time. Let the real shape (carrying everyone) come out gradually.
- Do NOT volunteer "load-bearer" yourself early — let the guide earn it from what you say.
- When the guide PROPOSES that the truer door isn't The Marriage but something like carrying-the-load / The
  Load-Bearer, react honestly: if it rings truer than the label you came in with, confirm it plainly ("...yeah. That's
  actually truer. It was never really about her — it was that I was holding all of it."). If it overreaches or feels
  put in your mouth, push back and correct it.`,
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
// Make the revision (§2b Decision L) legible in the walk: a pending proposed re-seeing, and any tell it earned.
function revOf(s: ConvState): string {
  const pr = (s as { pendingRevision?: { fromSlug: string; toSlug: string } }).pendingRevision;
  const tells = (s as { reseeingTells?: Array<{ fromSlug: string; toSlug: string }> }).reseeingTells ?? [];
  const parts: string[] = [];
  if (pr) parts.push(` ⟵ RE-SEEING PROPOSED: ${pr.fromSlug}→${pr.toSlug} (offered, awaiting confirm)`);
  if (tells.length) parts.push(` ✓ TELL EMITTED: ${tells.map((t) => `${t.fromSlug}→${t.toSlug}`).join(', ')}`);
  return parts.join('');
}

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
    console.log(`[MEMBER]\n${m}\n`);
    turn =
      stageOf(state) === 'entry'
        ? applyReconnectTurn(state, history, m, { text: '' }) // entry → doors is deterministic (mirrors the action)
        : await liveTurnReconnect(state, history, m);
    history.push({ role: 'member', text: m });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    console.log(`[COMPANION | ${stageOf(state)} · doors:${JSON.stringify(state.collected.doors ?? [])}]${confOf(state)}${revOf(state)}\n${turn.reply}\n`);
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
