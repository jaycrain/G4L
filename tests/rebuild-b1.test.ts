import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB1Opening, applyRebuildB1Turn } from '../lib/agent/rebuild.ts';
import { scoreWhy, whyResponsesMap, WHY_ITEMS, WHY_ITEM_COUNT, WHY_DOMAIN_SPLIT } from '../lib/rebuild/why-instrument.ts';
import { parseLikert } from '../lib/agent/onboarding-staged.ts';

// B1 · What is Your Why? — the administered SDT arc (12 items, 1–7, activity→diet), the scale parameterization, and
// Greg's SDT scoring. B1 stores but never displays (RB-1) — the arc closes on a forward-looking reflection, no number.

// PAST THE ENGAGEMENT DOORWAY (2026-08-28). B1 now opens on Greg's Stage 1 — the Rewire→Rebuild shift and one open
// question — and the instrument arrives on the next turn. The doorway itself is covered in
// tests/no-session-opens-on-an-assessment.test.ts; these tests are about the instrument behind it.
// TO THE INSTRUMENT — now two beats in, not one. Greg's five stages put the ACTIVITY ELICITATION between the
// doorway and the first item (2026-08-28): the member says why they want to move, in their own words, and the
// six activity items follow. The elicitation holds for two substantive turns, so that is what this walks.
// The stages themselves are covered in tests/b1-five-stages.test.ts; these tests are about the instrument.
const pastDoorway = () => {
  let t = applyRebuildB1Turn(rebuildB1Opening().state, [], 'That I left it too late.', { text: 'Mm.' });
  t = applyRebuildB1Turn(t.state, [], 'I want to keep up with my kids.', { text: 'Keeping up.' });
  return applyRebuildB1Turn(t.state, [], 'And I miss feeling strong.', { text: 'Strong.' });
};


/** Answer one item — and if that answer closed the activity half, cross the eating elicitation too. */
const rateOne = (t: Turn): Turn => {
  const next = applyRebuildB1Turn(t.state, [], '5', { text: 'Mm.' });
  return (next.state as ConvState).stage === 'why-eating-talk'
    ? applyRebuildB1Turn(next.state, [], 'Eating is about not feeling sluggish.', { text: 'Mm.' })
    : next;
};

test('B1 arc · warm frame → item 0 (no framing prompt), then walks 12 items → forward-looking close', () => {
  assert.match(rebuildB1Opening().reply, /Rewire was your head/i, 'the doorway names the shift into Rebuild');

  let t = pastDoorway();
  assert.equal(t.state.stage, 'why-activity', 'the activity half of the instrument');
  assert.match(t.reply, /a simple place to start/i, 'the warm frame is in');
  assert.match(t.reply, /1 \(not at all true for you\) to 7/i, 'the 1–7 scale is set, not 1–5');
  assert.doesNotMatch(t.reply, /Why do you want to be physically active/i, 'the activity framing prompt is removed (Donna)');
  assert.ok(t.reply.includes(WHY_ITEMS[0]!.stem), 'item 0 verbatim');

  // Answer all 12 with valid 1–7 values, crossing the eating elicitation at the halfway seam.
  for (let i = 0; i < WHY_ITEM_COUNT; i++) {
    assert.equal(t.complete, false, 'not complete mid-instrument');
    t = rateOne(t);
  }
  // THE INSTRUMENT NO LONGER ENDS THE SESSION. Greg's stages 4 and 5 follow it — the teaching beat, then
  // consolidation — so the twelfth answer hands on rather than closing. (tests/b1-five-stages.test.ts owns those.)
  assert.equal(t.complete, false, 'the items are in, but the Session is not over');
  t = applyRebuildB1Turn(t.state, [], 'The kids one.', { text: 'That one.' });
  t = applyRebuildB1Turn(t.state, [], 'Yes, years ago.', { text: 'It has.' });
  t = applyRebuildB1Turn(t.state, [], 'Being strong enough to say yes.', { text: 'Saying yes.' });
  t = applyRebuildB1Turn(t.state, [], 'That I can still do hard things.', { text: 'Still can.' });
  assert.equal(t.complete, true, 'after consolidation, B1 completes');
  assert.equal(t.state.stage, 'complete');
  assert.equal((t.state.administeredResponses ?? []).length, 12, 'all 12 responses captured');
  assert.match(t.reply, /starting why/i, 'the forward-looking close');
  assert.doesNotMatch(t.reply, /\/\s*7|\bscore\b/i, 'RB-1: no number, no "score" at the close');
});

test('B1 arc · the domain transition frame fires when the diet items begin (index 6)', () => {
  let t = pastDoorway();
  // The 6th activity answer now hands into the EATING ELICITATION, not straight to the diet items — they say why
  // eating matters before rating it, which is Greg's stage 3.
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = applyRebuildB1Turn(t.state, [], '4', { text: '' } as never);
  assert.equal(t.state.stage, 'why-eating-talk', 'the eating beat opens before the eating items');
  t = applyRebuildB1Turn(t.state, [], 'Eating is about not feeling sluggish.', { text: 'Mm.' });
  assert.match(t.reply, /different reasons for eating than for moving/i, "Greg's dual-domain point, at the crossing");
  assert.match(t.reply, /Now the other half of it — eating/i, 'the domain transition frame');
  assert.doesNotMatch(t.reply, /Why do you want to eat/i, 'the diet framing prompt is removed too (symmetry with activity)');
  assert.ok(t.reply.includes(WHY_ITEMS[WHY_DOMAIN_SPLIT]!.stem), 'the first diet item, verbatim');
});

test('B1 arc · a non-number (or out-of-scale) is re-prompted, not recorded — instrument fidelity', () => {
  const t = pastDoorway();
  const bad = applyRebuildB1Turn(t.state, [], 'pretty true I guess', { text: '' } as never);
  assert.equal((bad.state.administeredResponses ?? []).length, 0, 'a non-Likert answer records nothing');
  assert.match(bad.reply, /1 to 7/i, 're-prompts for a 1–7');
  // 8 is off a 1–7 scale → also re-prompt, not record.
  const off = applyRebuildB1Turn(t.state, [], '8', { text: '' } as never);
  assert.equal((off.state.administeredResponses ?? []).length, 0, '8 is out of scale — not recorded');
  assert.match(off.reply, /1 to 7/i);
});

test('parseLikert · scale parameterization — 7 accepts 1–7, default still tops out at 5', () => {
  assert.equal(parseLikert('7', 7), 7, '7 valid on a 1–7 scale');
  assert.equal(parseLikert('seven', 7), 7, 'the spelled word too');
  assert.equal(parseLikert('7'), null, 'default (5) rejects 7');
  assert.equal(parseLikert('6', 7), 6);
  assert.equal(parseLikert('0', 7), null, '0 is below the floor');
  assert.equal(parseLikert('9', 7), null, '9 is above the ceiling');
  assert.equal(parseLikert('4'), 4, 'the IDQ/Grinta callers (default 5) are unchanged');
});

test('scoreWhy · Greg’s SDT scoring — per-domain autonomous/controlled/amotivation, separately for activity + diet', () => {
  // activity: PA1 PA2 PA3 (auto) = 6,6,6; PA4 PA5 (controlled) = 2,4; PA6 (amot) = 1
  // diet:     DI1 DI2 DI3 (auto) = 7,5,6; DI4 DI5 (controlled) = 3,3; DI6 (amot) = 2
  const responses = [6, 6, 6, 2, 4, 1, 7, 5, 6, 3, 3, 2];
  const s = scoreWhy(responses);
  assert.equal(s.activity.autonomous, 6, 'mean(6,6,6)');
  assert.equal(s.activity.controlled, 3, 'mean(2,4)');
  assert.equal(s.activity.amotivation, 1, 'the single item');
  assert.equal(s.diet.autonomous, 6, 'mean(7,5,6)');
  assert.equal(s.diet.controlled, 3, 'mean(3,3)');
  assert.equal(s.diet.amotivation, 2);
});

test('scoreWhy · rejects a wrong response count (guards the persist path)', () => {
  assert.throws(() => scoreWhy([1, 2, 3]), /expects 12/);
});

test('whyResponsesMap · keys by item code (re-scorable from raw)', () => {
  const m = whyResponsesMap([1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5]);
  assert.equal(m['B1-PA1'], 1);
  assert.equal(m['B1-PA6'], 6);
  assert.equal(m['B1-DI1'], 7);
  assert.equal(Object.keys(m).length, 12);
});
