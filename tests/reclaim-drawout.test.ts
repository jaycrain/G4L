import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageInstruction } from '../lib/agent/onboarding-staged.ts';

// The reclaim stage must be DRAWN OUT, not seeded. This locks the vibe-wins revert of W-46's "SEED FROM THE GAP FIRST"
// front-load (Jay 2026-07-26 — Donna's walk raced into the Reclaim List). The list is drawn out the way the gap was;
// the model never opens by mining the gap and proposing a batch of candidate items. (Completeness — not losing a want
// the member genuinely named — is preserved by the silent per-want tagging rule, NOT by front-loading a list.)

test('reclaim stage instruction · draws it out, does NOT seed/propose from the gap', () => {
  const s = stageInstruction('reclaim');
  assert.ok(!/SEED FROM THE GAP FIRST/.test(s), 'no gap-seeding front-load');
  assert.ok(!/NEVER start the list from zero/.test(s), 'no "never start from zero" push');
  assert.match(s, /DRAW THIS OUT the way you drew out the gap/, 'opens by drawing out, the way the gap was drawn out');
  assert.match(s, /do NOT open by proposing or reciting/, 'never opens by proposing/reciting a set of items');
  assert.match(s, /One want at a time/, 'still one want at a time, received and reflected');
});

test('reclaim stage instruction · coherent prose, no crossed fragments', () => {
  const s = stageInstruction('reclaim');
  assert.ok(!/build on\s+BREATHE/.test(s), 'no "build on BREATHE" crossed fragment');
  assert.ok(!/march\.\s+those, don't re-ask/.test(s), 'no "march. those, don\'t re-ask" crossed fragment');
});

test('reclaim stage instruction · keeps the load-bearing tagging + concrete + end-question rules', () => {
  const s = stageInstruction('reclaim');
  assert.match(s, /TAG EVERY WANT/, 'still tags every want the member names (so nothing genuinely named is lost)');
  assert.match(s, /MAKE EACH WANT CONCRETE/, 'still right-sizes vague wants');
  assert.match(s, /ALWAYS end your turn with your single forward question/, 'still ends on one question');
});
