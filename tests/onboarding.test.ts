import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onboardingNextTurn,
  scriptedTurn,
  collectedToFields,
  nextStage,
  withForwardPrompt,
  resolveCompletion,
  isAffirmation,
  isDoorDispute,
  doorEngaged,
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

test('completion is gated on BOTH sides: explore first, then close reliably', () => {
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'] } as Collected;
  const partial = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'] } as Collected;

  // Under the exploration minimum → cannot complete; held in the door beat (even if the model asks).
  const just = resolveCompletion(full, true, 1);
  assert.equal(just.complete, false);
  assert.equal(just.stage, 'door');
  assert.equal(just.exploringDoor, true);
  assert.equal(resolveCompletion(full, true, 2).complete, false);

  // Explored enough + the model signals completion → done.
  const byModel = resolveCompletion(full, true, 3);
  assert.equal(byModel.complete, true);
  assert.equal(byModel.stage, 'complete');

  // Explored enough + the MEMBER affirms the read (model didn't set complete) → done. (The "It does" fix.)
  assert.equal(resolveCompletion(full, false, 4, true).complete, true);
  // Affirmation before the beat has breathed does NOT complete.
  assert.equal(resolveCompletion(full, false, 2, true).complete, false);

  // Soft cap: even with no model/member signal, it must wrap by DOOR_MAX_TURNS (can't run forever).
  assert.equal(resolveCompletion(full, false, 6).complete, true);
  // ...but never before requirements are met (missing a Door keeps it out of the door beat entirely).
  assert.equal(resolveCompletion(partial, true, 9).complete, false);
});

test('a Door dispute reopens the beat — never wraps, even past the soft cap or when the model says complete', () => {
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'] } as Collected;
  // Member is pushing back ⇒ blocked=true ⇒ cannot complete (model-signaled, affirmed, OR soft-cap).
  assert.equal(resolveCompletion(full, true, 3, false, true).complete, false);
  assert.equal(resolveCompletion(full, false, 6, false, true).complete, false);
  // It stays in the door beat to re-map, not stranded.
  assert.equal(resolveCompletion(full, true, 3, false, true).stage, 'door');
});

test('isDoorDispute catches real pushback (incl. Scott\'s line) but not an affirmation', () => {
  for (const d of ["What do you mean by Aging Parents and Empty Nest?", "those don't seem like the problem", "that's not it", "no, that wasn't what happened", "I wouldn't call it that"]) {
    assert.equal(isDoorDispute(d), true, `dispute: "${d}"`);
  }
  assert.equal(isDoorDispute('yes, that\'s right'), false);
  assert.equal(isDoorDispute('the body, and the career cliff too'), false);
});

test('door turns are counted only once the gap/Door is on the table (not when the Reclaim List just filled)', () => {
  // Reclaim just hit the minimum; no gap, no door yet → NOT a door turn (the beat hasn\'t begun).
  assert.equal(doorEngaged({ reclaimList: ['a', 'b', 'c'] } as Collected, { reclaimList: ['a', 'b', 'c'] } as Collected), false);
  // The member just told us how the gap opened → now we\'re engaging the Door beat.
  assert.equal(doorEngaged({} as Collected, { gap: 'when I got married then had kids' } as Collected), true);
  // A Door already captured earlier → still engaging on the next turn.
  assert.equal(doorEngaged({ doors: ['career_cliff'] } as Collected, {} as Collected), true);
});

test('isAffirmation recognizes short confirmations (incl. "for sure"), not longer add-ons', () => {
  for (const yes of ['For sure', 'yes', 'that’s right', 'exactly', 'you got it', 'pretty much', 'sounds about right', 'absolutely']) {
    assert.equal(isAffirmation(yes), true, `expected affirmation: "${yes}"`);
  }
  // long messages aren't treated as a wrap signal, even if they contain an affirming word
  assert.equal(isAffirmation('yes, and also my finances really started to pile on around then too'), false);
  assert.equal(isAffirmation('not really, there was more to it'), false);
  assert.equal(isAffirmation(''), false);
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

test('identity opt-out: "I\'m not sure yet" skips naming, still completes', () => {
  // scripted decline at the naming step → identitySkipped, advances to reclaim, no identityNoun
  const afterPast = scriptedTurn({ stage: 'identity', collected: {} }, 'someone who rode every dawn');
  assert.equal(afterPast.state.stage, 'identity_name');
  const declined = scriptedTurn(afterPast.state, "honestly, I'm not sure yet");
  assert.equal(declined.state.collected.identitySkipped, true);
  assert.equal(declined.state.collected.identityNoun, undefined);
  assert.equal(declined.state.stage, 'reclaim');

  // nextStage doesn't loop on naming once skipped
  assert.equal(nextStage({ athleticPast: 'x', identitySkipped: true }), 'reclaim');

  // completion gate is satisfied by identitySkipped in place of identityNoun
  const five = ['a', 'b', 'c', 'd', 'e'];
  const skipped = { athleticPast: 'x', identitySkipped: true, reclaimList: five, doors: ['career_cliff'] as const };
  assert.equal(resolveCompletion(skipped as never, true, 3).complete, true);
  // and a named member still completes the same way
  const named = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] as const };
  assert.equal(resolveCompletion(named as never, true, 3).complete, true);
});
