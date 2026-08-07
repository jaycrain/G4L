// C1 Step 2 — does the live refine conversation actually run Greg's SIX revision questions?
//
// Greg's spec (C1 Companion Memo "six core ReClaim questions" / Engineering Memo stages 2–7) is an ORDERED sequence,
// each with its own coaching function:
//   1 enduring     — which still matter most?          (elicit enduring motivation)
//   2 de-prioritized — which feel less important now?  (adaptive de-prioritization without shame)
//   3 borrowed     — which were vague or borrowed?     (test self-concordance)
//   4 concretized  — which feel more concrete now?     (sharpen into usable goals)
//   5 emergent     — what NEW priorities appeared?     (allow emergent goals, not just edits)
//   6 reorder      — what belongs at the top now?      (force prioritization)
//
// Our build runs a freer coach conversation that proposes a tiered list. The question this settles: does the member
// get asked all six, or does the model cover some and skip others? Coverage is judged on the COMPANION'S OWN WORDS,
// matched per stage, so this measures what the member was actually asked — not what the prompt hoped for.
//
//   node --experimental-strip-types --env-file=.env.local scripts/c1-refine-walk.ts
// Real API on both sides. No DB.

import { liveTurnReclaimRefine, reclaimC1Opening } from '../lib/agent/reclaim.ts';
import { BEAT_SEP, type ConvMessage, type ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

// A member arriving at C1 with a real onboarding list.
const LIST = [
  'Get back to lifting 3x a week',
  'Walk daily with Sarah',
  'Lose 8 lbs',
  'Be someone my kids see moving',
  'Read before bed again',
];

const MEMBER_SYSTEM = `You are role-playing a member in a reflective conversation with an AI companion for a midlife-identity program. Stay in character; never narrate meta.

You are Dana, 51. You have worked through Reconnect, Rewire and Rebuild over the last few months and are now revisiting the ReClaim List you wrote at the very beginning. Your list was: ${LIST.map((l) => `"${l}"`).join(', ')}.

How you feel about it now, revealed only when asked:
- Lifting and walking with Sarah still matter most — those are the real ones.
- "Lose 8 lbs" now feels borrowed. It was a number you thought you were supposed to want.
- "Be someone my kids see moving" has become much more concrete — it means Saturday mornings, specifically.
- Something new has emerged that wasn't on the list: you want to sleep properly. It underpins everything else.
- "Read before bed again" matters less than it did.

How you talk: brief, 1-3 sentences, one thing at a time. Answer what's actually asked and don't volunteer the rest.`;

async function askMember(history: ConvMessage[]): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 2, defaultHeaders: { 'accept-encoding': 'identity' } });
  const messages = history.map((m) => ({ role: (m.role === 'agent' ? 'user' : 'assistant') as 'user' | 'assistant', content: readable(m.text) }));
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 300, system: MEMBER_SYSTEM,
    messages: messages.length ? messages : [{ role: 'user', content: 'Hello.' }],
  });
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

// Greg's six, matched on what the COMPANION asked. Generous patterns — the point is to find what was never raised
// at all, not to grade phrasing.
const STAGES: { id: string; label: string; re: RegExp }[] = [
  { id: '1 enduring', label: 'which still matter most', re: /\b(still (feel|matter|alive|true|important)|most alive|matter most|still hold)\b/i },
  { id: '2 de-prioritized', label: 'which feel less important', re: /\b(less (important|central|urgent)|no longer|not as central|fallen away|let go of)\b/i },
  { id: '3 borrowed', label: 'which were borrowed or vague', re: /\b(borrowed|someone else'?s|sound(s)? right but|fully yours|vague|aspirational|supposed to want)\b/i },
  { id: '4 concretized', label: 'which feel more concrete now', re: /\b(more (concrete|specific|tangible|clear)|clearer|sharper|what (that|it) actually looks like)\b/i },
  { id: '5 emergent', label: 'what new has emerged', re: /\b(new|emerged|wasn'?t (on|there)|anything else become|come up since|newly important)\b/i },
  { id: '6 reorder', label: 'what belongs at the top', re: /\b(top of|reorder|re-rank|order|which (one|three) first|priorit(y|ies|ise|ize))\b/i },
];

async function main() {
  // Start from the REAL entry point rather than a hand-written approximation. Since 2026-08-07 this opener is also the
  // FIRST thing a member sees in C1 (Greg cut the evidence self-check that used to precede it), so it is load-bearing
  // in a way it wasn't when this harness was written.
  const open = reclaimC1Opening([...LIST]);
  let state: ConvState = open.state;
  const opener = readable(open.reply);
  const history: ConvMessage[] = [{ role: 'agent', text: open.reply }];
  console.log('COMPANION:', opener, '\n');

  const asked = new Map<string, string>(); // stage id → the companion line that raised it

  for (let i = 0; i < 26; i++) {
    const member = await askMember(history);
    console.log('DANA:', member);
    let turn;
    try {
      turn = await liveTurnReclaimRefine(state, history, member);
    } catch (e) {
      console.log('  [liveTurnReclaimRefine error]', (e as Error).message);
      break;
    }
    history.push({ role: 'member', text: member });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    const reply = readable(turn.reply);
    console.log('\nCOMPANION:', reply, '\n');
    for (const s of STAGES) if (!asked.has(s.id) && s.re.test(reply)) asked.set(s.id, reply.slice(0, 90));
    if (turn.complete) { console.log('=== COMPLETE (turn', i + 1, ') ===\n'); break; }
  }

  console.log('=== DID THE MEMBER GET GREG’S SIX QUESTIONS? ===');
  for (const s of STAGES) {
    const hit = asked.get(s.id);
    console.log(`  ${hit ? '✓' : '✗'} ${s.id.padEnd(18)} ${s.label}${hit ? `\n        → "${hit}…"` : ''}`);
  }
  console.log(`\n  covered ${asked.size}/6`);
  const finalList = (state.collected?.reclaimList ?? []) as string[];
  console.log('\n=== THE LIST AFTER ===');
  finalList.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  console.log('\n  new item added (emergent goal)? ', finalList.length > LIST.length ? 'YES' : 'no — the list only shrank or held');
  const pend = (state.collected as { pendingRefinement?: { items?: unknown[]; top3?: string[] } })?.pendingRefinement;
  console.log('  tiered proposal formed?          ', pend?.items?.length ? `YES (${pend.items.length} items)` : 'no');
  console.log('  top-3 reorder captured?          ', pend?.top3?.length ? `YES — ${JSON.stringify(pend.top3)}` : 'no');
}

main().catch((e) => { console.error(e); process.exit(1); });
