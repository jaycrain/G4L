import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanIdentityNoun, displayIdentityNoun, identityLabel } from '../lib/member/identity.ts';
import { scriptedTurn } from '../lib/agent/onboarding.ts';

test('cleanIdentityNoun strips a leading article (no more "the the")', () => {
  assert.equal(cleanIdentityNoun('the writer'), 'writer');
  assert.equal(cleanIdentityNoun('The Writer'), 'Writer');
  assert.equal(cleanIdentityNoun('a musician'), 'musician');
  assert.equal(cleanIdentityNoun('an athlete'), 'athlete');
  assert.equal(cleanIdentityNoun('runner'), 'runner'); // unchanged
  assert.equal(cleanIdentityNoun('  THE  builder '), 'builder');
  assert.equal(cleanIdentityNoun(null), '');
});

test('displayIdentityNoun renders natural case (never all-caps), incl. legacy rows', () => {
  assert.equal(displayIdentityNoun('the athlete'), 'Athlete');
  assert.equal(displayIdentityNoun('ATHLETE'), 'Athlete'); // legacy uppercase normalizes
  assert.equal(displayIdentityNoun('runner'), 'Runner');
  assert.equal(displayIdentityNoun('stay-at-home'), 'Stay-At-Home');
  assert.equal(displayIdentityNoun(null), '');
});

test('identityLabel prefixes a lowercase article', () => {
  assert.equal(identityLabel('athlete'), 'the Athlete');
  assert.equal(identityLabel('THE WRITER'), 'the Writer');
  assert.equal(identityLabel(''), '');
});

test('the identity can be anything; the scripted naming step renders natural case', () => {
  // member names it "the writer" → noun is Writer, rendered as "the Writer"
  const t = scriptedTurn({ stage: 'identity_name', collected: {} }, 'the writer');
  assert.equal(t.state.collected.identityNoun, 'Writer');
  assert.match(t.reply, /The Writer/); // natural case (capitalized at sentence start)
  assert.doesNotMatch(t.reply, /WRITER/); // never all-caps
  assert.doesNotMatch(t.reply, /the the/i);
  // a non-athletic identity works just as well
  assert.equal(
    scriptedTurn({ stage: 'identity_name', collected: {} }, 'a musician').state.collected.identityNoun,
    'Musician',
  );
});
