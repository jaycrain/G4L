import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCoinedIdentity } from '../lib/member/identity.ts';

// Live walk 2026-07-30: offered identity chips, the persona replied with ALL FOUR — "Untamed. Alive. Sovereign.
// Unguarded." — and the whole string became her identity handle, then got read back to her in every sentence for
// the rest of onboarding. The word-count guard missed it because the separators were punctuation, not spaces.
test('a list of candidate words is refused, so we re-prompt instead of labelling them with all of it', () => {
  assert.equal(sanitizeCoinedIdentity('Untamed. Alive. Sovereign. Unguarded.'), null);
  assert.equal(sanitizeCoinedIdentity('Runner, Swimmer, Builder'), null);
  assert.equal(sanitizeCoinedIdentity('Athlete / Maker'), null);
  assert.equal(sanitizeCoinedIdentity('Maker | Mother'), null);
});

test('real coined handles still pass — the guard must not block someone naming themselves', () => {
  assert.equal(sanitizeCoinedIdentity('Untamed'), 'Untamed');
  assert.equal(sanitizeCoinedIdentity('the Stay-At-Home Parent'), 'Stay-At-Home Parent');
  assert.equal(sanitizeCoinedIdentity('Open Water Swimmer'), 'Open Water Swimmer');
  assert.equal(sanitizeCoinedIdentity('  "Wanderer"  '), 'Wanderer');
});
