import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageInstruction } from '../lib/agent/onboarding-staged.ts';

// W-46: the reclaim stage must SEED the Reclaim List from the gap the member just told (Scott's cold walk named his
// wants — "lifting again, creating art, writing" — inside his gap story, but the list captured one item). Also repairs a
// pre-existing GARBLE in the reclaim instruction ("build on BREATHE…", "march. those, don't re-ask") where two edits
// crossed sentence fragments. This asserts the instruction is coherent and carries the gap-seeding directive.

test('reclaim stage instruction · seeds from the gap first', () => {
  const s = stageInstruction('reclaim');
  assert.match(s, /SEED FROM THE GAP FIRST/, 'has the gap-seeding directive');
  assert.match(s, /NEVER start the list from zero when the gap already holds their wants/, 'forbids a cold start');
  assert.match(s, /add_reclaim_item for each one they affirm/, 'surfaces gap wants as member-confirmed items');
});

test('reclaim stage instruction · the garbled fragments are gone (coherent prose)', () => {
  const s = stageInstruction('reclaim');
  assert.ok(!/build on\s+BREATHE/.test(s), 'no "build on BREATHE" crossed fragment');
  assert.ok(!/march\.\s+those, don't re-ask/.test(s), 'no "march. those, don\'t re-ask" crossed fragment');
  assert.match(s, /build on those — don't re-ask/, 'the "build on those" clause is reunited');
});

test('reclaim stage instruction · keeps the load-bearing tagging + concrete + end-question rules', () => {
  const s = stageInstruction('reclaim');
  assert.match(s, /TAG EVERY WANT/, 'still tags every want');
  assert.match(s, /MAKE EACH WANT CONCRETE/, 'still right-sizes vague wants');
  assert.match(s, /ALWAYS end your turn with your single forward question/, 'still ends on one question');
});
