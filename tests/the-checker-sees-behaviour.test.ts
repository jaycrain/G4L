// THE CHECKER HAS TO SEE THE BUGS THAT ACTUALLY HAPPEN.
//
// Its first half asks "is this symbol referenced?". The three worst bugs of 2026-08-30 were all referenced:
//   · the no-repeat guard, called at the bottom of runArcTurn while nine handlers returned past it
//   · the multi-want protection, real and only on the branch that could auto-split
//   · Donna's Reclaim copy, shipped and sitting behind `if (parked.length === 0)`
// One shape: a function returns from several places and the returns are not equivalent. Referencing analysis is
// blind to it, which is why this half exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const run = () => {
  try { return execSync('node scripts/unrun-rules.mjs --json', { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { return e.stdout ?? ''; }
};

test('it holds on the real codebase — every reply exit is guarded or exempted', () => {
  const { behaviour } = JSON.parse(run());
  assert.deepEqual(behaviour, [], 'a behaviour rule is not holding; run the checker for the offending exit');
});

test('IT CATCHES AN UNGUARDED EXIT — proven by adding one', () => {
  // The half that matters. A checker whose violation branch has never fired is the very defect it hunts, so this
  // introduces a real unguarded return and asserts it is reported, then restores the file.
  const f = `${ROOT}lib/agent/onboarding-staged.ts`;
  const original = readFileSync(f, 'utf8');
  const probe = "\nfunction __probeUnguardedExit(b: Beat): Turn {\n  return { reply: 'a bare string', state: beatState(b), complete: false };\n}\n";
  try {
    writeFileSync(f, original + probe);
    const { behaviour } = JSON.parse(run());
    assert.equal(behaviour.length, 1, 'the unguarded exit is reported');
    assert.match(behaviour[0].id, /no-repeat-on-every-exit/);
    assert.match(behaviour[0].miss, /exits/, 'and it says how many of how many');
  } finally {
    writeFileSync(f, original);
  }
});

test('every exemption carries a reason, and the crisis one is right', () => {
  // Exemptions are how this stops being a checker and starts being a suppression list. Same rule as the parking
  // lot: if you cannot write why, it is not exempt.
  const src = readFileSync(new URL('../scripts/unrun-rules.mjs', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('exempt: ['), src.indexOf('],', src.indexOf('exempt: [')));
  const entries = [...block.matchAll(/\{ match:/g)];
  assert.ok(entries.length >= 3, 'the exemptions are enumerated');
  assert.equal(entries.length, [...block.matchAll(/why:/g)].length, 'every exemption has a why');
  // The one that would be actively harmful to guard.
  assert.match(block, /CRISIS_RESPONSE_US[\s\S]*?988/, 'crisis is exempt, and the reason names the 988 line');
});
