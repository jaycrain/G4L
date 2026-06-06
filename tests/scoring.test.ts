import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreIdq, normalizeIdScore, computeMovement } from '../lib/idq/scoring.ts';

const fill = (v: number) => Array.from({ length: 24 }, () => v);

test('normalizeIdScore maps raw 0..120 onto 0..100 (2dp)', () => {
  assert.equal(normalizeIdScore(120), 100);
  assert.equal(normalizeIdScore(60), 50);
  assert.equal(normalizeIdScore(24), 20); // true Likert-1 floor (CONTRACTS §2 nuance)
  assert.equal(normalizeIdScore(100), 83.33);
});

test('all-3 responses → each dimension 18, raw 72, normalized 60', () => {
  const s = scoreIdq(fill(3));
  assert.deepEqual(s.dimensions, { physical: 18, self: 18, social: 18, outlook: 18 });
  assert.equal(s.idScoreRaw, 72);
  assert.equal(s.idScore, 60);
});

test('all-5 responses → max: each dim 30, raw 120, normalized 100', () => {
  const s = scoreIdq(fill(5));
  assert.deepEqual(s.dimensions, { physical: 30, self: 30, social: 30, outlook: 30 });
  assert.equal(s.idScoreRaw, 120);
  assert.equal(s.idScore, 100);
});

test('all-1 responses → floor: each dim 6, raw 24, normalized 20', () => {
  const s = scoreIdq(fill(1));
  assert.equal(s.idScoreRaw, 24);
  assert.equal(s.idScore, 20);
});

test('dimensions are scored from their own item blocks', () => {
  // physical items 0–5 = 5, everything else = 1
  const r = [5, 5, 5, 5, 5, 5, ...Array.from({ length: 18 }, () => 1)];
  const s = scoreIdq(r);
  assert.equal(s.dimensions.physical, 30);
  assert.equal(s.dimensions.self, 6);
  assert.equal(s.idScoreRaw, 30 + 6 + 6 + 6);
});

test('scoreIdq throws on invalid responses', () => {
  assert.throws(() => scoreIdq(fill(3).slice(0, 23)), /invalid IDQ responses/);
  assert.throws(() => scoreIdq([6, ...fill(3).slice(1)]), /invalid IDQ responses/);
});

test('computeMovement: baseline has null deltas and direction', () => {
  assert.deepEqual(computeMovement(60, null, null), {
    deltaFromBaseline: null,
    deltaFromPrevious: null,
    direction: null,
  });
});

test('computeMovement: direction reflects most-recent change, deltas signed', () => {
  const up = computeMovement(66.67, 60, 63.33);
  assert.equal(up.deltaFromBaseline, 6.67);
  assert.equal(up.deltaFromPrevious, 3.34);
  assert.equal(up.direction, 'up');

  const down = computeMovement(55, 60, 58);
  assert.equal(down.direction, 'down');
  assert.equal(down.deltaFromBaseline, -5);

  const flat = computeMovement(60, 50, 60);
  assert.equal(flat.direction, 'flat');
});
