import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringStyle } from '../app/dashboard/journey-rings-style.ts';

test('a finished R stays darkened (full opacity) — reinforcing completion', () => {
  assert.equal(ringStyle('done').opacity, 1);
});

test('the current R is darkened and a touch thicker (you are here)', () => {
  const cur = ringStyle('current');
  assert.equal(cur.opacity, 1);
  assert.ok(cur.strokeWidth > ringStyle('done').strokeWidth);
});

test('an R still ahead sits dimmed', () => {
  assert.ok(ringStyle('ahead').opacity < 1);
});
