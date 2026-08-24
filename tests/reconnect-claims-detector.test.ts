// WHAT THE MODEL CLAIMS IN RECONNECT — measured before it is gated.
//
// Reconnect is the first arc a new member meets and has never had a claims gate; claimsGateOutcome was wired into
// onboarding only. Donna hit the gap on 2026-08-22 (item 12): two beats before the engine opens the Legacy
// Letter, the model announced it. This detector reports; it does not yet block. These tests pin BOTH halves —
// that it catches her real case, and that it leaves the ordinary conversation alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectReconnectClaims } from '../lib/agent/gate-claims.ts';

test('it catches Donna\'s actual line, verbatim from her walk', () => {
  const hers = 'Let me put all of it into your own words — a letter from you, to you. Give me a moment.';
  assert.deepEqual(detectReconnectClaims(hers), ['legacy_letter_early']);
});

test('it catches the other three families', () => {
  assert.deepEqual(detectReconnectClaims('Your baseline ID Score is 59.'), ['id_score']);
  assert.deepEqual(detectReconnectClaims('Your Doors are saved.'), ['doors_saved']);
  assert.deepEqual(detectReconnectClaims("That's Reconnect done."), ['arc_done']);
});

// THE EXPENSIVE HALF. Casting wider than the claim silences the conversation these beats exist to have — the
// Companion must be free to talk ABOUT the letter, the score and the Doors without tripping anything.
test('ordinary Reconnect conversation is NOT flagged', () => {
  for (const ok of [
    'In a little while I\'ll ask you to write a letter to yourself — but not yet.',
    'The ID Score is how we measure the distance. You\'ll take twelve questions in a moment.',
    'Which of these Doors feel like yours? Nothing is recorded until you mark them.',
    'That Tuesday — that\'s the spark. Hold onto it.',
    'Take me back to how it actually went.',
    'Your Doors say a lot about where the distance opened.',
  ]) {
    assert.deepEqual(detectReconnectClaims(ok), [], `false positive on: "${ok}"`);
  }
});

test('a provisional hedge withdraws the claim', () => {
  // Same rule as claimsGateOutcome: the hedge must FOLLOW the phrase, so a qualifier elsewhere cannot excuse it.
  assert.deepEqual(detectReconnectClaims('Your Doors are set, for now — you can change them on the board.'), []);
});

test('an empty or whitespace turn reports nothing', () => {
  assert.deepEqual(detectReconnectClaims(''), []);
  assert.deepEqual(detectReconnectClaims('   '), []);
});

// IT IS WIRED, AND IT IS REPORT-ONLY.
//
// The detector is worth nothing sitting in a module nobody calls — that is exactly how Reconnect went without a
// gate for three days after one was built for onboarding. And it must never alter a turn: this ships dark.
test('the Reconnect turn logs claims, and cannot change the reply', () => {
  const src = readFileSync('app/reconnect/actions.ts', 'utf8');
  assert.match(src, /logReconnectClaims\(memberId, state\.stage, turn\.reply\)/, 'not called on the live turn');
  assert.match(src, /RECONNECT_CLAIM/, 'no greppable marker to measure with');

  // Report-only: the helper returns void and the reply is never reassigned from it.
  assert.match(src, /function logReconnectClaims\([^)]*\): void/, 'the logger must return void');
  assert.doesNotMatch(src, /turn\.reply\s*=\s*[^;]*logReconnectClaims/, 'the logger must not rewrite the reply');
  assert.doesNotMatch(src, /=\s*logReconnectClaims\(/, 'its result must not be used for anything');

  // The member's own prose must never reach a log line.
  const body = src.slice(src.indexOf('function logReconnectClaims'), src.indexOf('async function persistLegacyLetter'));
  assert.doesNotMatch(body, /\$\{reply\}|\$\{message\}/, 'a member transcript was about to be written to the logs');
});
