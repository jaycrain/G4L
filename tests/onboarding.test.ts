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
  memberWantsToWrap,
  confirmsWhole,
  doorEngaged,
  augmentDoors,
  ensureIdqHandoff,
  stripLeadingDisclosure,
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
  // A Door slug WITHOUT the fade story isn't a finished beat — stays in 'door' to draw out the gap.
  assert.equal(
    nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] }),
    'door',
  );
  // Door + a real "how it opened" narrative → complete.
  assert.equal(
    nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped' }),
    'complete',
  );
});

test('opening turn opens on the Getting-to-Know-You question (disclosure now lives on the start page)', async () => {
  const t = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  assert.doesNotMatch(t.reply, /guided by AI/); // the AI disclosure is woven into the start page, not repeated here
  assert.match(t.reply, /who were you/i); // identity-agnostic opening
  assert.match(t.reply, /writer|musician|builder|runner/i); // reclaimed identity is not limited to athletics
  assert.equal((t.reply.match(/\?/g) ?? []).length, 1); // still exactly one question
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
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped' } as Collected;
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

test('the member ending the beat wraps it — even below the explore-minimum (Independence Guarantee)', () => {
  const full = { athleticPast: 'x', identityNoun: 'Adventurer', reclaimList: ['a', 'b', 'c'], doors: ['body'], gap: 'my body started saying no and I slowly pulled back from the climbs' } as Collected;
  // "I'm done" on door turn 1 (below the 3-turn floor) still completes — the member's call to stop wins.
  assert.equal(resolveCompletion(full, false, 1, false, false, true).complete, true);
  // but a dispute still holds even if they sound done-ish (blocked overrides memberDone)
  assert.equal(resolveCompletion(full, false, 1, false, true, true).complete, false);
  // without the done signal, turn 1 still holds for exploration
  assert.equal(resolveCompletion(full, false, 1, false, false, false).complete, false);
});

test('confirmsWhole reads a soft close to the widen question (Scott: "the biggest contributors")', () => {
  for (const m of ['Those are the biggest contributors', "that's the main ones", 'those are the main factors', "that's the whole of it", 'that covers it', "that's the full picture"]) {
    assert.equal(confirmsWhole(m), true, `whole: "${m}"`);
  }
  // Not a closure — the member is still adding / pushing back.
  assert.equal(confirmsWhole('there was also my dad getting sick'), false);
  assert.equal(confirmsWhole('what do you mean?'), false);
  // It closes the beat (via memberDone) only once the contract is met — never a half-finished intake.
  const full = { athleticPast: 'x', identityNoun: 'Athlete', reclaimList: ['a', 'b', 'c'], doors: ['full_house'], gap: 'married young, kids to raise, a job that consumed me — nine years gone' } as Collected;
  assert.equal(resolveCompletion(full, false, 2, false, false, /*memberDone*/ true).complete, true, 'closes when contract met');
  const noGap = { athleticPast: 'x', identityNoun: 'Athlete', reclaimList: ['a', 'b', 'c'], doors: ['full_house'] } as Collected;
  assert.equal(resolveCompletion(noGap, false, 2, false, false, true).complete, false, 'never completes a half-finished intake');
});

test('memberWantsToWrap catches a clear "I\'m done" (incl. Joanne\'s line), not a normal answer', () => {
  for (const m of ['I am done I think as I want to go to bed', "that's it", 'nothing else', "let's move on", 'this is enough for now']) {
    assert.equal(memberWantsToWrap(m), true, `wrap: "${m}"`);
  }
  assert.equal(memberWantsToWrap('it was the body, and the career too'), false);
  assert.equal(memberWantsToWrap('there was more to it actually'), false);
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

test('augmentDoors infers Door(s) from the GAP narrative — incl. the first — but invents nothing from an empty gap', () => {
  // Donna's bug: a real gap named her doors, but none were recorded → she got re-asked the gap forever.
  // Inferring the first Door FROM THE GAP is reading her account, not fabricating.
  assert.deepEqual(augmentDoors([], 'caring for my 95 year old mom took over'), ['aging_parents']);
  // Run-3 protection: a skipped Door beat means an empty gap (never backfilled) → nothing invented.
  assert.deepEqual(augmentDoors([], ''), []);
  // Catches a second Door the model missed, alongside one it recorded.
  assert.deepEqual(
    augmentDoors(['career_cliff'], 'caring for my 95 year old mom took over'),
    ['career_cliff', 'aging_parents'],
  );
  // The caller passes the GAP only — so a fitness-heavy Reclaim List can't leak in: a career+caregiving
  // gap yields no spurious The Body.
  const joanneGap = 'Working too many hours, caring for my 95 year old mom with an inconsistent sister — the better part of 5 years';
  assert.deepEqual(augmentDoors(['career_cliff', 'aging_parents'], joanneGap), ['career_cliff', 'aging_parents']);
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

test('stripLeadingDisclosure removes a repeated AI disclosure but leaves the real reply', () => {
  // The exact turn-2 leak from Joanne's run: disclosure prepended to the actual reflection.
  const leaked =
    "This conversation is guided by AI. Everything you share shapes your G4L experience and is handled with the same care you'd expect from a person. You can stop at any time.\n\nThat's a vivid picture — the one who held the social fabric together. So — the Connector. Does that land?";
  const out = stripLeadingDisclosure(leaked);
  assert.doesNotMatch(out, /guided by AI/);
  assert.match(out, /^That's a vivid picture/);
  assert.match(out, /the Connector/);
  // A normal reply (no disclosure) is untouched.
  const clean = 'So — the Connector. Does that land, or is there a closer word?';
  assert.equal(stripLeadingDisclosure(clean), clean);
});

test('ensureIdqHandoff keeps the model\'s summary and only adds the IDQ transition when missing', () => {
  const summary = 'Here is your whole story reflected back — the house filling up, marriage and young kids, you carrying it all. That is The Full House.';
  const out = ensureIdqHandoff(summary);
  assert.match(out, /The Full House/); // the model's summary is preserved
  assert.match(out, /Ready when you are/); // the IDQ transition is appended
  // If the model already closed with the transition, it isn't doubled.
  const withTail = `${summary} Ready when you are.`;
  assert.equal(ensureIdqHandoff(withTail), withTail);
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
  const gap = 'my role was cut and the riding quietly stopped';
  const skipped = { athleticPast: 'x', identitySkipped: true, reclaimList: five, doors: ['career_cliff'] as const, gap };
  assert.equal(resolveCompletion(skipped as never, true, 3).complete, true);
  // and a named member still completes the same way
  const named = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] as const, gap };
  assert.equal(resolveCompletion(named as never, true, 3).complete, true);
});
