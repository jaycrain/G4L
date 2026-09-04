// NOBODY GETS TRAPPED IN A SESSION.
//
// Jennifer, 2026-09-04, subject line: "Stuck in this loop." The Companion offered her the Legacy Letter inside
// Excavation, the draft could not render — there is no letter in that Session — and every reply after that came
// back "Take your time — say more whenever you're ready." / "There's no wrong way in." She asked twice, plainly:
//
//     "Don't see the letter yet."   "Please show me the letter."
//
// and could not get past it. Cowork escalated it to Blocker: "it's not a cosmetic miss, it's a trap."
//
// THE ESCAPE EXISTED AND HAD NOTHING TO CALL. The kernel's runaway backstop fires on a stall or the hard ceiling
// and delegates to the stage's `forceProgress`. Every Reconnect stage defined none, so it resolved to undefined
// and fell through into the same draw-out that was already looping.
//
// I FOUND THAT ABSENCE THE DAY BEFORE and wrote it down as "not urgent, worth knowing it is absent rather than
// tuned." A member hit it the next morning, at 113 turns. A known gap with no owner is a gap you have decided to
// ship. [[unrun-rules-the-defect-class]]
//
// WHAT IT MUST NOT DO is as important: it must not end her Session for her, invent an answer, or scold. It banks
// the Door she has plainly said enough about, says the fault was ours, and moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState, Collected, ConvMessage } from '../lib/agent/onboarding.ts';

/** Her shape: far past the ceiling, mid-Door, asking for something this Session cannot give her. */
const stuck = (excavated: string[], opened: string): ConvState => ({
  stage: 'doors', awaitingConfirm: false,
  collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'aging_parents', 'loss'], doorsExcavated: excavated } as Collected,
  stageScratch: { doors: { doorDepth: 4, openedDoor: opened } },
} as unknown as ConvState);

const longWalk: ConvMessage[] = Array.from({ length: 113 }, (_, i) => (i % 2
  ? { role: 'agent' as const, text: "Take your time — say more whenever you're ready." }
  : { role: 'member' as const, text: 'Please show me the letter.' }));

test('HER LOOP: the turn that trapped her is not repeated', () => {
  const out = applyReconnectTurn(stuck(['body'], 'aging_parents'), longWalk, 'Please show me the letter.', { text: '' }, RECONNECT_R2_ARC);
  assert.doesNotMatch(out.reply, /take your time|no wrong way in/i,
    `the escape re-emitted the looping line:\n${out.reply}`);
  assert.match(out.reply, /stuck on my end/i, 'it must say the fault was ours, not hers');
});

test('and it MOVES — the next Door opens', () => {
  const out = applyReconnectTurn(stuck(['body'], 'aging_parents'), longWalk, 'Please show me the letter.', { text: '' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /The Loss/i, 'the queue did not advance, so the next turn loops again');
  assert.ok(((out.state.collected as Collected).doorsExcavated ?? []).includes('aging_parents' as never),
    'the Door she was on must be banked, or the same Door reopens');
});

test('at the LAST Door it closes the beat rather than inventing another', () => {
  const out = applyReconnectTurn(stuck(['body', 'aging_parents', 'loss'], 'loss'), longWalk, 'Please show me the letter.', { text: '' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /what does recognizing these Doors change/i, 'it should reach the closing question');
  assert.notEqual(out.complete, true, 'and NOT end her Session on her behalf — she still answers it');
});

test('IT DOES NOT FIRE ON AN ORDINARY TURN — this is a ceiling, not a nudge', () => {
  // The expensive failure in the other direction: hurrying someone who is doing the work. A Door is legitimately
  // slow, and a member three turns in must never be told the Companion got stuck.
  const early: ConvMessage[] = [{ role: 'agent', text: 'Take me into it.' }, { role: 'member', text: 'It was the year my dad got ill.' }];
  const out = applyReconnectTurn(stuck([], 'body'), early, 'It changed everything about my mornings.', { text: 'Say more about that.' }, RECONNECT_R2_ARC);
  assert.doesNotMatch(out.reply, /stuck on my end/i, 'the escape fired on a healthy turn');
  assert.deepEqual((out.state.collected as Collected).doorsExcavated ?? [], [], 'and it must not bank a Door she is still walking');
});

test('HER ACTUAL STATE: the ceiling fires even while a confirm is pending', () => {
  // The escape shipped hours earlier did NOT reach her, and this is why. It required `!awaitingConfirm`, and she
  // was parked AT a confirm — 132 turns, asking in plain words: "Please move to the last session of Reconnect."
  // Gating the rescue on "not currently gated" excluded the only state that needed rescuing.
  const st: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: {
      identityNoun: 'Athlete', boardDone: true,
      doors: ['grind', 'body', 'aging_parents', 'diagnosis', 'loss', 'career_cliff', 'load_bearer', 'full_house', 'empty_nest', 'autopilot'],
      doorsExcavated: ['grind', 'body', 'aging_parents', 'diagnosis', 'loss', 'career_cliff', 'load_bearer', 'full_house'],
    } as Collected,
    stageScratch: { doors: { doorDepth: 3, openedDoor: 'empty_nest' } },
  } as unknown as ConvState;

  const out = applyReconnectTurn(st, longWalk, 'Please move to the last session of Reconnect.', { text: '' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /stuck on my end/i, 'the ceiling still did not fire at a pending confirm');
  assert.equal(((out.state.collected as Collected).doorsExcavated ?? []).length, 9, 'the open Door must be banked and the queue moved');
});

test("her PROTESTS are not banked as her words for the Door", () => {
  // Her stored words for The Empty Nest were "We have already done that door. Please move to the third session."
  // and "Please move to the last session of Reconnect." — her attempts to escape, filed as her account of a Door
  // she never discussed. Those go to the Companion afterwards as what she said.
  const st: ConvState = {
    stage: 'doors', awaitingConfirm: false,
    collected: { identityNoun: 'Athlete', boardDone: true, doors: ['empty_nest', 'autopilot'], doorsExcavated: [] } as Collected,
    stageScratch: { doors: { doorDepth: 1, openedDoor: 'empty_nest' } },
  } as unknown as ConvState;
  const out = applyReconnectTurn(st, [{ role: 'agent', text: 'Take me into it.' }], 'We have already done that door. Please move to the third session.', { text: 'Say more.' }, RECONNECT_R2_ARC);
  const words = ((out.state.stageScratch?.doors ?? {}) as { doorWords?: string[] }).doorWords ?? [];
  assert.deepEqual(words, [], `a request to move on was stored as her words for the Door: ${JSON.stringify(words)}`);
});
