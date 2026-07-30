import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRevisionTail } from '../lib/agent/onboarding-intent.ts';

// CAT-34 — "yes, BUT…". Every propose→confirm predicate in the arcs is ^-anchored on the leading token, so
// "yes, but make it twice a week" matched `^yes\b`, committed the UN-TWEAKED artifact, and silently dropped the
// member's change. Fourth instance of the root pattern: a guess about the message outranking what they said.
//
// This guard has to cut BOTH ways. Miss a revision → we drop their change (the original bug). Over-fire on a warm
// confirm → we trap them in an adjust loop, which is its own failure. Both directions are locked here.

test('REVISION detected — an affirmation carrying a change request is NOT a plain confirm', () => {
  const revisions = [
    'yes, but make it twice a week',
    'yeah but can we do Tuesdays instead',
    'sure, though I would rather start at 6',
    'ok but change the second one',
    'yes — one thing, drop the third item',
    'that works, except I want to swap the last one',
    'perfect, but could you shorten it',
    'yes, I would prefer three days instead of five',
    'good, but add walking to that',
    'yeah, take out the part about mornings',
  ];
  for (const m of revisions) assert.equal(hasRevisionTail(m), true, `must read as a REVISION: "${m}"`);
});

test('NOT a revision — warm confirms still confirm (never trap them in an adjust loop)', () => {
  const confirms = [
    'yes',
    'yes, that is perfect',
    'yeah exactly right',
    'that works',
    'perfect, thank you',
    'yes but that is fine', // a contrast word with no substance after it
    'lock it in',
    'yes please',
    'sounds good to me',
    'that is it exactly',
  ];
  for (const m of confirms) assert.equal(hasRevisionTail(m), false, `must still CONFIRM: "${m}"`);
});

test('a genuine free-text line containing "but" is not mistaken for a revision request', () => {
  // At W3 the member's free text IS the payload — their real line often contains a contrast.
  // (W3 additionally requires an affirmation before the guard applies; this proves the primitive alone is sane.)
  assert.equal(hasRevisionTail('I am not broken, I am just tired'), false);
  assert.equal(hasRevisionTail(''), false);
});
