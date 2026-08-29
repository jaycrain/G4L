import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB1Opening, applyRebuildB1Turn } from '../lib/agent/rebuild.ts';
import { WHY_ITEM_COUNT, WHY_SCALE_MAX } from '../lib/rebuild/why-instrument.ts';

// W-24 — the `expects` chip signal. An administered turn tells the client "the next answer is a fixed-scale pick" so
// the surface can render tappable chips instead of a free-text number box (the mis-scaling fix). The invariant: chips
// on every administered ASK (opener / item / re-prompt), NONE once the instrument completes (the close is prose).
//
// AND NONE ON THE ENGAGEMENT DOORWAY (2026-08-28), which is the other half of the same invariant: chips under an
// open question would turn the doorway back into the assessment it exists to precede. That case is asserted in
// tests/no-session-opens-on-an-assessment.test.ts; here the walk starts at the instrument, one turn in.
// TO THE INSTRUMENT — now two beats in, not one. Greg's five stages put the ACTIVITY ELICITATION between the
// doorway and the first item (2026-08-28): the member says why they want to move, in their own words, and the
// six activity items follow. The elicitation holds for two substantive turns, so that is what this walks.
// The stages themselves are covered in tests/b1-five-stages.test.ts; these tests are about the instrument.
const pastDoorway = () => {
  let t = applyRebuildB1Turn(rebuildB1Opening().state, [], 'That I left it too late.', { text: 'Mm.' });
  t = applyRebuildB1Turn(t.state, [], 'I want to keep up with my kids.', { text: 'Keeping up.' });
  return applyRebuildB1Turn(t.state, [], 'And I miss feeling strong.', { text: 'Strong.' });
};

test('the engagement doorway offers no chips — only the instrument behind it does', () => {
  assert.equal(rebuildB1Opening().expects, undefined, 'an open question is answered in words');
  assert.ok(pastDoorway().expects, 'and the instrument brings its scale with it');
});


/** Answer one item — and if that answer closed the activity half, cross the eating elicitation too. */
const rateOne = (t: Turn): Turn => {
  const next = applyRebuildB1Turn(t.state, [], '5', { text: 'Mm.' });
  return (next.state as ConvState).stage === 'why-eating-talk'
    ? applyRebuildB1Turn(next.state, [], 'Eating is about not feeling sluggish.', { text: 'Mm.' })
    : next;
};

test('B1 opener carries the scale chips signal — full scale + the instrument’s pole anchors', () => {
  const t = pastDoorway();
  assert.ok(t.expects, 'the opener (item 0) expects a scale pick');
  assert.equal(t.expects!.kind, 'scale');
  assert.equal(t.expects!.min, 1);
  assert.equal(t.expects!.max, WHY_SCALE_MAX, 'the SDT 1–7 ceiling — NOT the default 5 (the exact bug Jay hit)');
  assert.equal(t.expects!.minLabel, 'not at all true');
  assert.equal(t.expects!.maxLabel, 'very true');
  // W-48: the universal "Question n of y" cue rides the same signal — the opener is item 1 of the instrument's length.
  assert.equal(t.expects!.index, 1, 'opener is Question 1');
  assert.equal(t.expects!.total, WHY_ITEM_COUNT, 'total = the instrument length (12)');
});

test('B1 progress · the chip signal advances index as items are answered', () => {
  let t = pastDoorway();
  assert.equal(t.expects!.index, 1);
  t = applyRebuildB1Turn(t.state, [], '5');
  assert.equal(t.expects!.index, 2, 'after answering item 1, the cue reads Question 2');
  assert.equal(t.expects!.total, WHY_ITEM_COUNT);
  t = applyRebuildB1Turn(t.state, [], 'gibberish'); // re-prompt: same item, same index
  assert.equal(t.expects!.index, 2, 're-prompt holds the same question number');
});

test('B1 mid-instrument · each answered item hands the NEXT item’s chips; the final item drops them', () => {
  let t = pastDoorway();
  // Answer items 0..N-2 → each turn still expects a scale (the next item).
  for (let i = 0; i < WHY_ITEM_COUNT - 1; i++) {
    t = rateOne(t);
    assert.ok(t.expects, `after item ${i}, the next item still expects a scale`);
    assert.equal(t.expects!.max, WHY_SCALE_MAX);
    assert.equal(t.complete, false);
  }
  // Answer the final item → the instrument is done → no chips. It no longer COMPLETES the Session: Greg's
  // teaching and consolidation beats follow (2026-08-28), and both are prose. What this test is about is the
  // chip signal, and the signal must drop the moment the last item is answered either way.
  t = applyRebuildB1Turn(t.state, [], '5');
  assert.equal(t.state.stage, 'why-teach', 'the instrument hands into the teaching beat');
  assert.equal(t.expects, undefined, 'no chips on the close — it is prose, not an item');
});

test('B1 re-prompt · an out-of-scale answer re-prompts the SAME item and still expects the scale', () => {
  const t0 = pastDoorway();
  const t1 = applyRebuildB1Turn(t0.state, [], 'pretty true'); // no digit → re-prompt, do not advance
  assert.ok(t1.expects, 're-prompt still expects a scale pick');
  assert.equal(t1.expects!.max, WHY_SCALE_MAX);
  assert.equal((t1.state.administeredResponses ?? []).length, 0, 'nothing recorded on a bad answer');
});
