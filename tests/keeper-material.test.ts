// A KEEPER is the member's own material about their life. It is not their reaction to our reflection.
//
// The draw-out advances on the turn where the reflection lands — which is exactly the turn a member is most likely
// to say "Perfectly depicted!" or "yes, that's it". Taking that turn's message wholesale wrote those two words into
// the Playbook under "The drift": a keeper that tells them nothing about themselves, and that the Companion will
// later recall back to them as if it were their own account. Greg hit it, then Jennifer hit it — same shape twice,
// so the predicate gets fixed rather than the instance.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isKeeperMaterial } from '../lib/agent/reconnect.ts';

test('praise for the reflection is NOT keeper material', () => {
  for (const reaction of [
    'Perfectly depicted!',          // Jennifer's, verbatim — the two words that became her drift keeper
    'Perfect',
    'Exactly',
    'That is exactly right',
    'Yes, that\'s it',
    'Spot on',
    'Beautifully said',
    'Well put',
    'That captured it',
    'yes',
    'ok',
  ]) {
    assert.equal(isKeeperMaterial(reaction), false, `"${reaction}" is agreement, not their story`);
  }
});

test('a real drift declaration IS keeper material', () => {
  for (const declaration of [
    'I stopped running the year my father got sick and never started again',
    'I just kept saying yes to work until there was nothing left over for me',
    'Every time something had to give it was always my own thing that gave',
    'The weekends went first, then the mornings, and I barely noticed',
  ]) {
    assert.equal(isKeeperMaterial(declaration), true, `"${declaration}" is their own account — keep it`);
  }
});

test('empty and whitespace are not material', () => {
  assert.equal(isKeeperMaterial(''), false);
  assert.equal(isKeeperMaterial('   '), false);
  assert.equal(isKeeperMaterial(undefined as unknown as string), false);
});

test('a short but SUBSTANTIVE line still counts once it says something', () => {
  // The floor is a blunt instrument, so make sure it isn't swallowing real material a member phrased tersely.
  assert.equal(isKeeperMaterial('I gave up cycling after the second surgery'), true);
});
