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

const prodCorpus = files.map((f) => [f, readFileSync(f, 'utf8')]);
const testCorpus = testFiles.map((f) => [f, readFileSync(f, 'utf8')]);

const dead = [];
const testOnly = [];
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
  const tests = countRefs(name, file, testCorpus);
  (tests > 0 ? testOnly : dead).push({ name, file: relative(ROOT, file), tests });
}

const byFile = (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name);
dead.sort(byFile); testOnly.sort(byFile);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ dead, testOnly }, null, 2));
} else {
  console.log(`\nTEST-ONLY — green in CI, does nothing for a member (${testOnly.length})`);
  for (const r of testOnly) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\nDEAD — nothing runs it and nothing checks it (${dead.length})`);
  for (const r of dead) console.log(`  ${r.name.padEnd(34)} ${r.file}`);
  console.log(`\n${testOnly.length + dead.length} unrun export(s).`);
  console.log('Each is one of: a rule that should be WIRED, or code that should be DELETED. Neither is "leave it".\n');
}

process.exit(dead.length + testOnly.length > 0 ? 1 : 0);
