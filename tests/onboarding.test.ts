import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onboardingNextTurn,
  scriptedTurn,
  collectedToFields,
  nextStage,
  withForwardPrompt,
  resolveCompletion,
  INITIAL_STATE,
  type ConvState,
  type Collected,
} from '../lib/agent/onboarding.ts';

const ctx = { name: 'Tom Miller', email: 'tom@example.com' };
const five = ['a', 'b', 'c', 'd', 'e'];

test('nextStage advances only as each requirement is met, and completes after the Door', () => {
  assert.equal(nextStage({}), 'identity');
  assert.equal(nextStage({ athleticPast: 'x' }), 'identity_name');
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner' }), 'reclaim');
  // fewer than the minimum (3) keeps us at reclaim
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b'] }), 'reclaim');
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'] }), 'door');
  assert.equal(
    nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] }),
    'complete',
  );
});

test('opening turn leads with the verbatim AI disclosure and one question', async () => {
  const t = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  assert.match(t.reply, /^This conversation is guided by AI\./);
  assert.match(t.reply, /who were you/i); // identity-agnostic opening
  assert.match(t.reply, /writer|musician|builder|runner/i); // reclaimed identity is not limited to athletics
  assert.equal((t.reply.match(/\?/g) ?? []).length, 1); // still one question
  assert.equal(t.complete, false);
  assert.equal(t.crisis, undefined);
});

test('a crisis disclosure mid-conversation halts and routes to 988, state unchanged', async () => {
  const state: ConvState = { stage: 'reclaim', collected: { athleticPast: 'cyclist', identityNoun: 'Cyclist' } };
  const t = await onboardingNextTurn({ ctx, state, history: [], memberMessage: "I don't want to be alive" });
  assert.equal(t.crisis, true);
  assert.match(t.reply, /988/);
  assert.equal(t.complete, false);
  assert.deepEqual(t.state, state); // nothing advanced or stored
});

test('full scripted conversation collects every field, in natural case, and completes', () => {
  let s = INITIAL_STATE;
  // Step 1: who they were (stored as athleticPast).
  const past = scriptedTurn(s, 'a competitive cyclist who rode every weekend');
  assert.equal(past.state.stage, 'identity_name');
  assert.equal(past.state.collected.athleticPast, 'a competitive cyclist who rode every weekend');
  s = past.state;

  // Step 1b: name it — natural case, not all-caps.
  const idTurn = scriptedTurn(s, 'athlete, I think');
  assert.equal(idTurn.state.collected.identityNoun, 'Athlete');
  assert.match(idTurn.reply, /The Athlete/); // natural case (capitalized at sentence start)
  assert.doesNotMatch(idTurn.reply, /ATHLETE/); // never all-caps
  s = idTurn.state;

  // too few re-prompts and does not advance
  const short = scriptedTurn(s, 'ride');
  assert.equal(short.state.stage, 'reclaim');
  assert.equal(short.state.collected.reclaimList, undefined);
  assert.match(short.reply, /three is enough to start/i);

  // three is enough now (no forced 7)
  const rc = scriptedTurn(s, 'ride again, sleep well, coach a friend');
  assert.equal(rc.state.stage, 'door');
  assert.equal(rc.state.collected.reclaimList?.length, 3);
  s = rc.state;

  const doorMsg = 'honestly the career cliff, and then my body started saying no';
  const doorTurn = scriptedTurn(s, doorMsg);
  assert.equal(doorTurn.complete, true);
  assert.deepEqual(doorTurn.state.collected.doors, ['career_cliff', 'body']); // multi-Door, canonical order
  assert.equal(doorTurn.state.collected.gap, doorMsg);

  // collected -> fields ready for persistence
  const fields = collectedToFields(ctx, doorTurn.state.collected);
  assert.equal(fields.displayName, 'Tom Miller');
  assert.deepEqual(fields.doors, ['career_cliff', 'body']);
  assert.equal(fields.reclaimList.length, 3);
  assert.equal(fields.identityNoun, 'Athlete');
});

test('completion is gated: the Door cannot complete on the turn it is first captured', () => {
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'] } as Collected;
  const priorNoDoor = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'] } as Collected;

  // Door just captured this turn (prior had none) → cannot complete; held in the door stage.
  const just = resolveCompletion(priorNoDoor, full, true);
  assert.equal(just.complete, false);
  assert.equal(just.stage, 'door');
  assert.equal(just.doorJustCaptured, true);

  // Door was present a turn ago → one more exchange happened → completion honored.
  const later = resolveCompletion(full, full, true);
  assert.equal(later.complete, true);
  assert.equal(later.stage, 'complete');

  // The agent didn't request completion → not complete.
  assert.equal(resolveCompletion(full, full, false).complete, false);
});

test('withForwardPrompt never leaves a non-final turn without a question', () => {
  // A bare reflection (no question) gets the forward question appended.
  const stalled = withForwardPrompt('That stays with you.', 'identity_name');
  assert.match(stalled, /That stays with you\./);
  assert.match(stalled, /\?$/m);
  assert.match(stalled, /what is the word/i);
  // A turn that already asks something is left alone (no double question).
  assert.equal(withForwardPrompt('And what shifted?', 'identity_name'), 'And what shifted?');
  // Empty model output falls back to the stage prompt.
  assert.match(withForwardPrompt('   ', 'reclaim'), /what are a few things you want back/i);
});

test('member names the Door(s) in free text; one or more map; unclear input re-prompts', () => {
  const doorState: ConvState = { stage: 'door', collected: {} };
  assert.deepEqual(scriptedTurn(doorState, 'the empty nest').state.collected.doors, ['empty_nest']);
  assert.deepEqual(scriptedTurn(doorState, 'The Loss').state.collected.doors, ['loss']);
  assert.deepEqual(scriptedTurn(doorState, 'aging parents and the marriage').state.collected.doors, [
    'aging_parents',
    'marriage',
  ]);

  const unclear = scriptedTurn(doorState, 'hard to say really');
  assert.equal(unclear.state.collected.doors, undefined);
  assert.equal(unclear.complete, false);
  assert.match(unclear.reply, /your own words/i);
});
