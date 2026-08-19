// "The beginning of the Why This Matters content is cut off above the visible screen area — roughly 75% of the
// time" (Donna, 2026-08-19). The autoscroll anchored the OPENER bubble to the top of the view, and the framing
// card renders above that bubble, so anchoring pushed it off-screen. The 75% was the browser clamping a scroll it
// could not perform on a short thread — same code, two outcomes, by height.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseScrollTarget } from '../lib/teaching/scroll-target.ts';

test('THE BUG: on arrival the thread stays at the TOP, so the framing card is not scrolled past', () => {
  assert.deepEqual(chooseScrollTarget(['agent']), { kind: 'top' });
});

test('...and still at the top when the opener is several bubbles (a reflection split from its question)', () => {
  // BEAT_SEP splits one turn into two bubbles. Neither is a reason to scroll past what sits above them.
  assert.deepEqual(chooseScrollTarget(['agent', 'agent']), { kind: 'top' });
});

test('once the member has spoken, a fresh agent turn is anchored so it reads top-down', () => {
  // The behaviour walk #12 asked for, and it must survive this fix.
  assert.deepEqual(chooseScrollTarget(['agent', 'member', 'agent']), { kind: 'anchor', index: 2 });
});

test('the anchor is the FIRST bubble of the newest turn, not the last', () => {
  // A turn can be several bubbles; anchoring the last one is the original "pinned to the bottom" bug.
  assert.deepEqual(chooseScrollTarget(['agent', 'member', 'agent', 'agent', 'agent']), { kind: 'anchor', index: 2 });
});

test('the member just spoke and the reply is pending → follow to the bottom', () => {
  assert.deepEqual(chooseScrollTarget(['agent', 'member']), { kind: 'bottom' });
});

test('later in a long thread, only the newest turn matters', () => {
  const roles = ['agent', 'member', 'agent', 'member', 'agent', 'agent'] as const;
  assert.deepEqual(chooseScrollTarget(roles), { kind: 'anchor', index: 4 });
});

test('an empty thread does not crash', () => {
  assert.deepEqual(chooseScrollTarget([]), { kind: 'top' });
});
