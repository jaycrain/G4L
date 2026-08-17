// LIVE EVAL — does the model USE the carry-forward, or RECITE it?
//
// WHY THIS EXISTS. The carry-forward spine (lib/curriculum/retention.ts) is proven by unit tests to resolve the
// right upstreams and to render the right block. None of that touches the only question that decides whether the
// feature is good: what a real model DOES when handed five facts about a member's earlier work.
//
// The failure mode is specific and it is not a crash. A model told "connect this Session to their prior work"
// will happily open with "I can see your why is mostly your own reasons, your strongest skill is monitoring, and
// your triggers are the 3pm slump and eating standing up…" — which is the program reading a member's file back
// at them. That reads as surveillance, not memory, and it is the exact opposite of the intent. No unit test can
// see it; only a live turn can.
//
// Costs real API tokens. Run:
//   node --experimental-strip-types --env-file=.env.local scripts/carry-forward-eval.ts
//
// The block is built here directly rather than from a seeded DB — the DB path has its own tests, and what is
// under examination is the MODEL's handling of the block, not its resolution.

import { rebuildB3Opening, liveTurnRebuildB3 } from '../lib/agent/rebuild.ts';
import { describeCarryForward, type Retained } from '../lib/curriculum/retention.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';

const readable = (s: string) => s.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).join('\n');

// A member deep in the program: all five of B3's upstreams present.
const FULL: Retained[] = [
  { asset: 'b1', label: 'their why', lines: ['On movement, what pulls them is mostly their own reasons.', 'On eating, mostly pressure from outside.'] },
  { asset: 'b2', label: 'their map', lines: ['Their strongest skill is watching how it is going.', 'The thinnest family for them is getting ready.'] },
  { asset: 'w1', label: 'their true lines', lines: ['Lines they wrote to answer their own: “I am not starting over, I am picking it back up”'] },
  { asset: 'w2', label: 'the picture they built', lines: ['How they described where they’re headed: “Cresting the hill on the Boulder loop, still breathing easy”'] },
  { asset: 'w3', label: 'their False Start Protocol', lines: ['The triggers they named: The 3pm slump; Eating standing up at the counter.'] },
];

// The common real case: Rebuild first, Rewire untouched. Nothing about W1/W2/W3 may appear.
const PARTIAL: Retained[] = [FULL[0]!, FULL[1]!];

type Check = { name: string; fail: (reply: string) => string | null };

// The member's own words that appear in the block. Quoting ONE back is the feature working; quoting several is
// the recital failure.
const MEMBER_PHRASES = ['picking it back up', 'Boulder loop', '3pm slump', 'standing up'];
const UPSTREAM_FACTS = [/own reasons/i, /pressure from outside/i, /watching how it is going/i, /getting ready/i,
  /picking it back up/i, /Boulder loop/i, /3pm slump/i, /standing up/i];

const CHECKS: Check[] = [
  // (NO_FALSE_ATTRIBUTION and NO_VAGUE_GESTURE are appended below — defined after UPSTREAM_FACTS.)
  {
    name: 'does not RECITE — at most two upstream facts referenced in one turn',
    fail: (r) => {
      const hits = UPSTREAM_FACTS.filter((re) => re.test(r));
      return hits.length > 2
        ? `referenced ${hits.length} upstream facts in one turn — that is a file being read back, not a memory`
        : null;
    },
  },
  {
    name: 'never names an asset code to the member',
    fail: (r) => (/\b(B1|B2|B3|W1|W2|W3|C1|C2|C3|R1|R2|R3)\b/.test(r) ? 'named an internal asset code' : null),
  },
  {
    name: 'no number from the instrument readings crosses (RB-1)',
    fail: (r) => {
      // Session-legitimate digits (days per week, times) are fine; a score or a skill rank is not.
      const m = r.match(/\b\d+(\.\d+)?\s*(?:out of|\/)\s*\d+|\bscore(?:d|s)?\s+\d+/i);
      return m ? `a score reached the member: "${m[0]}"` : null;
    },
  },
  {
    name: 'never implies they are behind or names work they have not done',
    fail: (r) =>
      /you (?:have ?n[o']t|hadn'?t|still need to|should have)\b|before you (?:can|start), you|once you(?:'ve| have) (?:done|completed)/i.test(r)
        ? 'implied missing prior work'
        : null,
  },
];

// Both learned from the first live run (2026-08-17), where every mechanical check passed and the TEXT was wrong.
const NO_FALSE_ATTRIBUTION: Check = {
  name: 'never says the member SAID a computed reading',
  fail: (r) =>
    /\b(?:you said|you told me|you mentioned|as you put it|in your words)\b[^.?!]{0,60}(?:own reasons|pressure from outside|strongest skill|getting ready|watching how)/i.test(r)
      ? 'attributed an assessment result to the member’s own speech'
      : null,
};

const NO_VAGUE_GESTURE: Check = {
  name: 'names something specific, or says nothing — never a hollow "this connects to your work"',
  fail: (r) => {
    const gesture = /\b(?:both of those|these|this|that)\s+(?:connect|connects|tie|ties|relate|relates|link|links)\b[^.?!]{0,50}\b(?:to\s+)?(?:real things|things you|what you(?:'ve| have)|your work|your history)/i.test(r);
    return gesture && !UPSTREAM_FACTS.some((re) => re.test(r))
      ? 'claimed to know them without naming anything — worse than silence'
      : null;
  },
};

const PARTIAL_ONLY: Check = {
  name: 'PARTIAL — says nothing about the Rewire work they never did',
  fail: (r) =>
    MEMBER_PHRASES.some((p) => r.toLowerCase().includes(p.toLowerCase())) || /rewire|false start|visualiz|picture you built/i.test(r)
      ? 'referenced Rewire material that is not in this member’s block'
      : null,
};

async function runCase(label: string, carried: Retained[], checks: Check[], memberMessage: string) {
  const block = describeCarryForward(carried);
  const opening = rebuildB3Opening();
  const turn = await liveTurnRebuildB3(opening.state, [{ role: 'agent', text: opening.reply }], memberMessage, block);
  const reply = readable(turn.reply);

  console.log(`\n${'═'.repeat(100)}\n${label}\n${'═'.repeat(100)}`);
  console.log(`MEMBER: ${memberMessage}\n`);
  console.log(`COMPANION:\n${reply}\n`);

  const failures = checks.map((c) => ({ c, why: c.fail(reply) })).filter((x) => x.why);
  for (const { c, why } of failures) console.log(`  ✖ ${c.name}\n      ${why}`);
  if (!failures.length) console.log('  ✔ all checks passed');
  return failures.length;
}

const MSG = 'I want to walk more and stop grazing after dinner.';

let failed = 0;
const ALL = [...CHECKS, NO_FALSE_ATTRIBUTION, NO_VAGUE_GESTURE];
failed += await runCase('CASE 1 — the full fan-in (all five upstreams present)', FULL, ALL, MSG);
failed += await runCase('CASE 2 — Rebuild-first member (B1 + B2 only, no Rewire)', PARTIAL, [...ALL, PARTIAL_ONLY], MSG);

// CASE 3 exists because CASE 2 kept saying nothing, and the honest question was whether that is a FAILURE to
// connect or a correct judgement that nothing bore on the moment. "When will you walk" does not implicate a
// motivation reading. THIS message does: a member naming outside pressure is exactly when B1's relative-autonomy
// finding earns its place. If the block still goes unused here, the feature is inert for instrument-only members.
const PRESSURE = "Honestly my doctor and my wife are both on me about the eating. I know I should. I just don't really want to.";
failed += await runCase('CASE 3 — B1 SHOULD bear: the member names outside pressure', PARTIAL, ALL, PRESSURE);

console.log(`\n${'─'.repeat(100)}`);
console.log(failed ? `${failed} check(s) FAILED — read the replies above.` : 'All checks passed.');
console.log('Judgement still required on the reply text itself: does it feel like being remembered, or like being read?');
process.exit(failed ? 1 : 0);
