import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReclaimItems } from '../lib/agent/onboarding-staged.ts';

// Decision II follow-on (Donna's numbered-entry): the engine — not the fuzzy model — splits a member's reclaim
// message into distinct wants when they gave explicit list structure. These fixtures are the exact shapes that
// stalled real walks (Marcus/Donna/milie): a numbered/bulleted dump that used to land as ONE run-on item and then
// made the multiwant gate loop. Pure function → cheap, deterministic regression guard.

test('numbered dump splits into distinct items', () => {
  assert.deepEqual(
    parseReclaimItems('1. Get back on real trails 2. Get strong again 3. Sleep through the night'),
    ['Get back on real trails', 'Get strong again', 'Sleep through the night'],
  );
});

test('drops a leading preamble before the first number (Donna: "For my list please state…")', () => {
  assert.deepEqual(
    parseReclaimItems('For my list please state 1. Lose 20 lbs. 2. Go to yoga 4x a week 3. Ride my bike in place of driving'),
    ['Lose 20 lbs.', 'Go to yoga 4x a week', 'Ride my bike in place of driving'],
  );
});

test('one-per-line numbered entry splits', () => {
  assert.deepEqual(
    parseReclaimItems('1. Ride again\n2. Sleep well\n3. Coach a friend'),
    ['Ride again', 'Sleep well', 'Coach a friend'],
  );
});

test('bulleted list splits', () => {
  assert.deepEqual(parseReclaimItems('- Run a 5k\n- Cook again\n- Call mom weekly'), ['Run a 5k', 'Cook again', 'Call mom weekly']);
});

test('numbered variants: parens and colons', () => {
  assert.deepEqual(parseReclaimItems('1) Climb again 2) Lose the gut'), ['Climb again', 'Lose the gut']);
});

test('plain prose is a SINGLE item — never guess-split on "and"/commas', () => {
  // A false split ("sleep well and feel strong" → two) is worse than one item the shape gate can still catch.
  assert.deepEqual(parseReclaimItems('I want to sleep well and feel strong again'), ['I want to sleep well and feel strong again']);
});

test('a single numbered item is still just that item (no phantom empties)', () => {
  assert.deepEqual(parseReclaimItems('1. Get back on real trails'), ['Get back on real trails']);
});

test('empty / whitespace → no items', () => {
  assert.deepEqual(parseReclaimItems('   '), []);
  assert.deepEqual(parseReclaimItems(''), []);
});

test('a mid-sentence number is NOT treated as a marker (needs ≥2 markers)', () => {
  // "lose 20 lbs" has a number but no list structure — stays one item.
  assert.deepEqual(parseReclaimItems('Lose 20 lbs and get back to the gym'), ['Lose 20 lbs and get back to the gym']);
});
