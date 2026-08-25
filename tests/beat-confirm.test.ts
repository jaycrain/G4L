// The tap that replaces the guess at a drawout confirm. See lib/agent/beat-confirm.ts for why this exists —
// Jay answered "Absolutely" and was asked the same question again, because the MODEL asked the first one and the
// engine never knew a confirm was outstanding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAT_CONFIRM_CHOICES,
  beatConfirmChoices,
  serializeBeatConfirm,
  parseBeatConfirm,
  parseBeatConfirmSet,
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

// ── THE LEGACY LETTER'S OWN SET ───────────────────────────────────────────────────────────────────────────────

test('the letter offers TWO choices, because "more" and "wrong" are one act on a draft', () => {
  const legacy = beatConfirmChoices('legacy');
  assert.equal(legacy.length, 2);
  assert.deepEqual(legacy.map((c) => c.value).sort(), ['addition', 'done']);
});

test('"That’s mine", never "That’s it" — the letter beat must not ask whether it is GOOD', () => {
  // LEGACY_ASK_REVISION's rule: an appraisal question "invites a polite yes on the one artifact that has to be
  // theirs." Reusing the default set's wording here would reintroduce exactly that.
  const done = beatConfirmChoices('legacy').find((c) => c.value === 'done')!;
  assert.equal(done.label, 'That’s mine');
  assert.notEqual(done.label, beatConfirmChoices('default').find((c) => c.value === 'done')!.label);
});

test('a tap carries its SET, so the bubble shows the words that were on the button', () => {
  const tap = serializeBeatConfirm('done', 'legacy');
  assert.equal(parseBeatConfirm(tap), 'done', 'the intent still resolves');
  assert.equal(parseBeatConfirmSet(tap), 'legacy');
  // Without the set, a member who tapped "That’s mine" on their own letter would be shown "That’s it" — an
  // appraisal where they made a statement of ownership.
  assert.equal(beatConfirmDisplay(tap), 'That’s mine');
  assert.equal(beatConfirmDisplay(serializeBeatConfirm('done')), 'That’s it');
});

test('an unknown set degrades to the default rather than leaking the wire string', () => {
  const odd = '[beat-confirm] done set:nonesuch';
  assert.equal(parseBeatConfirm(odd), 'done');
  assert.equal(parseBeatConfirmSet(odd), 'default');
  assert.equal(beatConfirmDisplay(odd), 'That’s it');
});
