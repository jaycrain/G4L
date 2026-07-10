import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB1Opening, applyRebuildB1Turn } from '../lib/agent/rebuild.ts';
import { WHY_ITEM_COUNT, WHY_SCALE_MAX } from '../lib/rebuild/why-instrument.ts';

// W-24 — the `expects` chip signal. An administered turn tells the client "the next answer is a fixed-scale pick" so
// the surface can render tappable chips instead of a free-text number box (the mis-scaling fix). The invariant: chips
// on every administered ASK (opener / item / re-prompt), NONE once the instrument completes (the close is prose).

test('B1 opener carries the scale chips signal — full scale + the instrument’s pole anchors', () => {
  const t = rebuildB1Opening();
  assert.ok(t.expects, 'the opener (item 0) expects a scale pick');
  assert.equal(t.expects!.kind, 'scale');
  assert.equal(t.expects!.min, 1);
  assert.equal(t.expects!.max, WHY_SCALE_MAX, 'the SDT 1–7 ceiling — NOT the default 5 (the exact bug Jay hit)');
  assert.equal(t.expects!.minLabel, 'not at all true');
  assert.equal(t.expects!.maxLabel, 'very true');
});

test('B1 mid-instrument · each answered item hands the NEXT item’s chips; the final item drops them', () => {
  let t = rebuildB1Opening();
  // Answer items 0..N-2 → each turn still expects a scale (the next item).
  for (let i = 0; i < WHY_ITEM_COUNT - 1; i++) {
    t = applyRebuildB1Turn(t.state, [], '5');
    assert.ok(t.expects, `after item ${i}, the next item still expects a scale`);
    assert.equal(t.expects!.max, WHY_SCALE_MAX);
    assert.equal(t.complete, false);
  }
  // Answer the final item → completes → the forward-looking close is prose, no chips.
  t = applyRebuildB1Turn(t.state, [], '5');
  assert.equal(t.complete, true, 'the 12th answer completes B1');
  assert.equal(t.expects, undefined, 'no chips on the close — it is prose, not an item');
});

test('B1 re-prompt · an out-of-scale answer re-prompts the SAME item and still expects the scale', () => {
  const t0 = rebuildB1Opening();
  const t1 = applyRebuildB1Turn(t0.state, [], 'pretty true'); // no digit → re-prompt, do not advance
  assert.ok(t1.expects, 're-prompt still expects a scale pick');
  assert.equal(t1.expects!.max, WHY_SCALE_MAX);
  assert.equal((t1.state.administeredResponses ?? []).length, 0, 'nothing recorded on a bad answer');
});
