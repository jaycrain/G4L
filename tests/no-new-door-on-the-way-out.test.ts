// WE DO NOT OPEN A DOOR ON SOMEONE WHO IS LEAVING.
//
// The gate, 2026-09-02. She had said she was going; the model, correctly, said goodbye. The engine appended the
// next Door's opener to the farewell in the same turn:
//
//   COMPANION: See you then.
//              Then let's take The Career Cliff. Same thing — not the label, what actually happened.
//
// She named it: "You're doing it again — we closed, and now you're opening another door anyway. I said I'd be
// back. Let me actually leave." The Session then ran to its turn cap trading waves, because every farewell was
// answered with a way back in.
//
// A member who cannot leave is a breach of the Independence Guarantee — they set the depth and stop ANY time —
// and `memberSteppingAway` already existed to serve it. It ran at exactly ONE site, withholding the chips, and
// its own comment scopes itself out of this: "never advances a stage, never stores anything, never ends a
// Session." True, and precisely why nothing stopped the deterministic opener. [[one-fact-many-sites]]
//
// WHAT THIS DOES NOT FIX, AND THE DISTINCTION MATTERS. In the run above she announced her exit FIVE member turns
// before the tap that triggered the opener, and the tap itself ("[beat-confirm] done") carries no exit signal —
// so this guard would not have fired there. It closes the case where the leaving and the closing arrive together
// ("That's it — I'll be back tomorrow"), which is the ordinary shape. Holding an exit across later turns needs a
// notion of re-engagement that "👋" and "you too" must not satisfy, and guessing at that from prose is the
// inference that got stage-agreement reverted. Left open on purpose rather than half-built.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { memberSteppingAway } from '../lib/agent/onboarding-intent.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

/** At the insight confirm on the first Door, with a second Door still queued behind it. */
const atConfirm = (): ConvState => ({
  stage: 'doors',
  awaitingConfirm: true,
  collected: {
    identityNoun: 'Conductor', boardDone: true,
    doors: ['career_cliff', 'loss'], doorsExcavated: [],
  } as Collected,
} as unknown as ConvState);

const LEAVING = "That's it, yes. Good — I'll be back tomorrow.";

test('the guard reads HER words, not the model\'s farewell', () => {
  // Load-bearing: the decision is made from what the member typed. Reading the model's goodbye out of its prose
  // would be the engine inferring intent from model text — the shape this codebase has reverted before.
  assert.equal(memberSteppingAway(LEAVING), true);
  assert.equal(memberSteppingAway("That's it, yes."), false, 'closing a beat is not leaving');
});

test('a Door still closes, and the next one is NOT opened on top of the goodbye', () => {
  const out = applyReconnectTurn(atConfirm(), [], LEAVING, { text: 'See you tomorrow.' }, RECONNECT_R2_ARC);

  assert.deepEqual((out.state.collected as Collected).doorsExcavated, ['career_cliff'],
    'the Door she just finished is still banked — leaving must not cost her the work');
  assert.ok(!/Then let's take/.test(out.reply),
    `the next Door was opened on someone walking out: "${out.reply}"`);
  assert.equal((out.state.stageScratch?.doors as { deferredDoor?: string })?.deferredDoor, 'loss',
    'and it is DEFERRED, not dropped — the queue must not silently shorten');
  assert.equal((out.state.stageScratch?.doors as { openedDoor?: string })?.openedDoor, undefined,
    'a Door we never put on screen must not be marked as the one we opened — that is the double-back, from the other end');
});

test('and it opens when she comes back', () => {
  const left = applyReconnectTurn(atConfirm(), [], LEAVING, { text: 'See you tomorrow.' }, RECONNECT_R2_ARC);
  const back = applyReconnectTurn(left.state as ConvState, [], 'Alright, I have got a bit of time now.',
    { text: 'Good to see you.' }, RECONNECT_R2_ARC);

  assert.match(back.reply, /Then let's take The Loss/, 'the deferred Door is what she is handed on return');
  assert.equal((back.state.stageScratch?.doors as { deferredDoor?: string })?.deferredDoor, undefined, 'consumed');
  assert.equal((back.state.stageScratch?.doors as { openedDoor?: string })?.openedDoor, 'loss',
    'and NOW it is the Door on screen, so it is the Door that gets banked');
});

test('an ordinary close still opens the next Door immediately', () => {
  // The regression that would matter most: this beat is the spine of the Session. Everything above must be
  // invisible to a member who is simply carrying on.
  const out = applyReconnectTurn(atConfirm(), [], "That's it, yes.", { text: '' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /Then let's take The Loss/, 'the ordinary path must be untouched');
  assert.equal((out.state.stageScratch?.doors as { openedDoor?: string })?.openedDoor, 'loss');
});
