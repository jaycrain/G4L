// The tap that replaces the guess at a drawout confirm. See lib/agent/beat-confirm.ts for why this exists —
// Jay answered "Absolutely" and was asked the same question again, because the MODEL asked the first one and the
// engine never knew a confirm was outstanding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAT_CONFIRM_CHOICES,
  serializeBeatConfirm,
  parseBeatConfirm,
  beatConfirmDisplay,
} from '../lib/agent/beat-confirm.ts';

test('a tap round-trips to the intent the engine already routes on', () => {
  for (const c of BEAT_CONFIRM_CHOICES) {
    assert.equal(parseBeatConfirm(serializeBeatConfirm(c.value)), c.value);
  }
});

test('"There’s more" LEADS — a drawout beat must never read as moving the member along', () => {
  assert.equal(BEAT_CONFIRM_CHOICES[0]?.value, 'addition');
  // Correcting us has to look as available as agreeing, so dispute is last but present.
  assert.ok(BEAT_CONFIRM_CHOICES.some((c) => c.value === 'dispute'));
});

test('PROSE IS NEVER READ AS A TAP — the mirror of the bug this replaces', () => {
  // Reading a typed word as a button press would put a decision the member never made onto the beat that closes
  // their story. Everything typed falls through to the classifier untouched.
  for (const typed of ['more', 'There’s more', 'done', 'that’s it', 'Absolutely', '', '   ']) {
    assert.equal(parseBeatConfirm(typed), null, `typed prose must not parse as a tap: ${typed}`);
  }
});

test('a malformed or unknown tap is refused, never guessed at', () => {
  assert.equal(parseBeatConfirm('[beat-confirm] maybe'), null);
  assert.equal(parseBeatConfirm('[beat-confirm]'), null);
  assert.equal(parseBeatConfirm('[beat-confirm] DONE'), null, 'case-exact — a near-miss is not a decision');
});

test('the member sees their own words, never the wire string', () => {
  assert.equal(beatConfirmDisplay(serializeBeatConfirm('done')), 'That’s it');
  assert.equal(beatConfirmDisplay('I think that covers it'), null, 'prose displays as itself');
  // The fourth wire-leak instance put "[gap-confirm] more keep:grind" into Jay's permanent record. No new marker
  // ships without its display rule.
  assert.ok(!(beatConfirmDisplay(serializeBeatConfirm('addition')) ?? '').includes('[beat-confirm]'));
});
