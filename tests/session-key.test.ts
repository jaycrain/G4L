import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionKey, chatDispatch, keyFromForecast } from '../lib/workspace/session-key.ts';

// Redesign Layer 3: the workspace key crosswalk. isSessionKey guards the route; chatDispatch picks the arc + session
// prop for the rail's chat client; keyFromForecast maps the member's lit step to a workspace key (or null → legacy route).

test('isSessionKey guards the route to known sessions only', () => {
  assert.ok(isSessionKey('reconnect'));
  assert.ok(isSessionKey('w2'));
  assert.ok(isSessionKey('rewire-checkpoint'));
  assert.ok(isSessionKey('c4'));
  assert.ok(!isSessionKey('nope'));
  assert.ok(!isSessionKey('w9'));
});

test('chatDispatch routes each key to the right arc + chat-session prop', () => {
  assert.deepEqual(chatDispatch('reconnect'), { arc: 'reconnect' });
  assert.deepEqual(chatDispatch('w1'), { arc: 'rewire', session: 'w1' });
  assert.deepEqual(chatDispatch('rewire-checkpoint'), { arc: 'rewire', session: 'checkpoint' });
  assert.deepEqual(chatDispatch('b3'), { arc: 'rebuild', session: 'b3' });
  assert.deepEqual(chatDispatch('b4'), { arc: 'rebuild', session: 'checkpoint' });
  assert.deepEqual(chatDispatch('c1'), { arc: 'reclaim', session: 'c1' });
  assert.deepEqual(chatDispatch('c4'), { arc: 'reclaim', session: 'checkpoint' });
});

test('keyFromForecast — reconnect is the whole gateway arc', () => {
  assert.equal(keyFromForecast('reconnect', { id: 'RCN-EXC', kind: 'session' }), 'reconnect');
  assert.equal(keyFromForecast('reconnect', null), 'reconnect');
});

test('keyFromForecast — parses the session token from the route or id', () => {
  assert.equal(keyFromForecast('rewire', { route: '/rewire/{memberId}/w2' }), 'w2');
  assert.equal(keyFromForecast('rebuild', { id: 'b1', route: '/rebuild/{memberId}/b1' }), 'b1');
  assert.equal(keyFromForecast('reclaim', { route: '/reclaim/{memberId}/c3' }), 'c3');
});

test('keyFromForecast — a phase checkpoint maps to that phase’s checkpoint key', () => {
  assert.equal(keyFromForecast('rewire', { route: '/rewire/{memberId}/checkpoint' }), 'rewire-checkpoint');
  assert.equal(keyFromForecast('rebuild', { route: '/rebuild/{memberId}/checkpoint' }), 'b4');
  assert.equal(keyFromForecast('reclaim', { route: '/reclaim/{memberId}/checkpoint' }), 'c4');
});

test('keyFromForecast — returns null when it cannot confidently map (caller keeps the legacy route)', () => {
  assert.equal(keyFromForecast('rewire', { id: 'RWR-SOMETHING', kind: 'session' }), null);
  assert.equal(keyFromForecast('rebuild', null), null);
});
