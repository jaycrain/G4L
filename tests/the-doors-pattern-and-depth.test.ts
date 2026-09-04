// GREG'S R2, READ PROPERLY — the walk stays, the mandatory second turn goes, and the pattern arrives.
//
// Jay, 2026-09-04, after Donna and Jennifer both said the Excavation was the best part of the product: "I'm
// leaning towards walking through every Door selected. Does that run against Greg's spec?"
//
// IT DOES NOT — it IS the spec, and I had said otherwise from reading the closure section without the exploration
// section. R2-33: "After the Member rates each door, the Companion elicits any reflection that comes with the
// rating — what the door looked like in their life, when it happened, whether it is still open. The Companion
// reflects back what it hears," testable as "not an immediate next door." R2-31 captures her language per Door.
// R2-30 moves on only when she signals readiness. That is the walk, and both testers were responding to it.
//
// WHAT WAS OURS was the DEPTH FLOOR. R2-32 makes the extra turn conditional — "If the Member is too global, ask
// for one more layer of specificity", testable as "a vague reply triggers EXACTLY ONE specificity follow-up." We
// required a second drawing-out exchange on every Door however complete her first answer was, which across a full
// board is the difference between roughly twenty-five turns and fifty-five. R2-16 names the posture it broke:
// "guide mode, not full coach."
//
// AND R2-34 WAS MISSING ENTIRELY: a cumulative-pattern summary between the last Door and the closure questions,
// in her own language, that she confirms or corrects. It is the payoff for having walked them all — the moment
// separate Doors become one shape — and without it she finished ten excavations and was asked a closing question
// as though the set had never been assembled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { drawoutShouldReflect } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

test('R2-32 · one substantive answer is enough — the second turn is no longer mandatory', () => {
  // depth 1, model says the Door is drawn out. Under the old floor of 2 this was forbidden.
  assert.equal(drawoutShouldReflect('The mornings went first, and everything after it followed.', true, 1, 1, 5), true,
    'a Door answered well the first time still had to be asked again');
});

test('but the model still governs it — a thin turn does not advance on its own', () => {
  // The floor moved; the judgement did not. Decision T keeps the model deciding when a Door is excavated, and a
  // short reply with no depthReady must not close a Door.
  assert.equal(drawoutShouldReflect('Work got busy.', false, 1, 1, 5), false,
    'a global one-liner closed the Door — that is the case R2-32 exists for');
});

const atLastDoor = (scratch: Record<string, unknown>): ConvState => ({
  stage: 'doors', awaitingConfirm: true,
  collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'loss'], doorsExcavated: ['body'] } as Collected,
  stageScratch: { doors: scratch },
} as unknown as ConvState);

test('R2-34 · the pattern comes BEFORE the closing question, not after the set is dropped', () => {
  const out = applyReconnectTurn(atLastDoor({ openedDoor: 'loss' }), [], "that's it",
    { text: 'Across both Doors it is the same shape — you kept going and nobody asked what it cost.', replyIntent: 'done' } as never,
    RECONNECT_R2_ARC);
  assert.match(out.reply, /shape of your Fade/i, 'the last Door closed straight into the closing question');
  assert.doesNotMatch(out.reply, /what does recognizing these Doors change/i,
    'the internalization question must wait until she has ruled on the pattern');
});

test('and she can CORRECT it — her words are stored, not argued with', () => {
  const settled = { patternAsked: true } as Record<string, unknown>;
  const st = { ...atLastDoor(settled), collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'loss'], doorsExcavated: ['body', 'loss'] } as Collected } as ConvState;
  const out = applyReconnectTurn(st, [], 'Not quite — it was the caring underneath all of it, not the job.', { text: 'Understood.' }, RECONNECT_R2_ARC);
  assert.equal((out.state.collected as Collected & { doorsPatternCorrection?: string }).doorsPatternCorrection,
    'Not quite — it was the caring underneath all of it, not the job.', 'her correction must be stored verbatim');
  assert.match(out.reply, /what does recognizing these Doors change/i, 'and it moves on the same turn — not another round');
});

test('confirming it moves on too — neither answer is a dead end', () => {
  const st = { ...atLastDoor({ patternAsked: true }), collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'loss'], doorsExcavated: ['body', 'loss'] } as Collected } as ConvState;
  const out = applyReconnectTurn(st, [], "That's it", { text: 'Good.', replyIntent: 'done' } as never, RECONNECT_R2_ARC);
  assert.match(out.reply, /what does recognizing these Doors change/i);
});

test('THE WALK ITSELF IS UNTOUCHED — every marked Door still gets opened', () => {
  // The thing Donna and Jennifer praised, and the thing I nearly proposed removing. R2-33 requires it.
  const out = applyReconnectTurn(atLastDoor({ openedDoor: 'body' }), [], "that's it",
    { text: 'That is drawn out.', replyIntent: 'done' } as never, RECONNECT_R2_ARC);
  assert.match(out.reply, /The Loss/i, 'the next marked Door must still be opened');
});

test('ONE Door gets NO pattern turn — there is no pattern across one thing', () => {
  // Greg's words are "the cumulative pattern ACROSS doors". With a single Door there is nothing cumulative, and
  // summarising it back would repeat the insight she confirmed one turn earlier — the repetition three testers
  // have already reported in other forms. It also means a one-Door member's Session is unchanged by all of this.
  const single: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Racer', boardDone: true, doors: ['marriage'], doorsExcavated: [] } as Collected,
    stageScratch: { doors: { openedDoor: 'marriage' } },
  } as unknown as ConvState;
  const out = applyReconnectTurn(single, [], "yeah, that's exactly it", { text: 'Good.', replyIntent: 'done' } as never, RECONNECT_R2_ARC);
  assert.doesNotMatch(out.reply, /shape of your Fade/i, 'a single Door was given a "pattern across your Doors" turn');
  assert.match(out.reply, /change about how you see your own Fade/i, 'it goes straight to the closing question');
});
