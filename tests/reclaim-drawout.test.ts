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
  // The W-46 "vibe wins" revert — the protection this test exists for — STANDS.
  assert.match(s, /do NOT open by proposing or reciting/, 'never opens by proposing/reciting a set of items');
  // WHAT CHANGED (2026-08-19): "DRAW THIS OUT" and "One want at a time" are gone. They described the pre-builder
  // design and survived three weeks past the 2026-07-29 switch to structured capture, instructing a multi-turn
  // elicitation the surface makes impossible — and giving the model its reason to open the topic early, which is
  // the run-ahead behind the "rushed" reports.
  assert.ok(!/DRAW THIS OUT/.test(s), 'no conversational elicitation — the builder is the input');
  assert.ok(!/One want at a time/.test(s), 'no one-at-a-time march');
  assert.match(s, /do NOT open this topic yourself/, 'the engine opens the beat, not the model');
});

test('reclaim stage instruction · coherent prose, no crossed fragments', () => {
  const s = stageInstruction('reclaim');
  assert.ok(!/build on\s+BREATHE/.test(s), 'no "build on BREATHE" crossed fragment');
  assert.ok(!/march\.\s+those, don't re-ask/.test(s), 'no "march. those, don\'t re-ask" crossed fragment');
});

test('reclaim stage instruction · tagging survives, the retired beats do not', () => {
  const s = stageInstruction('reclaim');
  // Tagging is still load-bearing, but for ONE reason now: wants named in an earlier beat SEED the builder, so it
  // opens holding what she already said and she never has to say it twice.
  assert.match(s, /TAG EVERY WANT THEY NAME EARLIER/, 'earlier wants still seed the builder');
  assert.match(s, /RECEIVE IT/, 'the model receives the submission — its text IS her read-back');

  // Both of these described beats that were deliberately REMOVED. Sharpening moved to the Companion rail
  // (member-initiated, non-blocking — see enterGrintaSurvey); the end-question rule was literally instructing the
  // "what else?" march that the builder replaced.
  assert.ok(!/MAKE EACH WANT CONCRETE/.test(s), 'sharpening moved to the rail, not a gate before the survey');
  assert.ok(!/ALWAYS end your turn with your single forward question/.test(s), 'no "what else?" march');
});

test('gap stage instruction · the CLOSING turn is a receipt, not another question', () => {
  const s = stageInstruction('gap');
  // The end-with-a-question rule had no exemption for the turn the member closes on, so the model asked one more,
  // receiptOnly() stripped it, and receiveThen fell back to the bare bridge — she finished her story and read a
  // scripted line straight into "add each thing below". Whether she got a beat depended on the model's sentence
  // shape, which is why the same code passed and failed on alternate runs.
  assert.match(s, /ALWAYS end your turn with your single forward question/, 'the rule still holds while drawing out');
  assert.match(s, /ONE EXEMPTION: the turn they CLOSE the story/, 'and stops at the moment she has finished answering');
  assert.match(s, /do NOT ask anything further/i);
  assert.match(s, /RECEIPT/, 'that turn is what she reads before the next beat opens');
});

test('the gap steering tells the model to KEEP a want she volunteers — where it can act on it', () => {
  const gap = stageInstruction('gap');
  // The reclaim steering says "tag every want they name earlier — the gap story especially", but the model does
  // not see that until the gap beat is OVER. An instruction to have already done something is not an instruction.
  assert.match(gap, /call add_reclaim_item the moment it lands/i, 'seeding must be reachable during the gap');
  // ...without turning the gap beat into the list beat. This is the rule that stops the run-ahead.
  assert.match(gap, /do NOT rush on to what they want back/i);
  assert.match(gap, /do NOT ask for more of them/i, 'keep what she offers; never solicit');
});
