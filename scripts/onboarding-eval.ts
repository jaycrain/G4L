// Live-model onboarding eval SUITE — plays scripted "members" (a second model in persona) through the
// REAL onboarding model + engine and reports capture quality per persona. This is the safety net that
// catches model-behavior bugs the deterministic replay tests can't (new shapes only show up live). No DB
// writes — onboardingNextTurn doesn't persist. Needs ANTHROPIC_API_KEY (e.g. in .env.local).
//
// Run:  node --experimental-strip-types scripts/onboarding-eval.ts            (all personas)
//       node --experimental-strip-types scripts/onboarding-eval.ts rita       (one persona by name)
//
// It's a REPORT, not a CI gate (cost + nondeterminism) — a ⚠ is "look at this run," not a hard failure.

import { onboardingNextTurn, INITIAL_STATE, type ConvState, type ConvMessage, type Collected } from '../lib/agent/onboarding.ts';
import { ritaDoorConcerns, ritaRaisedDoors } from './rita-criterion.ts';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY (e.g. add it to .env.local) — this eval drives the real model.');
  process.exit(1);
}

type Persona = { name: string; system: string; expect: (c: Collected, complete: boolean, memberText: string) => string[] };

const PERSONAS: Persona[] = [
  {
    name: 'rita',
    // Multi-Door fade: layoff + carrying the household + parents declining, all at once. The case that
    // exposed the dropped-Doors and premature-completion bugs. Expect all three Doors + a full gap.
    system: `You are role-playing "Rita", a 57-year-old woman in an onboarding conversation with a guide.
Respond ONLY as Rita — 1-3 short, honest sentences, one thought at a time. Reveal your story progressively.
- Laid off at 57 after 12 years, right before a promotion that would have secured your family's future.
- Sole breadwinner for years while your husband was out of work; when you were laid off he didn't step up; savings gone; the house is at risk.
- Around the same time your father nearly died (coma, twice) and your mother's health/independence is declining — you're becoming their caretaker.
- At your best: energetic, led teams, mentored people, fun and funny, healthy.
- If asked to name that person in ONE word: you're not ready, you'd rather find it later.
- Want back: paid creative work, finish your podcast, direct a documentary, lose 20 lbs, feel at ease at home.
If asked how the gap opened, tell ALL of it (job, husband/household, parents) — and if it hasn't all come out yet, say "there's more, it wasn't just the layoff." When it's all out, say that's the whole picture.`,
    expect: (c, done, memberText) => {
      const out: string[] = [];
      // "Raised-but-dropped" criterion: only a Door rita ACTUALLY raised (per the independent script-based
      // detector) that the engine then dropped is a miss — never a thread she didn't fully surface. This
      // measures true capture fidelity, not the persona's stochasticity (validated in
      // tests/onboarding-eval-criterion.test.ts against a planted drop + a matcher-missed-but-caught Door).
      out.push(...ritaDoorConcerns(c.doors ?? [], memberText));
      if (!done) out.push('did not complete');
      // Gap-thin only counts when she raised >1 thread (a genuinely multi-event story we then under-captured).
      if (ritaRaisedDoors(memberText).size >= 2 && (c.gap ?? '').length < 120) out.push('gap is thin (multi-event story under-captured)');
      return out;
    },
  },
  {
    name: 'no-fade',
    // A thriving optimizer with no real Fade. FLOOR decision (Jay+Greg, Jun 26): ADMIT at baseline — complete
    // normally with a light, TRUTHFUL gap; never fabricate a fade, never force a Door, never strand/hold. The
    // (later) ID Score comes back high. So the correct outcome here is now: completes, no invented loss.
    system: `You are role-playing "Theo", a 52-year-old man who is genuinely THRIVING and just wants MORE.
Respond ONLY as Theo — 1-3 short sentences. There is NO loss or drift in your life: career's strong, marriage's
good, kids are great, you're fit and healthy. You're here to optimize and chase bigger challenges — a faster
marathon, a startup idea, peak experiences. You have NO fade story. If the guide asks what you lost or how a
gap opened, say honestly that nothing went wrong — you haven't drifted, you just want to keep leveling up. Do
NOT invent a loss or a hard chapter to please the guide; gently insist you're doing well.`,
    expect: (c, done) => {
      const out: string[] = [];
      // FLOOR: admit, don't decline. The engine NEVER fabricates here — the floor captures the member's OWN
      // words. So the honest fabrication signal is a FORCED DOOR (routing a fade onto a no-Fade member), NOT
      // loss WORDS in his own gap text (Theo legitimately says "not a lost version of me"). Two failure modes:
      if (!done) out.push('no-fade did NOT complete — stranded/held (floor decision: admit at baseline)');
      if ((c.doors?.length ?? 0) > 0) out.push('forced a Door onto a no-Fade member (invented a fade)');
      return out;
    },
  },
  {
    name: 'terse',
    // Minimal, guarded answers. Tests that the engine captures only what's given (no fabricated elaboration)
    // and never loops the same question.
    system: `You are role-playing "Sam", who answers in the FEWEST possible words — often 2-5 words, never more
than one short sentence. You're not hostile, just terse and guarded. Your truth, given only if asked and only
in fragments: you were a runner; you stopped after a knee injury; then a divorce. What you want back: "Run
again." "Sleep." "Feel like myself." Do not elaborate. If pushed, give one more fragment, still short.`,
    expect: (c, done) => {
      const out: string[] = [];
      const g = (c.gap ?? '').toLowerCase();
      // Sam HAS a real fade (knee, divorce) — stranding him (no completion / nothing captured) is a failure,
      // not a clean pass. This guards the silent-stall blind spot a terse fragment exposed (Jun 26).
      if (!done) out.push('terse stranded — did not complete (fragmented fade never captured)');
      if (done && (c.gap ?? '').length === 0) out.push('completed with an empty gap');
      if (done && g.length > 0 && !/knee|injur|run|divorce|marriage|split/.test(g)) out.push("gap may be fabricated — doesn't reflect Sam's words (knee/divorce)");
      return out;
    },
  },
  {
    name: 'front-loader',
    // Dumps the whole story up front. Tests that a flood of info is captured without racing/dropping.
    system: `You are role-playing "Dana", who pours her whole story out at once. Your FIRST message should
include all of: who you were (a touring musician — playing live was your whole identity), what you want back
(play live shows again, write songs weekly, tour, and sleep on a normal schedule), AND how it opened (a vocal
cord diagnosis ended touring, then your band broke up, then you moved cities and lost your whole music
community). After that, answer follow-ups with more detail, but you've essentially told the whole thing.
Respond as Dana, warm and a little breathless, a few sentences at a time.`,
    expect: (c, done) => {
      const out: string[] = [];
      if (!done) out.push('did not complete a fully front-loaded story');
      // Floor decision (sub-3 completes; the card carries the shortfall): a real failure is capturing NOTHING,
      // not finishing under the ~7 aim. So flag an empty list, not "< 3".
      if ((c.reclaimList?.length ?? 0) < 1) out.push('captured NO reclaim items from the front-loaded dump');
      if ((c.doors?.length ?? 0) === 0) out.push('no Door captured from a clear multi-event story');
      return out;
    },
  },
  {
    name: 'follow-on',
    // Reproduces the live-walk bug (Jun 26): a member who answers the "was there more?" gather with BRIEF,
    // PARTIAL new threads ("my marriage too", "my marriage") — the pattern that made the static gather line
    // loop verbatim. Tests: rotated nudge (no verbatim repeat — the general guard), the brief threads get
    // captured (their Doors), and it completes.
    system: `You are role-playing "Marcus", a 55-year-old who answers in SHORT, partial follow-ons — never a
full paragraph. Reveal your story in fragments, one at a time, and when the guide asks "was there more?",
add ONE more brief thread (2-6 words), sometimes just repeating/trimming the last one.
- At your best: a triathlete — disciplined, up before dawn, "the Ironman". If asked for one word: "Ironman."
- How it opened, given only in fragments across several "was there more?" turns: a back injury stopped training;
  then "my marriage got stressed too"; then just "my marriage"; then "work got heavy"; then "that's about it."
- Want back (brief): "train again", "my mornings", "feel strong".
Keep every message short. Do not elaborate or summarize.`,
    expect: (c, done) => {
      const out: string[] = [];
      if (!done) out.push('follow-on stranded — did not complete (brief-thread gather looped)');
      // He clearly raised the body/injury + marriage threads; capturing nothing is a real miss (sub-min is fine).
      if (done && (c.doors?.length ?? 0) === 0 && (c.gap ?? '').length < 20) out.push('captured no Door and only a thin gap from his threads');
      return out;
    },
  },
];

async function member(system: string, history: ConvMessage[]): Promise<string> {
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
    system,
    messages: messages.length ? messages : [{ role: 'user', content: '(the guide is ready for you)' }],
  });
  return (res.content as Array<{ type: string; text?: string }>).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim();
}

const ctx = { name: 'Eval Member', email: 'eval@example.test' };

async function runPersona(p: Persona): Promise<boolean> {
  let state: ConvState = INITIAL_STATE;
  const history: ConvMessage[] = [];
  const trace = !!process.env.EVAL_TRACE;
  let turn = await onboardingNextTurn({ ctx, state, history, memberMessage: null });
  history.push({ role: 'agent', text: turn.reply });
  state = turn.state;
  if (trace) console.log(`\n[A|${(state as { stage?: string }).stage ?? '-'}] ${turn.reply}`);
  for (let i = 0; i < 24 && !turn.complete; i++) {
    const m = await member(p.system, history);
    history.push({ role: 'member', text: m });
    if (trace) console.log(`[M] ${m}`);
    turn = await onboardingNextTurn({ ctx, state, history, memberMessage: m });
    history.push({ role: 'agent', text: turn.reply });
    state = turn.state;
    if (trace) {
      const c = turn.state.collected;
      console.log(`[A|${(turn.state as { stage?: string }).stage ?? '-'}|reclaim:${(c.reclaimList ?? []).length}|gap:${c.gap ? 'y' : 'n'}|conf:${(turn.state as { awaitingConfirm?: boolean }).awaitingConfirm ? 'y' : 'n'}] ${turn.reply}`);
    }
  }
  const c = state.collected;
  const memberText = history.filter((h) => h.role === 'member').map((h) => h.text).join(' \n ');
  const issues = p.expect(c, turn.complete, memberText);
  // GENERAL GUARD (all personas): the agent must never repeat a reply VERBATIM — a canned gather line looping
  // word-for-word is the bug the `follow-on` persona reproduces (live walk, Jun 26). Catch it for everyone so
  // this whole class can't hide from the eval again.
  const agentReplies = history.filter((h) => h.role === 'agent').map((h) => h.text);
  for (let i = 1; i < agentReplies.length; i++) {
    if (agentReplies[i] && agentReplies[i] === agentReplies[i - 1]) {
      issues.push(`agent repeated a reply VERBATIM: "${agentReplies[i]!.slice(0, 60)}…"`);
      break;
    }
  }
  const turns = history.filter((h) => h.role === 'member').length;
  console.log(`\n### ${p.name} — ${issues.length ? '⚠ ' + issues.length + ' concern(s)' : '✓ clean'}  (member turns: ${turns}, complete: ${turn.complete})`);
  console.log('   doors  :', JSON.stringify(c.doors ?? []));
  console.log('   ident  :', c.identitySkipped ? '(skipped)' : (c.identityNoun ?? '(none)'));
  console.log('   reclaim:', (c.reclaimList ?? []).length, 'items');
  console.log('   gap    :', (c.gap ?? '(none)').slice(0, 280));
  for (const iss of issues) console.log('   ⚠ ', iss);
  return issues.length === 0;
}

const only = process.argv[2];
const toRun = only ? PERSONAS.filter((p) => p.name === only) : PERSONAS;
if (toRun.length === 0) {
  console.error(`no persona named "${only}". available: ${PERSONAS.map((p) => p.name).join(', ')}`);
  process.exit(1);
}
let clean = 0;
for (const p of toRun) {
  try {
    if (await runPersona(p)) clean++;
  } catch (e) {
    console.log(`\n### ${p.name} — ✗ errored: ${(e as Error)?.message}`);
  }
}
console.log(`\n========= ${clean}/${toRun.length} personas clean =========`);
