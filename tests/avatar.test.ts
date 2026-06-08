import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstName, initials } from '../lib/member/avatar.ts';

test('firstName takes the first real name token', () => {
  assert.equal(firstName('Tom Miller'), 'Tom');
  assert.equal(firstName('Reshma'), 'Reshma');
  assert.equal(firstName('Demo — Maria'), 'Demo'); // demo naming; real members use real names
});

test('initials are one or two letters, uppercased', () => {
  assert.equal(initials('Tom Miller'), 'TM');
  assert.equal(initials('Reshma'), 'R');
  assert.equal(initials('Demo — Maria'), 'DM'); // the em dash is skipped, not counted
  assert.equal(initials('greg welk'), 'GW');
});

test('avatar helpers never throw on empty input', () => {
  assert.equal(initials(''), '?');
  assert.equal(firstName(''), '');
});
