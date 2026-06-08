import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanIdentityNoun } from '../lib/member/identity.ts';
import { scriptedTurn } from '../lib/agent/onboarding.ts';

test('cleanIdentityNoun strips a leading article (no more "THE THE")', () => {
  assert.equal(cleanIdentityNoun('the writer'), 'writer');
  assert.equal(cleanIdentityNoun('The Writer'), 'Writer');
  assert.equal(cleanIdentityNoun('a musician'), 'musician');
  assert.equal(cleanIdentityNoun('an athlete'), 'athlete');
  assert.equal(cleanIdentityNoun('runner'), 'runner'); // unchanged
  assert.equal(cleanIdentityNoun('  THE  builder '), 'builder');
  assert.equal(cleanIdentityNoun(null), '');
});

test('the identity can be anything, and the scripted path drops the article', () => {
  // member answers "the writer" → noun is WRITER, rendered once as "THE WRITER"
  const t = scriptedTurn({ stage: 'identity', collected: {} }, 'the writer');
  assert.equal(t.state.collected.identityNoun, 'WRITER');
  assert.match(t.reply, /THE WRITER/);
  assert.doesNotMatch(t.reply, /THE THE/);
  // a non-athletic identity works just as well
  assert.equal(scriptedTurn({ stage: 'identity', collected: {} }, 'a musician').state.collected.identityNoun, 'MUSICIAN');
});
