import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grintaScore, computeGrinta, grintaLine, GRINTA_WINDOW_DAYS } from '../lib/grinta/index.ts';

const W = GRINTA_WINDOW_DAYS;

test('score is 0–100, consistency-dominant, and bounded', () => {
  assert.equal(grintaScore({ daysActive: 0, workouts: 0, programEvents: 0, windowDays: W }), 0);
  assert.equal(grintaScore({ daysActive: W, workouts: 8, programEvents: 4, windowDays: W }), 100);
  // showing up every day, nothing else, is already most of the score (consistency weight 0.6)
  assert.equal(grintaScore({ daysActive: W, workouts: 0, programEvents: 0, windowDays: W }), 60);
  // over-doing one input can't exceed its cap
  assert.equal(grintaScore({ daysActive: W, workouts: 100, programEvents: 100, windowDays: W }), 100);
});

test('trend compares this window to the prior one', () => {
  const up = computeGrinta(
    { daysActive: 10, workouts: 4, programEvents: 2, windowDays: W },
    { daysActive: 4, workouts: 1, programEvents: 0, windowDays: W },
    'athlete',
  );
  assert.equal(up.direction, 'up');
  assert.ok(up.delta > 0);

  const flat = computeGrinta(
    { daysActive: 6, workouts: 2, programEvents: 1, windowDays: W },
    { daysActive: 6, workouts: 2, programEvents: 1, windowDays: W },
    null,
  );
  assert.equal(flat.direction, 'flat');
  assert.equal(flat.delta, 0);
});

test('the line is reflective and names the identity, with a gentle empty state', () => {
  assert.match(grintaLine(11, W, 'Athlete'), /shown up 11 of the last 14 days/);
  assert.match(grintaLine(11, W, 'Athlete'), /the Athlete/); // natural case, not all-caps
  assert.match(grintaLine(0, W, 'Athlete'), /fresh window/i);
});
