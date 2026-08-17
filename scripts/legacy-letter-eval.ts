// LIVE EVAL — does the Legacy Letter sound like the MEMBER, or like us?
//
// WHY. The letter is the one artifact in the product written in the member's own first person. Every other
// surface is us talking to them; this is them talking to themselves, and we draft it. A draft that sounds like us
// is worse than no draft, because they will accept it rather than argue with it — and then it is our letter with
// their name on it, filed under "Who you are". No unit test can see that. Only a live turn can.
//
// The replay fixtures already prove the STRUCTURE (a draft is a proposal, the cap holds, a beat that never
// drafted claims nothing). This examines the TEXT.
//
// Costs real API tokens. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/legacy-letter-eval.ts

import { liveTurnReconnect } from '../lib/agent/reconnect.ts';
import { BEAT_SEP, type ConvMessage, type ConvState } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

// A member with a real voice — plain, unpolished, specific. Their phrasing is the thing the letter must keep.
const TUESDAY = 'up before the house, coffee on the porch, out on the bike before it gets hot';
const ANSWERS = [
  "riding the Peak to Peak with my brother. we said we'd do it for about nine years and never did.",
  "my daughter. she's 16 and I've been kind of absent, if I'm honest. I want her to see me try at something.",
  "I'd stop apologising for taking the time. that's the thing I keep doing.",
  "the weight thing I guess. I don't really want to talk about it but it's there.",
];

const CHECKS: { name: string; fail: (t: string) => string | null }[] = [
  {
    name: 'no praise, no pep — the two things Greg rules out by name',
    fail: (t) =>
      /you'?ve got this|you can do this|imagine the possibilities|believe in yourself|proud of you|amazing|incredible|you deserve/i.test(t)
        ? 'pep-talk language reached the letter'
        : null,
  },
  {
    name: 'promises no outcome',
    fail: (t) => (/you will (?:be|have|feel|become)\b|this will (?:make|give|bring)|by then you'?ll have\b/i.test(t) ? 'promised an outcome' : null),
  },
  {
    name: 'keeps THEIR words — the specifics they gave, not upgraded synonyms',
    fail: (t) => {
      const kept = ['peak to peak', 'brother', 'porch', 'bike', 'daughter'].filter((w) => t.toLowerCase().includes(w));
      return kept.length < 3 ? `only kept ${kept.length} of their own specifics (${kept.join(', ') || 'none'})` : null;
    },
  },
  {
    name: 'does not invent ground they left alone',
    fail: (t) =>
      /\b(?:my wife|my husband|my son|my job|my career|my doctor|the gym|the scale)\b/i.test(t)
        ? 'introduced a person or place they never named'
        : null,
  },
  {
    name: 'half a page, not an essay',
    fail: (t) => {
      const words = t.trim().split(/\s+/).length;
      return words > 320 ? `${words} words — longer than the half page Greg specifies` : null;
    },
  },
  {
    name: 'reads as a letter to themselves, not a report about them',
    fail: (t) => (/\bthe member\b|\bthis member\b|they have been|their identity/i.test(t) ? 'wrote ABOUT them, not AS them' : null),
  },
];

async function run() {
  let state: ConvState = { stage: 'legacy', collected: { identityNoun: 'Rider', doors: ['grind'] }, legacyTuesday: TUESDAY };
  let history: ConvMessage[] = [];
  let draft: string | null = null;

  for (const [i, msg] of ANSWERS.entries()) {
    const turn = await liveTurnReconnect(state, history, msg);
    const reply = readable(turn.reply);
    console.log(`\n── turn ${i + 1} ──────────────────────────────────────────────────────────────────`);
    console.log(`MEMBER: ${msg}`);
    console.log(`COMPANION: ${reply}`);
    history = [...history, { role: 'member', text: msg }, { role: 'agent', text: reply }];
    state = turn.state;
    if (turn.state.legacyDraft) { draft = turn.state.legacyDraft; break; }
  }

  console.log(`\n${'═'.repeat(100)}`);
  if (!draft) {
    console.log('NO DRAFT after all answers — the model never called record_legacy_letter. That is the failure to fix.');
    // Not asking the Tuesday again is still worth checking even on this path.
    process.exit(1);
  }
  console.log('THE LETTER\n');
  console.log(draft);
  console.log(`\n${'═'.repeat(100)}`);

  const failures = CHECKS.map((c) => ({ c, why: c.fail(draft!) })).filter((x) => x.why);
  for (const { c, why } of failures) console.log(`  ✖ ${c.name}\n      ${why}`);
  if (!failures.length) console.log('  ✔ all checks passed');

  // Asked separately because it is about the CONVERSATION, not the letter: their Tuesday came from the Window
  // beat and re-asking it is the product not listening.
  const asked = history.filter((m) => m.role === 'agent').map((m) => m.text).join(' ');
  if (/what does a tuesday look like|ordinary (?:day|tuesday)/i.test(asked)) {
    console.log('  ✖ re-asked the Tuesday it was already handed');
    failures.push({ c: CHECKS[0]!, why: 'x' });
  }

  console.log('\nJudgement still required: read it aloud. Does it sound like the person who wrote those answers?');
  process.exit(failures.length ? 1 : 0);
}

await run();
