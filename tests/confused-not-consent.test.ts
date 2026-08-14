import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberIsConfused } from '../lib/agent/onboarding-intent.ts';
import { applyReconnectTurn } from '../lib/agent/reconnect.ts';
import { CLARIFY_REPLY } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// "I DON'T UNDERSTAND" MUST NEVER COUNT AS "YES".
//
// The confirm gates read a reply as dispute / addition / done, and anything unrecognised falls to done. That
// default is deliberate — a false "there's more" loops the beat, which Jay has reported as "won't take yes" —
// and it is right for a hedge or a terse add, both of which the summary card catches.
//
// It is wrong for exactly one family. On Jay's walk (2026-08-13) the Companion emitted its graceful fallback
// ("I don't want to put a shape on this before it's earned"), he replied "What do you mean", and the engine
// scored that as agreement, closed the Doors excavation and opened the 24-item IDQ. He never answered.
//
// So the interception is narrow: only a member who has said they did not follow us, only at a gate, only once.

const history = (n: number): ConvMessage[] =>
  Array.from({ length: n }, (_, i) => [
    { role: 'agent', text: `probe ${i}` },
    { role: 'member', text: `reply ${i}` },
  ]).flat();

/** A Doors insight confirm, mid-excavation — the exact state Jay was in. */
const atInsightConfirm = (): ConvState => ({
  stage: 'doors',
  awaitingConfirm: true,
  stageScratch: { doors: { doorDepth: 2 } },
  collected: { doors: ['grind'] },
});

test('THE WALK: "What do you mean" at the Doors confirm does NOT open the IDQ', () => {
  const turn = applyReconnectTurn(atInsightConfirm(), history(3), 'What do you mean', { text: '', depthReady: true });
  assert.notEqual(turn.state.stage, 'measurement', 'a question must not be read as consent to move on');
  assert.equal(turn.state.stage, 'doors', 'the beat holds where it was');
  assert.equal(turn.state.awaitingConfirm, true, 'and it is still listening for the answer it asked for');
  assert.equal(turn.reply, CLARIFY_REPLY);
});

test('every way a member says they are lost holds the gate', () => {
  for (const msg of ["I don't understand", 'Sorry, what?', 'Huh?', 'Can you say that again?', 'wdym', 'you lost me']) {
    const turn = applyReconnectTurn(atInsightConfirm(), history(3), msg, { text: '', depthReady: true });
    assert.equal(turn.state.stage, 'doors', `"${msg}" advanced the arc`);
  }
});

test('...and a real answer containing those words is NOT intercepted', () => {
  // "I don't understand why I let it go" is a member telling us something true about their life. Holding on it
  // would be the mirror-image failure: refusing to hear an answer because it contains a stock phrase.
  assert.equal(memberIsConfused("I don't understand why I let it go, it just slipped away over ten years"), false);
  assert.equal(memberIsConfused('What I mean is the mornings were the part I actually lost'), false);
  assert.equal(memberIsConfused("That's it"), false);
});

test('ONCE — a member still stuck after the rephrase is not trapped in a loop', () => {
  // The advance-bias exists because looping is its own failure ("won't take yes"). So the hold is single-shot:
  // with the rephrase already in the transcript, the next confused reply falls through to the normal gate.
  const withClarify: ConvMessage[] = [...history(3), { role: 'agent', text: CLARIFY_REPLY }];
  const turn = applyReconnectTurn(atInsightConfirm(), withClarify, 'What do you mean', { text: '', depthReady: true });
  assert.notEqual(turn.reply, CLARIFY_REPLY, 'it must not ask for a rephrase twice');
});

test('the hold is only at a GATE — mid-draw-out the model answers for itself', () => {
  // Not awaiting a confirm: nothing is being read as consent, so there is nothing to protect against, and
  // intercepting would talk over the model's own reply.
  const gathering: ConvState = { stage: 'doors', awaitingConfirm: false, stageScratch: { doors: { doorDepth: 1 } }, collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(gathering, history(3), 'What do you mean', { text: 'Say more about the evenings.', depthReady: false });
  assert.notEqual(turn.reply, CLARIFY_REPLY);
});
