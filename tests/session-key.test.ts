import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionKey, chatDispatch, keyFromForecast } from '../lib/workspace/session-key.ts';

// Redesign Layer 3: the workspace key crosswalk. isSessionKey guards the route; chatDispatch picks the arc + session
// prop for the rail's chat client; keyFromForecast maps the member's lit step to a workspace key (or null → legacy route).

test('isSessionKey guards the route to known sessions only', () => {
  assert.ok(isSessionKey('r1'));
  assert.ok(isSessionKey('w2'));
  assert.ok(isSessionKey('rewire-checkpoint'));
  assert.ok(isSessionKey('c4'));
  assert.ok(!isSessionKey('nope'));
  assert.ok(!isSessionKey('w9'));
});

test('chatDispatch routes each key to the right arc + chat-session prop', () => {
  // RECONNECT IS FOUR SESSIONS NOW (2026-08-28) — it was one key for one 65-minute arc, which is why it alone
  // had no session prop. r4 is the checkpoint, mapping to the client's shared 'checkpoint' token.
  assert.deepEqual(chatDispatch('r1'), { arc: 'reconnect', session: 'r1' });
  assert.deepEqual(chatDispatch('r2'), { arc: 'reconnect', session: 'r2' });
  assert.deepEqual(chatDispatch('r3'), { arc: 'reconnect', session: 'r3' });
  assert.deepEqual(chatDispatch('r4'), { arc: 'reconnect', session: 'checkpoint' });
  // THE PREFIX TRAP: 'rewire-checkpoint' also begins with 'r'. Pinned because a prefix test for Reconnect
  // silently routed it into the wrong arc.
  assert.deepEqual(chatDispatch('rewire-checkpoint'), { arc: 'rewire', session: 'checkpoint' });
  assert.deepEqual(chatDispatch('w1'), { arc: 'rewire', session: 'w1' });
  assert.deepEqual(chatDispatch('rewire-checkpoint'), { arc: 'rewire', session: 'checkpoint' });
  assert.deepEqual(chatDispatch('b3'), { arc: 'rebuild', session: 'b3' });
  assert.deepEqual(chatDispatch('b4'), { arc: 'rebuild', session: 'checkpoint' });
  assert.deepEqual(chatDispatch('c1'), { arc: 'reclaim', session: 'c1' });
  assert.deepEqual(chatDispatch('c4'), { arc: 'reclaim', session: 'checkpoint' });
});

test('keyFromForecast — reconnect resolves to the lit SESSION, not the whole arc', () => {
  // It used to return the single 'reconnect' key for anything in the phase, because the phase WAS one session.
  assert.equal(keyFromForecast('reconnect', { id: 'RCN-FDR', kind: 'session' }), 'r2', 'the Doors');
  assert.equal(keyFromForecast('reconnect', { id: 'RCN-DFT', kind: 'session' }), 'r3', 'the Drift Quiz');
  assert.equal(keyFromForecast('reconnect', { route: '/workspace/{memberId}/r4' }), 'r4', 'the checkpoint');
  // NO SIGNAL MEANS NOT STARTED, and starting Reconnect means the mirror — r1 is the phase's first Session.
  assert.equal(keyFromForecast('reconnect', null), 'r1');
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
