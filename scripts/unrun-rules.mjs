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

const byFile = (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name);
dead.sort(byFile); testOnly.sort(byFile);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ dead, testOnly, parked }, null, 2));
} else {
  console.log(`\nTEST-ONLY — green in CI, does nothing for a member (${testOnly.length})`);
  for (const r of testOnly) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\nDEAD — nothing runs it and nothing checks it (${dead.length})`);
  for (const r of dead) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  if (parked.length) console.log(`\nPARKED — unrun on purpose, reason on file (${parked.length})`);
  for (const r of parked) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\n${testOnly.length + dead.length} unrun export(s), ${parked.length} parked.`);
  console.log('Each is one of: a rule that should be WIRED, or code that should be DELETED. Neither is "leave it".\n');
}

// A RATCHET, NOT A CLIFF. Requiring zero would mean a gate that fails from day one, and a gate that always fails
// is a gate nobody reads — which is precisely how nine of these accumulated unnoticed. So the bar is the CURRENT
// count: the list may shrink freely, and the build fails the moment it GROWS. Lower this number as items are
// worked off; it should never be raised. Every increase is a new rule that exists and does not run.
const BASELINE = 53; // 2026-08-29, after the first triage pass
const total = dead.length + testOnly.length;
if (total > BASELINE) {
  console.error(`\nRATCHET: ${total} unrun exports, up from the ${BASELINE} baseline. Something new was added that nothing calls.`);
  process.exit(1);
}
if (total < BASELINE) console.log(`Below baseline (${total} < ${BASELINE}) — lower BASELINE in this file to lock the gain in.\n`);
process.exit(0);
