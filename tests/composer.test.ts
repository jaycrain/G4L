// The composer and the continue button are two views of one state.
//
// Donna, 2026-08-20 (Rebuild, after the assessments): the Companion said "That's the read. Hold on — let me show
// you what you just built," and the screen offered BOTH an empty reply field with a Send button AND "See where
// that landed →". No question had been asked. A blank box where nothing was asked reads as a second way forward
// that isn't one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showComposer } from '../lib/chat/composer.ts';

test('a plain conversational turn gets the text box', () => {
  assert.equal(showComposer(false, false), true);
});

test('an administered turn does not — the chips ARE the input', () => {
  assert.equal(showComposer(true, false), false);
});

test('a beat waiting on Continue does not — the tap is the only way forward', () => {
  // The case that shipped. It is the whole reason this function exists.
  assert.equal(showComposer(false, true), false);
});

test('and never both at once, whichever way the state arrives', () => {
  assert.equal(showComposer(true, true), false);
});
