// THE CANONICAL ONBOARDING MAP MUST DESCRIBE THE ENGINE PROD ACTUALLY RUNS.
//
// CLAUDE.md names docs/onboarding.md as the starting point for every onboarding decision. On 2026-08-30 it
// described `lib/agent/onboarding.ts` — the v1 engine, unreachable since ONBOARDING_ENGINE=staged — and every
// guard in its failure-shape table lived in that dead file.
//
// The code was largely fine. The DESCRIPTION was wrong, and that is worse than it sounds: a wrong map is handed
// to whoever reads it next as the authoritative account of what protects a member. It survived for weeks because
// a document cannot fail a test. Now one can.
//
// This does not check prose. It checks the two claims that made the old version dangerous: that the map names
// the live engine's entry points, and that it does not present the retired ones as current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MAP = readFileSync(new URL('../docs/onboarding.md', import.meta.url), 'utf8');
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the map names the entry points prod actually runs', () => {
  // Verified against the dispatcher rather than assumed: onboardingNextTurn sends the staged flag to these.
  const dispatcher = src('lib/agent/onboarding.ts');
  assert.match(dispatcher, /liveTurnStaged/, 'the dispatcher calls liveTurnStaged when staged');
  for (const fn of ['liveTurnStaged', 'applyStagedTurn']) {
    assert.match(MAP, new RegExp(fn), `the map must name ${fn} — it is what runs`);
  }
  assert.match(MAP, /onboarding-staged\.ts/, 'and the file it lives in');
});

test('the retired engine is labelled retired wherever the map mentions it', () => {
  // It is fine — necessary, even — to mention onboarding.ts: it still holds the dispatcher. What is not fine is
  // presenting it as the live engine, which is exactly what the old map did.
  const line = MAP.split('\n').find((l) => /onboarding\.ts.*liveTurn.*applyModelTurn|liveTurn.*applyModelTurn.*onboarding\.ts/.test(l));
  if (line) {
    assert.match(line, /RETIRED|not reachable|dead|v1/i,
      'the v1 entry points are named without being marked retired — that is the exact stale claim');
  }
});

test('the stages the map lists are the stages the arc runs', () => {
  // The map's stage table is the thing a reader reasons from. If the arc gains or loses a stage, the table is
  // wrong and nothing else would say so.
  const staged = src('lib/agent/onboarding-staged.ts');
  const order = staged.match(/stageOrder:\s*\[([^\]]+)\]/);
  assert.ok(order, 'could not read STAGED_ARC.stageOrder');
  for (const raw of order![1]!.split(',')) {
    const stage = raw.trim().replace(/['"]/g, '');
    if (!stage) continue;
    assert.match(MAP, new RegExp(`\`${stage}\``), `stage "${stage}" runs but the map does not list it`);
  }
});

test('the map does not claim the eval is blocked on a missing key', () => {
  // It said the blocker was that ANTHROPIC_API_KEY is a Sensitive Vercel var with no local key. There is one, and
  // the eval runs — so that claim was steering work away from the highest-leverage net it names.
  assert.doesNotMatch(MAP, /the blocker is that .{0,40}ANTHROPIC_API_KEY/i, 'the eval is no longer blocked');
});
