import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onboardingNextTurn,
  scriptedTurn,
  collectedToFields,
  INITIAL_STATE,
  type ConvState,
} from '../lib/agent/onboarding.ts';

const ctx = { name: 'Tom Miller', email: 'tom@example.com' };

test('opening turn leads with the verbatim AI disclosure and one question', async () => {
  const t = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  assert.match(t.reply, /^This conversation is guided by AI\./);
  assert.match(t.reply, /what kind of athlete/i);
  assert.equal(t.complete, false);
  assert.equal(t.crisis, undefined);
});

test('a crisis disclosure mid-conversation halts and routes to 988, state unchanged', async () => {
  const state: ConvState = { stage: 'gap', collected: { athleticPast: 'cyclist' } };
  const t = await onboardingNextTurn({ ctx, state, history: [], memberMessage: "I don't want to be alive" });
  assert.equal(t.crisis, true);
  assert.match(t.reply, /988/);
  assert.equal(t.complete, false);
  assert.deepEqual(t.state, state); // nothing advanced or stored
});

test('full scripted conversation collects every field and completes', () => {
  let s = INITIAL_STATE;
  s = scriptedTurn(s, 'a competitive cyclist who rode every weekend').state;
  assert.equal(s.stage, 'gap');
  s = scriptedTurn(s, 'the role ended and the bike gathered dust').state;
  assert.equal(s.stage, 'right_now');
  s = scriptedTurn(s, 'winded on the stairs, barely recognize myself').state;
  assert.equal(s.stage, 'identity');

  const idTurn = scriptedTurn(s, 'athlete, I think');
  assert.equal(idTurn.state.collected.identityNoun, 'ATHLETE'); // first word, uppercased
  assert.match(idTurn.reply, /THE ATHLETE/);
  s = idTurn.state;

  // wrong count re-prompts and does not advance
  const short = scriptedTurn(s, 'ride, sleep, coach');
  assert.equal(short.state.stage, 'reclaim');
  assert.equal(short.state.collected.reclaimList, undefined);
  assert.match(short.reply, /exactly 7/);

  s = scriptedTurn(s, 'ride again, sleep well, coach a friend, climb, reconnect with Dana, race Moab, feel strong').state;
  assert.equal(s.stage, 'door');
  assert.equal(s.collected.reclaimList?.length, 7);

  const doorTurn = scriptedTurn(s, 'The Career Cliff'); // member picks explicitly
  assert.equal(doorTurn.complete, true);
  assert.equal(doorTurn.state.collected.door, 'career_cliff');

  // collected -> fields ready for persistence
  const fields = collectedToFields(ctx, doorTurn.state.collected);
  assert.equal(fields.displayName, 'Tom Miller');
  assert.equal(fields.door, 'career_cliff');
  assert.equal(fields.reclaimList.length, 7);
  assert.equal(fields.identityNoun, 'ATHLETE');
});

test('member picks the Door by number or name; unclear input re-prompts', () => {
  const doorState: ConvState = { stage: 'door', collected: {} };
  assert.equal(scriptedTurn(doorState, '3').state.collected.door, 'empty_nest'); // by number
  assert.equal(scriptedTurn(doorState, 'The Loss').state.collected.door, 'loss'); // by full name
  assert.equal(scriptedTurn(doorState, 'aging parents').state.collected.door, 'aging_parents'); // by short name

  const unclear = scriptedTurn(doorState, 'hard to say really');
  assert.equal(unclear.state.collected.door, undefined);
  assert.equal(unclear.complete, false);
  assert.match(unclear.reply, /didn't catch/i);
});
