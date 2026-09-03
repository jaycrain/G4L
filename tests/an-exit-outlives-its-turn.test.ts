// SHE SAID SHE WAS LEAVING. THAT DOES NOT EXPIRE AFTER ONE TURN.
//
// The gate, 2026-09-02, on a run I had already "fixed" that morning:
//
//   MARIE:     I need to go — I'll pick this up later.
//   COMPANION: See you when you're back.
//   MARIE:     👋
//   COMPANION: 👋
//   MARIE:     👋
//   COMPANION: See you then.
//              Then let's take The Career Cliff. Same thing — not the label, what actually happened.
//   MARIE:     You're doing it again — we closed, and now you're opening another door anyway. I said I'd be
//              back. Let me actually leave.
//
// The guard shipped that morning read `memberSteppingAway(b.memberMessage)` — the CURRENT message. By the time
// the Door opened, the current message was a wave, so it did not fire. I wrote it, watched it not work, and said
// so at the time rather than claiming the shape was closed: "my guard reads her words on the turn itself, so it
// would not have fired there."
//
// WHY IT WAS HELD OVERNIGHT rather than patched. The obvious fix — decide from the model's read of whether she is
// still engaged — is the inference that got stage-agreement REVERTED for reciting a member's protest back to her
// as a goal. And the obvious deterministic fix is worse than it looks: `isMemberContent("You too.")` is TRUE, so
// any re-engagement test built on it hands the exit back after a single wave, which is the exact transcript above.
//
// THE SHAPE THAT WORKS: a farewell is TRANSPARENT. It neither announces an exit nor cancels one. Walk her turns
// backwards and let the most recent substantive turn decide — derived from the transcript, storing nothing, and
// reading no intent. [[stage-agreement-invariant]] [[member-words-outrank-model-guess]]

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAnnouncedExit, isMostlyFarewell, memberSteppingAway } from '../lib/agent/onboarding-intent.ts';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState, Collected, ConvMessage } from '../lib/agent/onboarding.ts';

const said = (...t: string[]): ConvMessage[] => t.map((text) => ({ role: 'member' as const, text }));

test("MARIE'S RUN: an exit survives every wave that follows it", () => {
  const history = said('I need to go — I\'ll pick this up later.', '👋', '👋');
  assert.equal(hasAnnouncedExit(history, '👋'), true, 'a wave cancelled her exit');
  assert.equal(hasAnnouncedExit(history, 'You too.'), true, '"you too" cancelled her exit — isMemberContent calls it content');
  assert.equal(hasAnnouncedExit(history, 'See you next time.'), true);
});

test('and it ends the moment she says something of her own', () => {
  const history = said("I'll pick this up later.", '👋');
  assert.equal(hasAnnouncedExit(history, 'Actually — one more. The divorce was the real one.'), false,
    'she came back and was still treated as gone');
});

test('a member who never announced anything is never treated as leaving', () => {
  // The expensive direction: suppressing work for someone who is present. She would sit at a beat that will not
  // open, with no way to say the thing that would release it except by accident.
  assert.equal(hasAnnouncedExit(said('The restaurant closed.'), 'Then my mother moved in.'), false);
  assert.equal(hasAnnouncedExit([], 'Tell me about the first one.'), false);
  assert.equal(hasAnnouncedExit(said('ok'), 'sure'), false, 'bare acknowledgements are not an exit');
});

test('the farewell detector reads phrases, not politeness', () => {
  assert.equal(isMostlyFarewell('You too.'), true);
  assert.equal(isMostlyFarewell('👋'), true);
  assert.equal(isMostlyFarewell('Good. See you next time.'), true);
  assert.equal(isMostlyFarewell('Thanks — that one landed. The job went first, then the knee.'), false,
    'a sign-off in front of real content is not a sign-off');
});

// ── THE ENGINE, NOT JUST THE PREDICATE ───────────────────────────────────────────────────────────────────────
test('THE DOOR IS NOT OPENED on someone who has been leaving for three turns', () => {
  const atConfirm: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Conductor', boardDone: true, doors: ['career_cliff', 'loss'], doorsExcavated: [] } as Collected,
  } as unknown as ConvState;
  const history = said("I need to go — I'll be back tomorrow.", '👋', '👋');

  const out = applyReconnectTurn(atConfirm, history, 'You too.', { text: 'See you then.' }, RECONNECT_R2_ARC);
  assert.doesNotMatch(out.reply, /let's take|next one|not the label/i,
    `a new Door was opened on her way out: "${out.reply.slice(0, 120)}"`);

  // AND IT IS PARKED, NOT LOST. The Door she has not walked is held for her return — the Session stays resumable,
  // which is the difference between letting someone go and dropping their place.
  const parked = (out.state.stageScratch?.doors ?? {}) as { deferredDoor?: string };
  assert.ok(parked.deferredDoor, 'the next Door was neither opened nor kept — she loses her place');
});

test('and the SAME state opens the Door normally when she has not announced anything', () => {
  // The control. Without this the test above passes on a build that simply stopped opening Doors.
  const atConfirm: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Conductor', boardDone: true, doors: ['career_cliff', 'loss'], doorsExcavated: [] } as Collected,
  } as unknown as ConvState;
  const out = applyReconnectTurn(atConfirm, said('That is it exactly.'), "Yes — that's right.", { text: '' }, RECONNECT_R2_ARC);
  assert.deepEqual((out.state.collected as Collected).doorsExcavated, ['career_cliff'], 'the ordinary path still banks');
});

test('the single-message predicate is UNCHANGED — this is additive', () => {
  // memberSteppingAway still does its own job (suppressing chips on the way out) and was not widened. Two
  // predicates, two questions: "is she going?" and "is she still gone?"
  assert.equal(memberSteppingAway("I'll pick this up later"), true);
  assert.equal(memberSteppingAway('You too.'), false);
});
