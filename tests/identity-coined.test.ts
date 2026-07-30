import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCoinedIdentity } from '../lib/member/identity.ts';

// A punctuation guard lived here briefly on 2026-07-30 and was REVERTED the same evening: it addressed a harness
// artifact (the persona TYPES chip words back; a real member taps and can't), and rejecting more inputs is what
// dropped the walk into CAT-54's re-prompt loop. What remains is the pre-existing sanitiser. These tests pin the
// half that matters either way — it must never block someone naming themselves.
test('real coined handles pass — the sanitiser must not block someone naming themselves', () => {
  assert.equal(sanitizeCoinedIdentity('Untamed'), 'Untamed');
  assert.equal(sanitizeCoinedIdentity('the Stay-At-Home Parent'), 'Stay-At-Home Parent');
  assert.equal(sanitizeCoinedIdentity('Open Water Swimmer'), 'Open Water Swimmer');
  assert.equal(sanitizeCoinedIdentity('  "Wanderer"  '), 'Wanderer');
});
