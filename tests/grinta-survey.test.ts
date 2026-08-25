import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GRINTA_ITEMS,
  ONBOARDING_BASELINE_ITEMS,
  BASELINE_GRIT_ITEMS,
  CHECKPOINT_GRIT_ITEMS,
  STRANDS,
  STRAND_CONSTRUCT,
  grintaStem,
  strandForCode,
} from '../lib/grinta/survey/instrument.ts';
import { scoreGrinta, grintaChangePct, validateReading, scoreCheckpointGrit } from '../lib/grinta/survey/scoring.ts';

test('grinta instrument · the baseline is exactly the 12 *Q1 items, 3 per strand, in R order', () => {
  assert.equal(ONBOARDING_BASELINE_ITEMS.length, 12);
  // 3 items per strand, and the strands appear in R order (grit→commitment→control→challenge)
  const strands = ONBOARDING_BASELINE_ITEMS.map(strandForCode);
  assert.deepEqual(strands, [
    'reconnect', 'reconnect', 'reconnect',
    'rewire', 'rewire', 'rewire',
    'rebuild', 'rebuild', 'rebuild',
    'reclaim', 'reclaim', 'reclaim',
  ]);
  // every baseline item is a real, coded item with a non-empty stem
  for (const code of ONBOARDING_BASELINE_ITEMS) {
    assert.ok(GRINTA_ITEMS[code], `${code} exists`);
    assert.ok(grintaStem(code).length > 0, `${code} has a stem`);
  }
});

test('grinta instrument · strands map 1:1 to the 4 Rs with their source constructs', () => {
  assert.deepEqual([...STRANDS], ['reconnect', 'rewire', 'rebuild', 'reclaim']);
  assert.equal(STRAND_CONSTRUCT.reconnect, 'grit');
  assert.equal(STRAND_CONSTRUCT.rewire, 'commitment');
  assert.equal(STRAND_CONSTRUCT.rebuild, 'control');
  assert.equal(STRAND_CONSTRUCT.reclaim, 'challenge');
});

test('grinta instrument · verbatim stems are preserved', () => {
  assert.equal(grintaStem('G1Q1'), 'I can align my behaviors and lifestyles to match who I am as a person');
  assert.equal(grintaStem('C3Q1'), 'I see challenges as opportunities to grow and improve');
});

test('grinta scoring · subscale = mean of its 3 items; composite = mean of the 4 subscale means', () => {
  // Reconnect all 5s, Rewire all 3s, Rebuild all 1s, Reclaim all 4s
  const responses = [5, 5, 5, 3, 3, 3, 1, 1, 1, 4, 4, 4];
  const score = scoreGrinta(ONBOARDING_BASELINE_ITEMS, responses);
  assert.equal(score.strands.reconnect, 5);
  assert.equal(score.strands.rewire, 3);
  assert.equal(score.strands.rebuild, 1);
  assert.equal(score.strands.reclaim, 4);
  // composite = mean(5,3,1,4) = 3.25
  assert.equal(score.composite, 3.25);
});

test('grinta scoring · a mixed strand means to 2dp', () => {
  // Reconnect = mean(4,5,3) = 4; others uniform
  const responses = [4, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  const score = scoreGrinta(ONBOARDING_BASELINE_ITEMS, responses);
  assert.equal(score.strands.reconnect, 4);
  assert.equal(score.composite, 2.5); // mean(4,2,2,2)
});

test('grinta scoring · groups by strand even when only ONE strand is administered (the §2e checkpoint shape)', () => {
  // grit-only re-read (baseline + hypothetical extra grit items) still scores that strand alone
  const score = scoreGrinta(['G1Q1', 'G2Q1', 'G3Q1'], [4, 4, 4]);
  assert.deepEqual(Object.keys(score.strands), ['reconnect']);
  assert.equal(score.strands.reconnect, 4);
  assert.equal(score.composite, 4);
});

test('grinta scoring · NO delta on a first reading; then signed up-positive percent change', () => {
  assert.equal(grintaChangePct(3.5, null), null); // baseline
  assert.equal(grintaChangePct(4.0, 3.2), 25); // (4-3.2)/3.2*100 = 25
  assert.equal(grintaChangePct(3.0, 4.0), -25); // a drop reads negative
});

test('grinta §2e · the Checkpoint adds six GRIT items (all reconnect strand), in Recognition→Excavation→Spark order', () => {
  assert.deepEqual([...CHECKPOINT_GRIT_ITEMS], ['G1Q2', 'G1Q3', 'G2Q2', 'G2Q3', 'G3Q2', 'G3Q3']);
  assert.deepEqual([...BASELINE_GRIT_ITEMS], ['G1Q1', 'G2Q1', 'G3Q1']);
  for (const code of CHECKPOINT_GRIT_ITEMS) {
    assert.ok(GRINTA_ITEMS[code], `${code} exists`);
    assert.equal(strandForCode(code), 'reconnect', `${code} is a grit item`);
  }
  assert.equal(grintaStem('G1Q2'), "I am aware of what constructs and dimensions make up my 'identity'");
  // CASE ONLY, 2026-08-25 (Jay, mid-walk). "my fade" → "my Fade": these three stems held the only lowercase uses
  // of the Fade and the Doors in the product, and a member meets both capitalised everywhere else. The WORDING is
  // Greg's and is untouched — this assertion is the tripwire that proves it, so it moves deliberately rather than
  // being loosened to a case-insensitive compare, which would stop guarding his words at all.
  assert.equal(grintaStem('G3Q3'), 'I recognize various attributions and justifications that may contribute to my Fade');
});

test('grinta §2e · Checkpoint recomputes grit from NINE items, carries the other strands, moves the composite up', () => {
  // Baseline grit all 3s (Ave1 = 3); the Checkpoint grit all 5s → Ave2 = mean(3,3,3,5,5,5,5,5,5) = 4.33
  const cp = scoreCheckpointGrit({
    baselineGritValues: [3, 3, 3],
    newGritValues: [5, 5, 5, 5, 5, 5],
    carriedStrands: { rewire: 3, rebuild: 3, reclaim: 3 },
  });
  assert.equal(cp.gritBaseline, 3);
  assert.equal(cp.gritNow, 4.33);
  assert.equal(cp.score.strands.reconnect, 4.33, 'grit strand steps UP');
  assert.equal(cp.score.strands.rewire, 3, 'the other strands are carried forward unchanged');
  // composite = mean(4.33, 3, 3, 3) = 3.33 — climbs from the all-3s baseline composite of 3
  assert.equal(cp.score.composite, 3.33);
  assert.equal(cp.gritChangePct, 44.33, '(4.33 − 3) / 3 × 100 — the first grinta movement, positive');
});

test('grinta §2e · no baseline grit (a v1-onboarded member) → grit is the 6 alone, no delta', () => {
  const cp = scoreCheckpointGrit({ baselineGritValues: [], newGritValues: [4, 4, 4, 4, 4, 4], carriedStrands: {} });
  assert.equal(cp.gritNow, 4);
  assert.equal(cp.gritChangePct, null, 'no baseline to move from');
  assert.equal(cp.score.composite, 4);
});

test('grinta scoring · validation rejects out-of-range, non-integer, unknown codes, length mismatch', () => {
  assert.equal(validateReading(ONBOARDING_BASELINE_ITEMS, [5, 5, 5, 3, 3, 3, 1, 1, 1, 4, 4, 4]).ok, true);
  assert.equal(validateReading(ONBOARDING_BASELINE_ITEMS, [6, 5, 5, 3, 3, 3, 1, 1, 1, 4, 4, 4]).ok, false); // 6 > max
  assert.equal(validateReading(['G1Q1'], [3.5]).ok, false); // non-integer
  assert.equal(validateReading(['NOPE'], [3]).ok, false); // unknown code
  assert.equal(validateReading(['G1Q1', 'G2Q1'], [3]).ok, false); // length mismatch
});
