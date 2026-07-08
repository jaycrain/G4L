import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCheckpointStrand, scoreCheckpointGrit } from '../lib/grinta/survey/scoring.ts';
import {
  BASELINE_COMMITMENT_ITEMS,
  CHECKPOINT_COMMITMENT_ITEMS,
  GRINTA_ITEMS,
  strandForCode,
} from '../lib/grinta/survey/instrument.ts';

// R4 Rewire Checkpoint engine — the Commitment strand re-read, and the COMPONENT-vs-COMPOSITE split (Jay's call: the
// ceremony foregrounds the component move, which is legible; the composite is the diluted background trend).

test('the 6 R4 items are commitment (rewire) items, verbatim + in the bank', () => {
  assert.deepEqual(CHECKPOINT_COMMITMENT_ITEMS, ['W1Q2', 'W1Q3', 'W2Q2', 'W2Q3', 'W3Q2', 'W3Q3']);
  assert.deepEqual(BASELINE_COMMITMENT_ITEMS, ['W1Q1', 'W2Q1', 'W3Q1']);
  for (const code of [...BASELINE_COMMITMENT_ITEMS, ...CHECKPOINT_COMMITMENT_ITEMS]) {
    assert.equal(strandForCode(code), 'rewire', `${code} is on the commitment/rewire strand`);
  }
  // verbatim (validated instrument — no paraphrase)
  assert.equal(GRINTA_ITEMS.W1Q3!.stem, 'I can counter negative thoughts with positive affirmations');
  assert.equal(GRINTA_ITEMS.W3Q3!.stem, 'I am confident that I can maintain physical activity habits and healthy eating patterns over time');
});

test('scoreCheckpointStrand · updates the target strand to Ave2, carries the others, composite re-averages', () => {
  // baseline: reconnect 3.2 · rewire 3.0 (W*Q1 = 3,3,3) · rebuild 3.1 · reclaim 3.3  → composite 3.15
  const r = scoreCheckpointStrand({
    target: 'rewire',
    baselineValues: [3, 3, 3], // W1Q1, W2Q1, W3Q1 → Ave1 = 3.0
    newValues: [4, 4, 4, 4, 5, 4], // the 6 → Ave2 = mean(3,3,3,4,4,4,4,5,4) = 34/9 = 3.78
    carriedStrands: { reconnect: 3.2, rebuild: 3.1, reclaim: 3.3 },
  });
  assert.equal(r.baseline, 3.0, 'Ave1 = the 3 commitment baselines');
  assert.equal(r.now, 3.78, 'Ave2 = the 9-item commitment mean');
  assert.equal(r.score.strands.rewire, 3.78, 'the rewire strand updated');
  assert.equal(r.score.strands.reconnect, 3.2, 'reconnect carried (unchanged)');
  assert.equal(r.score.composite, 3.35, 'composite = mean(3.78, 3.2, 3.1, 3.3)');
});

test('the COMPONENT move is big + legible; the COMPOSITE move is diluted (why the ceremony foregrounds the component)', () => {
  const r = scoreCheckpointStrand({
    target: 'rewire',
    baselineValues: [3, 3, 3],
    newValues: [4, 4, 4, 4, 5, 4],
    carriedStrands: { reconnect: 3.2, rebuild: 3.1, reclaim: 3.3 },
  });
  // component change = (3.78 − 3.0)/3.0 × 100 = +26% — this is what the reveal shows
  assert.equal(r.changePct, 26, 'the commitment component moved +26% — the number the copy narrates');
  // the composite move is a quarter of that: 3.15 → 3.35 ≈ +6.3% — diluted, kept in the background
  const priorComposite = 3.15;
  const compositeChange = Math.round(((r.score.composite - priorComposite) / priorComposite) * 100 * 100) / 100;
  assert.ok(compositeChange < r.changePct / 3, `composite move (${compositeChange}%) is a fraction of the component move (${r.changePct}%)`);
});

test('scoreCheckpointStrand · a genuine commitment DROP reports a signed-down component change (down, never null)', () => {
  const r = scoreCheckpointStrand({
    target: 'rewire',
    baselineValues: [4, 4, 4], // Ave1 = 4.0
    newValues: [3, 3, 3, 3, 3, 3], // Ave2 = mean(4,4,4,3,3,3,3,3,3) = 30/9 = 3.33
    carriedStrands: { reconnect: 3.2 },
  });
  assert.equal(r.now, 3.33);
  assert.ok(r.changePct! < 0, 'an honest drop reads negative (the ceremony renders grey, never red — HH)');
});

test('scoreCheckpointStrand · no baseline → component change is null (degrade to the flat/first-reading branch)', () => {
  const r = scoreCheckpointStrand({ target: 'rewire', baselineValues: [], newValues: [4, 4, 4, 4, 4, 4], carriedStrands: {} });
  assert.equal(r.changePct, null, 'no baseline → no delta; the ceremony degrades to flat, never breaks');
});

test('scoreCheckpointGrit still delegates correctly (§2e unchanged)', () => {
  const g = scoreCheckpointGrit({ baselineGritValues: [3, 3, 3], newGritValues: [4, 4, 4, 4, 4, 4], carriedStrands: { rewire: 3.0 } });
  assert.equal(g.gritNow, 3.67);
  assert.equal(g.score.strands.reconnect, 3.67, 'grit updates the reconnect strand');
});
