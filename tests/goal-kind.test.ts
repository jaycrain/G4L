import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGoal } from '../lib/reclaim/goal-kind.ts';
import { looksTrackable } from '../lib/measure/store.ts';

// JAY'S OWN RECLAIM LIST IS THE FIXTURE.
//
// This is the actual bug report — his five items, exactly as they read on his Reclaim List page on 2026-08-12,
// and the affordance each one got. Using the real list rather than invented strings is the point: the failure
// was never visible in a unit test because nobody had run his words through it.

const JAY = {
  race: 'Finish in top 20% of my age group at Big Sugar',
  eating: 'Eating oatmeal, salad, light dinner most days and skipping the late snacking',
  yoga: 'Yoga and kettlebell work 3 times per week',
  intervals: 'VO2 Max and Threshold interval rides',
  climb: 'One sustained climb per weekend',
} as const;

test('THE BUG, stated as an assertion: his list classifies the way a person would read it', () => {
  assert.equal(classifyGoal(JAY.race), 'outcome', 'a race placing is a one-time result, not a trend line');
  assert.equal(classifyGoal(JAY.yoga), 'cadence', '"3 times per week" is a count of days inside a week');
  assert.equal(classifyGoal(JAY.climb), 'cadence', 'the number is a WORD — "One … per weekend" still a cadence');
  assert.equal(classifyGoal(JAY.intervals), 'none', 'no target and no rhythm — nothing to offer yet');
  assert.equal(classifyGoal(JAY.eating), 'none', 'a description of how he eats, with no stated frequency');
});

test('and it is EXACTLY BACKWARDS from what shipped — the regression this locks', () => {
  // The old rule offered a tracker on precisely the wrong item. Asserting the old behaviour here, against the
  // still-live `looksTrackable`, so the day someone "simplifies" the classifier this test says what breaks.
  assert.equal(looksTrackable(JAY.race), true, 'the shipped rule DOES offer on the race result (the bug)');
  assert.equal(looksTrackable(JAY.yoga), false, 'and does NOT offer on the real weekly commitment');
  assert.equal(looksTrackable(JAY.climb), false, 'nor on the other one');

  // The new classifier inverts all three.
  assert.notEqual(classifyGoal(JAY.race), 'measure');
  assert.equal(classifyGoal(JAY.yoga), 'cadence');
  assert.equal(classifyGoal(JAY.climb), 'cadence');
});

// ── ORDER IS THE FIX ─────────────────────────────────────────────────────────────────────────────────────────

test('OUTCOME beats MEASURE — "top 20%" must not be read as a percent to trend toward', () => {
  assert.equal(classifyGoal('top 20%'), 'outcome');
  assert.equal(classifyGoal('Finish top 10 in my division'), 'outcome');
  // The percent MEASURE pattern still fires when the percent is genuinely a level to reach.
  assert.equal(classifyGoal('Get body fat to 18%'), 'measure');
});

test('CADENCE beats MEASURE — a rhythm carrying a unit is still a rhythm', () => {
  // Both signals present: "5 miles" (measure) and "3 times per week" (cadence). The commitment a member keeps
  // is the weekly count, and the week grid is the instrument for it.
  assert.equal(classifyGoal('Run 5 miles 3 times per week'), 'cadence');
  // With no rhythm, the same distance is a measure.
  assert.equal(classifyGoal('Run 5 miles'), 'measure');
});

// ── THE SHAPES MEMBERS ACTUALLY WRITE ────────────────────────────────────────────────────────────────────────

test('cadence in the forms people really use', () => {
  for (const s of [
    '3 times per week',
    'twice a week',
    'Lift four times each week',
    'ride 3x/week',
    'Walk every morning',
    'Read daily',
    'One sustained climb per weekend',
    'Two long rides a month',
  ]) {
    assert.equal(classifyGoal(s), 'cadence', `"${s}" should be a cadence`);
  }
});

test('measure still works — the original patterns were right for what they covered', () => {
  for (const s of ['Get down to 190 lbs', 'Save $5000', 'Ride 115 miles', 'Get resting HR under 55']) {
    assert.equal(classifyGoal(s), 'measure', `"${s}" should be a measure`);
  }
});

test('none is a real answer — most of a Reclaim List is neither', () => {
  // The list is mostly identity and intention, not metrics. Over-offering a tracker on "be present with my kids"
  // would be worse than offering none: it turns a life back into a dashboard.
  for (const s of ['Be present with my kids', 'Feel like myself again', 'VO2 Max and Threshold interval rides']) {
    assert.equal(classifyGoal(s), 'none', `"${s}" should be none`);
  }
});

test('empty and junk are none, never a crash', () => {
  assert.equal(classifyGoal(''), 'none');
  assert.equal(classifyGoal('   '), 'none');
  assert.equal(classifyGoal(undefined as unknown as string), 'none');
});
