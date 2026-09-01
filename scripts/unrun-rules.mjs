// UNRUN RULES — "a rule that exists and does not run", found mechanically.
//
// This is the defect class of this codebase. Nine instances surfaced in a single day (2026-08-29):
//   · the no-repeat guard, unreachable from 9 of its 10 exits
//   · detectVoiceTells, exported with no callers
//   · B1/B2/C2 carry-forwards declared with no model turn to receive them
//   · the composer rule written 8 lines above the code that overrode it
//   · docs/onboarding.md describing a retired engine
//   · "never third person" and "only when the member names it" — prompt-only, unenforced
//   · the multi-want protection covering only the branch that could auto-split
//   · QUIET_DRIFT_PROMPT — the affordance the Taxonomy Spec REQUIRES — zero callers
//
// Not all of it is mechanical. A rule stated in a comment and not enforced needs a human. But two sub-shapes are
// exactly detectable, and one of them is the worst of the lot:
//
//   DEAD      — exported, referenced nowhere. Nothing runs it and nothing checks it.
//   TEST-ONLY — exported, referenced ONLY by tests. THIS IS THE DANGEROUS ONE: it looks maintained, it is green in
//               CI, and it does nothing for a member. "propose and resolve both existed, both unit-tested, never
//               wired" — an infinite loop shipped from dead code that had passing tests.
//
// A TEST-ONLY FINDING IS A QUESTION, NOT A VERDICT — always ask "is there another way in?" before concluding a
// feature is dark. `applyReclaimC1PassesTurn` lands in this bucket and the feature it fronts is fully LIVE: it is
// an alternate entry point wrapping RECLAIM_C1_ARC, which runs by another route. On 2026-08-30 that finding, plus
// a stale note, had me tell Jay that C1's six passes were never switched on. They shipped in v3.5.46. One grep
// would have settled it. The DEAD bucket does not have this failure mode; TEST-ONLY does.
//
//
// ── AND THE HALF THAT IS NOT ABOUT EXPORTS ────────────────────────────────────────────────────────────────────
//
// Everything above asks "is this symbol referenced?". The three worst bugs of 2026-08-30 were all referenced, and
// all of them were still rules that did not run:
//
//   · the no-repeat guard — called at the END of runArcTurn, while NINE handler paths returned before reaching it
//   · the multi-want protection — real, and only on the branch that could auto-split; the other branch deleted
//   · Donna's Reclaim copy — shipped, and behind `if (parked.length === 0)`, so the member who TALKS never saw it
//
// One shape: A FUNCTION RETURNS FROM SEVERAL PLACES AND THE RETURNS ARE NOT EQUIVALENT. A guard applied on the way
// out of one exit and not another; an introduction included in one branch and not the other. Referencing analysis
// cannot see it, because every symbol involved is referenced.
//
// So BEHAVIOUR_RULES states the invariant and this checks every return against it. Each rule is one sentence of
// English plus a predicate, and adding one when a new instance is found is the cheap part — which matters, because
// the expensive part has always been noticing.
//
// Usage:  node scripts/unrun-rules.mjs [--json]
// Exit 1 when anything is found, so it can gate CI once the list is at zero.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIRS = ['lib', 'app', 'scripts'];
const isTest = (f) => f.includes('/tests/') || f.endsWith('.test.ts') || f.endsWith('.test.tsx');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

const files = SRC_DIRS.flatMap((d) => {
  try { return walk(join(ROOT, d)); } catch { return []; }
});
const testFiles = (() => { try { return walk(join(ROOT, 'tests')); } catch { return []; } })();

// Every exported symbol, with where it was declared.
// FUNCTIONS AND VALUES ONLY. An exported `type` or `interface` cannot "run" — an unused one is a tidiness nit, not
// a rule that fails to fire, and including them buried the real findings under 400 lines of noise. The defect class
// is executable: a guard, a predicate, a piece of copy, a store call.
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm;
const declared = new Map(); // name -> file
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(EXPORT_RE)) {
    if (!declared.has(m[1])) declared.set(m[1], f);
  }
}

// Count references outside the declaring file. A word-boundary match is deliberately generous: this hunts for
// things with ZERO uses, so over-counting is the safe direction — a false "it is used" costs nothing, a false
// "it is dead" would send someone deleting live code.
const countRefs = (name, exclude, corpus) => {
  const re = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`);
  let n = 0;
  for (const [f, src] of corpus) {
    if (f === exclude) continue;
    if (re.test(src)) n++;
  }
  return n;
};

// EXCLUDE THIS FILE FROM ITS OWN CORPUS. The PARKED reasons below name the very symbols they park, and since the
// corpus includes scripts/, every parked name read as "referenced in production" and vanished from the report
// entirely — the parking lot silently disabling the check, which is this exact defect class one level up.
const prodCorpus = files.filter((f) => !f.endsWith('unrun-rules.mjs')).map((f) => [f, readFileSync(f, 'utf8')]);
const testCorpus = testFiles.map((f) => [f, readFileSync(f, 'utf8')]);

// PARKED — unrun ON PURPOSE, with the reason recorded here.
//
// A gate that can never reach zero is a gate nobody reads, which is exactly how nine of these accumulated. So
// there is a parking lot — but every space needs a REASON, which makes it a decision record rather than a
// suppression. If you cannot write the reason, it is not parked; it is forgotten, and it belongs in DEAD.
const PARKED = {
  EVIDENCE_ITEMS: 'C-phase evidence instrument, Greg\'s items verbatim — built for Cycle 2, which Jay moved to post-Charter (2026-08-29). Deleting would throw away his content; wiring it would ship Cycle 2 early.',
  EVIDENCE_ITEM_COUNT: 'Part of the parked evidence instrument — see EVIDENCE_ITEMS.',
  EVIDENCE_PART_LABEL: 'Part of the parked evidence instrument — see EVIDENCE_ITEMS.',
  EVIDENCE_PART_STARTS: 'Part of the parked evidence instrument — see EVIDENCE_ITEMS.',
  checkinSystem: 'The ASSEMBLED check-in prompt. Test-only BY CONSTRUCTION since v3.6.6: the agent now receives '
    + 'checkinSystemBlocks (the cacheable split), and this is the flat form the tests assert the rules actually reach '
    + 'the model through. That is the dangerous shape — a test asserting on a string the agent no longer gets — so it '
    + 'is held safe by tests/checkin-prompt-cache.ts, which asserts the blocks JOINED equal this exactly. Parked '
    + 'rather than deleted because the alternative is tests that read the prompt a different way from the agent.',
};

const dead = [];
const testOnly = [];
const parked = [];
for (const [name, file] of declared) {
  // A default-exported React component or a Next.js route export is invoked by the framework, never by name.
  if (/^(default|GET|POST|PUT|PATCH|DELETE|metadata|generateMetadata|revalidate|dynamic)$/.test(name)) continue;
  // `__resetFooCache` and friends exist SO tests can reach module state. Test-only is their job, not a defect.
  if (name.startsWith('__')) continue;
  // USED INSIDE ITS OWN FILE STILL COUNTS AS RUNNING. This codebase deliberately exports pure functions so tests
  // can reach them ("keep decision logic in pure functions so it stays replayable") — and most of those are called
  // by the module's own entry point. Excluding the declaring file entirely reported all of them as unrun, which
  // would have buried the real findings again and, worse, invited someone to delete live code.
  const own = readFileSync(file, 'utf8');
  const usesInOwnFile = (own.match(new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`, 'g')) ?? []).length;
  if (usesInOwnFile > 1) continue; // the declaration itself is the first match
  const prod = countRefs(name, file, prodCorpus);
  if (prod > 0) continue;
  if (PARKED[name]) { parked.push({ name, file: relative(ROOT, file), reason: PARKED[name] }); continue; }
  const tests = countRefs(name, file, testCorpus);
  (tests > 0 ? testOnly : dead).push({ name, file: relative(ROOT, file), tests });
}


// ── BEHAVIOUR: every exit of a function must satisfy the same invariant ────────────────────────────────────────
const BEHAVIOUR_RULES = [
  {
    id: 'no-repeat-on-every-exit',
    file: 'lib/agent/onboarding-staged.ts',
    why: "The no-repeat guard sat at the bottom of runArcTurn while nine handlers returned past it. Four of six eval "
       + "personas shipped the same sentence twice, always on the reclaim beat. A guard whose job is 'never say the "
       + "same thing twice' cannot have an exemption for the case that says it twice.",
    // Any turn that carries a reply must route it through the guard.
    appliesTo: (ret) => /\breply:/.test(ret),
    mustSatisfy: (ret) => /reply:\s*noRepeat\(/.test(ret),
    // EXEMPTIONS NEED A REASON, like the parking lot above — and writing them forced a distinction I had not made.
    // The guard prefixes a lead-in ("No rush at all.") when a line would repeat. That is right for a draw-out and
    // WRONG for these:
    exempt: [
      { match: /CRISIS_RESPONSE_US/, why: 'A member still in crisis on the next turn must get the 988 line again, verbatim. Softening it with "No rush at all." would be the worst sentence this product could produce.' },
      { match: /STAGED_OPENING/, why: 'The first turn of a conversation. There is no previous reply for it to repeat.' },
      { match: /CLARIFY_REPLY/, why: 'Guarded by construction, not by noRepeat: the branch requires !alreadyClarified(history), so it fires at most once per conversation. It also runs BEFORE the Beat is built, so there is no b to pass. Verified at onboarding-staged.ts:3039.' },
      { match: /state: migrated/, why: 'The resume path for a legacy declined session — no Beat exists yet, so there is no history to compare against.' },
    ],
  },
  {
    id: 'reclaim-opener-never-forks',
    file: 'lib/agent/onboarding-staged.ts',
    fn: 'reclaimOpening',
    why: "This forked: with nothing parked the member got the full introduction, and with a want parked she got a "
       + "short read-back naming neither the Reclaim List nor goals. The member most likely to take the short branch "
       + "is the one who talks. Donna walked it and met 'a cold field with my first entry placed'.",
    appliesTo: () => true,
    mustSatisfy: (ret) => /reclaimOpen\(/.test(ret),
  },
];

// ── AND THE HALF THAT COST THE MOST: ONE FACT, TWO SITES ──────────────────────────────────────────────────────
//
// 2026-08-31 shipped ~20 fixes. SIX of them were a rule we had already written and failed to apply at a second
// site, and one of those six was mine — made an hour after diagnosing the same shape in someone else's code:
//
//   · withQuestion was hardened to scan the whole last paragraph for a question. receiptOnly, its sibling, never
//     got the fix — and receiptOnly is the one feeding every scripted hand-off in the arc.
//   · W1's fifth domain got "the handoff must ask" on 8/27. W3's protocol entry did not, and stored a member's
//     answer to an earlier question as her Redirect. It sat in her weekly tracker for a week.
//   · I fixed the close-hold in B2's skills-close, did not sweep for siblings, and the session eval found
//     c1-close doing the same thing an hour later.
//
// NEITHER OF THE BUCKETS ABOVE CAN SEE THIS. Every symbol involved is referenced, and every return satisfies its
// own function's invariant. The defect is the DIFFERENCE between two places that should agree.
//
// SITES ARE DISCOVERED, NEVER LISTED. A hand-written list of siblings is precisely what let the second site sit
// unfixed — it is a per-site test wearing a different hat. Each rule finds its own family by pattern, so a sibling
// added next month is covered without anyone remembering to add it here.
//
// A DIVERGENCE IS A QUESTION, NOT A VERDICT, exactly like TEST-ONLY: the honest reading is "these two disagree —
// which one is right?" Sometimes the answer is that the odd one out is correct and the rule needs an exemption.
const SIBLING_RULES = [
  {
    id: 'closing-beats-hold-once',
    why: "A close stage ends the Session, so every one of them ended unconditionally — and when what the member "
       + "said was 'I don't understand what you mean', her question was answered by the Session ending. Fixed in "
       + "skills-close, then found again in c1-close an hour later by the eval.",
    // Every stage whose id ends in -close, anywhere in the agent layer.
    discover: (files) => sites(files, /^lib\/agent\//, /id: '([a-z0-9-]*-close)'/g),
    mustSatisfy: (text) => /heldOnceIfLost\(/.test(text),
  },
  {
    id: 'handoff-into-a-waiting-stage-must-ask',
    why: "A stage that stores whatever arrives must be entered by a turn that ASKED for it, or the member's "
       + "previous thought becomes her answer. W1 got this on 2026-08-27 and W3 did not; W3 then stored Donna's "
       + "answer to a body-sensation question as her Redirect.",
    discover: (files) => sites(files, /^lib\/agent\/(rewire|rebuild|reclaim|reconnect)\.ts$/, /b\.stage = '(protocol|affirm)';/g),
    mustSatisfy: (text) => /withScriptedBeat\(|W1_TURN_ASK_FALLBACK|W3_REDIRECT/.test(text),
  },
  {
    id: 'question-detection-is-paragraph-scoped',
    why: "The model asks its question and then adds a coda, so the text does not END in '?'. withQuestion was "
       + "hardened to scan the whole last paragraph; receiptOnly kept a trailing-only check and stacked two "
       + "questions on the member for four days.",
    discover: (files) => sites(files, /^lib\/agent\/onboarding-staged\.ts$/, /export function (withQuestion|receiptOnly)\b/g),
    mustSatisfy: (text) => /lastPara|paras\[paras\.length/.test(text),
  },
];

/**
 * Find each rule's family: every match of `pattern` in the files whose path matches `where`, paired with the
 * enclosing block so a predicate has something to test.
 */
function sites(files, where, pattern) {
  const found = [];
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (!where.test(rel)) continue;
    const src = readFileSync(f, 'utf8');
    // A FRESH REGEX PER FILE. `pattern` carries /g, and a /g regex is stateful — reusing one object across the file
    // loop let its lastIndex survive into the next file, so a rule silently found zero sites in a file that plainly
    // contained them and reported itself as "rotted". A checker whose own matcher can go quiet is the exact defect
    // it exists to find, so it is rebuilt per file rather than trusted to be stateless.
    const re = new RegExp(pattern.source, pattern.flags);
    for (const m of src.matchAll(re)) {
      // The site's text: a generous forward slice, PLUS the body of any handler it merely REFERENCES.
      //
      // A stage often reads `gather: b1Consolidate` with the function defined above it, so a fix living in that
      // function is invisible to a forward slice. This checker reported why-close as missing a guard that was
      // three lines away in a named function — a false red, and a checker that cries wolf teaches us to skim it.
      let text = src.slice(m.index, m.index + 1400);
      // AND THE MATCHED SYMBOL'S OWN BODY, when the match names one. A fixed slice is a guess about how much
      // explanation sits between a declaration and its code — receiptOnly's comment is longer than 1400 chars, so
      // the slice stopped before the fix it was checking for and reported a false red on code fixed the day before.
      const own = m[1] ? (bodyOf(src, m[1]) ?? constBodyOf(src, m[1])) : null;
      if (own) text += '\n' + own;
      for (const ref of text.matchAll(/(?:gather|confirm|opener)\s*:\s*([A-Za-z_$][\w$]*)\s*[,\n]/g)) {
        const body = bodyOf(src, ref[1]) ?? constBodyOf(src, ref[1]);
        if (body) text += '\n' + body;
      }
      found.push({ file: rel, name: m[1] ?? m[0], text });
    }
  }
  return found;
}

/** Same, for a handler written as `const name = (…) => { … }` — the shape most stage handlers actually use. */
function constBodyOf(src, name) {
  const at = src.search(new RegExp(`const\\s+${name}\\s*(?::[^=]*)?=\\s*(?:async\\s*)?\\(`));
  if (at < 0) return null;
  // FIND THE ARROW FIRST. Taking the next '{' after the declaration brace-matched the PARAMETER TYPE —
  // `const b1Consolidate = (b: { stage: string; … }) => {` — and returned the type literal as the body, so a guard
  // living in the real body was invisible. That produced a false red on why-close for a fix three lines away.
  const arrow = src.indexOf('=>', at);
  if (arrow < 0) return null;
  const open = src.indexOf('{', arrow);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/** Function body by name, brace-matched — regex alone cannot find the end of a function. */
function bodyOf(src, name) {
  const at = src.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/** Return statements, with their expression — comments and strings stripped so prose cannot satisfy a rule. */
function returnsIn(code) {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  for (const m of clean.matchAll(/\breturn\b/g)) {
    let i = m.index + 6, depth = 0, expr = '';
    while (i < clean.length) {
      const ch = clean[i];
      if ('{(['.includes(ch)) depth++;
      else if ('})]'.includes(ch)) { if (depth === 0) break; depth--; }
      else if (ch === ';' && depth === 0) break;
      expr += ch; i++;
    }
    out.push(expr.trim());
  }
  return out;
}

const behaviour = [];
for (const rule of BEHAVIOUR_RULES) {
  let src;
  try { src = readFileSync(join(ROOT, rule.file), 'utf8'); } catch { continue; }
  const scope = rule.fn ? bodyOf(src, rule.fn) : src;
  if (!scope) { behaviour.push({ ...rule, miss: `function ${rule.fn} not found — rule is stale` }); continue; }
  const rets = returnsIn(scope).filter(rule.appliesTo);
  const bad = rets.filter((r) => !rule.mustSatisfy(r) && !(rule.exempt ?? []).some((e) => e.match.test(r)));
  if (bad.length) behaviour.push({ ...rule, miss: `${bad.length} of ${rets.length} exits: ${bad[0].slice(0, 60)}…` });
}

// SIBLING DIVERGENCE — the family is discovered, then split into those that satisfy the rule and those that do not.
// A family where NOBODY satisfies it is not a divergence; it is a rule nobody has applied yet, and it is reported
// differently so the two are never confused.
const siblings = [];
for (const rule of SIBLING_RULES) {
  const family = rule.discover(files);
  if (family.length < 2) { siblings.push({ ...rule, stale: `found ${family.length} site(s) — the pattern has rotted` }); continue; }
  const ok = family.filter((x) => rule.mustSatisfy(x.text));
  const bad = family.filter((x) => !rule.mustSatisfy(x.text));
  if (bad.length && ok.length) siblings.push({ ...rule, ok, bad });        // genuine divergence
  else if (bad.length) siblings.push({ ...rule, ok, bad, neverApplied: true });
}

const byFile = (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name);
dead.sort(byFile); testOnly.sort(byFile);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ dead, testOnly, parked, behaviour, siblings }, null, 2));
} else {
  if (siblings.length) {
    console.log(`\nONE FACT, TWO SITES — a rule applied here and not there (${siblings.length})`);
    for (const r of siblings) {
      if (r.stale) { console.log(`  ${r.id} — ${r.stale}`); continue; }
      const head = r.neverApplied ? 'NOBODY applies it' : `${r.ok.length} do, ${r.bad.length} do NOT`;
      console.log(`  ${r.id}  (${head})`);
      for (const b of r.bad) console.log(`      missing: ${b.name.padEnd(22)} ${b.file}`);
      for (const o of r.ok)  console.log(`      has it:  ${o.name.padEnd(22)} ${o.file}`);
      console.log(`      ${r.why}`);
    }
  }
  console.log(`\nTEST-ONLY — green in CI, does nothing for a member (${testOnly.length})`);
  for (const r of testOnly) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\nDEAD — nothing runs it and nothing checks it (${dead.length})`);
  for (const r of dead) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  if (parked.length) console.log(`\nPARKED — unrun on purpose, reason on file (${parked.length})`);
  for (const r of parked) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\nBEHAVIOUR — rules that exist but do not run on every path (${behaviour.length})`);
  for (const b of behaviour) { console.log(`  ${b.id}`); console.log(`     ${b.miss}`); console.log(`     ${b.why.slice(0, 150)}…`); }
  console.log(`\n${testOnly.length + dead.length} unrun export(s), ${parked.length} parked, ${behaviour.length} behaviour violation(s).`);
  console.log('Each is one of: a rule that should be WIRED, or code that should be DELETED. Neither is "leave it".\n');
}

// A RATCHET, NOT A CLIFF. Requiring zero would mean a gate that fails from day one, and a gate that always fails
// is a gate nobody reads — which is precisely how nine of these accumulated unnoticed. So the bar is the CURRENT
// count: the list may shrink freely, and the build fails the moment it GROWS. Lower this number as items are
// worked off; it should never be raised. Every increase is a new rule that exists and does not run.
const BASELINE = 53; // 2026-08-29, after the first triage pass
const total = dead.length + testOnly.length;
// A behaviour violation is never ratcheted — it is a live rule that does not run, and there is no baseline for that.
if (behaviour.length) { console.error(`\n${behaviour.length} behaviour rule(s) not holding on every path.`); process.exit(1); }
if (total > BASELINE) {
  console.error(`\nRATCHET: ${total} unrun exports, up from the ${BASELINE} baseline. Something new was added that nothing calls.`);
  process.exit(1);
}
if (total < BASELINE) console.log(`Below baseline (${total} < ${BASELINE}) — lower BASELINE in this file to lock the gain in.\n`);
process.exit(0);
