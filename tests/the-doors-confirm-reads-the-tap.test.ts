// "I CLICKED THAT'S IT BUTTON AND IT KEPT COMING BACK." — Donna, 2026-09-01.
//
// The Doors confirm OFFERS beat-confirm chips and then read the answer with the free-text classifier. A tapped
// chip arrives as a serialized wire string, the prose reader does not recognise it, and the draw-out carries on as
// though she had said nothing. She tapped "That's it" twice, then had to tell the Companion it had already walked
// that Door — and the Session ended without recording whether her fourth Door was still open.
//
// THE PART THAT MATTERS MOST. The chips were put on this beat FOR HER, five days earlier, after she reported it
// "didn't take yes for an answer and it only went through one of the Doors". The chips shipped and the parse did
// not, so the comment above the expectation announced a fix the code never made, and she hit the same complaint
// twice. Drift, window and the legacy confirm had all read the tap first since they were built. Fourth site, one
// fact. [[a-tap-is-never-prose]] [[one-fact-many-sites]]
//
// WHY THE SUITE DID NOT CATCH IT, which is the more useful lesson. The existing R2 tests pass
// `{ text: '', replyIntent: 'done' }` — every one of them hands the engine a MODEL signal, so
// resolveConfirmCorroborated returned 'done' whatever the member message said, and the wire string was never
// exercised. A member tapping a chip gives us no model intent at all. So this test passes NO replyIntent: it is
// the member, alone, tapping a button — which is the only condition under which the bug appears.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const COMMITTED: Collected = { identityNoun: 'Racer', gap: 'The years took it.', doors: ['grind'] };
const atConfirm = (): ConvState => ({ stage: 'doors', awaitingConfirm: true, collected: COMMITTED });

/** Exactly what the chip labelled "That's it" puts on the wire. */
const TAP_DONE = serializeBeatConfirm('done');

test('a tapped "That\'s it" is taken as yes, with no model signal to lean on', () => {
  const out = applyReconnectTurn(atConfirm(), [], TAP_DONE, { text: '' }, RECONNECT_R2_ARC);
  // Taking the yes means advancing to Greg's closing reflection — the same place a typed "that's it" lands.
  assert.match(out.reply, /change about how you see your own Fade/i,
    'the tap should advance the beat; instead the draw-out asked for more — "it kept coming back"');
});

test('the tap lands in the same place a typed close does', () => {
  // The chips are an easy path, never a gate. Both routes must reach the same beat, or the button is a trap.
  const tapped = applyReconnectTurn(atConfirm(), [], TAP_DONE, { text: '' }, RECONNECT_R2_ARC);
  const typed = applyReconnectTurn(atConfirm(), [], "that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  assert.equal(tapped.state.stage, typed.state.stage, 'tap and prose must leave the member in the same stage');
  assert.equal(tapped.complete, typed.complete);
});

test('a tapped "there\'s more" is still heard as more — the fix must not swallow the other chips', () => {
  // The opposite failure, and the one that would be worse: reading every tap as a close would end the Door work
  // on a member who asked to keep going. She tapped "There's more" four times in this same walk.
  const out = applyReconnectTurn(atConfirm(), [], serializeBeatConfirm('addition'), { text: '' }, RECONNECT_R2_ARC);
  assert.doesNotMatch(out.reply, /change about how you see your own Fade/i,
    'an addition must NOT be treated as the close');
  assert.ok(!out.complete, 'and the Session stays open');
});

test('a member who types instead of tapping is unaffected', () => {
  // Prose stays the fallback. If this breaks, the fix bought tap support by dropping everyone who types.
  const out = applyReconnectTurn(atConfirm(), [], "yeah, that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /change about how you see your own Fade/i, 'typed closes must still work');
});

// ── THE ONE SHE ACTUALLY HIT ──────────────────────────────────────────────────────────────────────────────────
//
// Written after the tests above proved my first diagnosis wrong. I had traced her report to the CONFIRM beat and
// written a test for it — and that test passed against the unfixed code, because the prose reader happened to
// resolve the "done" wire string correctly by luck (the string contains the word "done"). The confirm fix is real
// and worth keeping: prose collapsed BOTH other chips to "done", so tapping "There's more" silently closed the
// Door. But it is not what she hit.
//
// What she hit was the DRAW-OUT's advance check, a different reader on a different line, which saw no tap at all.
// She was mid-Door with the chips on screen, tapped "That's it", and the draw-out ticked on and asked for more.
//
// The lesson is the red check, not the bug: a fix whose test cannot fail on the reported symptom is a fix for
// something else. [[read-the-whole-path-before-proposing]]
import { memberWantsToAdvance } from '../lib/agent/onboarding-intent.ts';

test('a tap on "That\'s it" ends the draw-out — the button she pressed twice', () => {
  assert.equal(memberWantsToAdvance(TAP_DONE), true,
    'the draw-out did not see the tap, so it asked for more — "it kept coming back"');
});

test('and the other two taps still mean stay', () => {
  // Reading any tap as "move on" would end a Door on a member who asked to keep going — the opposite harm.
  assert.equal(memberWantsToAdvance(serializeBeatConfirm('addition')), false);
  assert.equal(memberWantsToAdvance(serializeBeatConfirm('dispute')), false);
});

test('typed answers are untouched by the tap path', () => {
  assert.equal(memberWantsToAdvance("that's it"), true);
  assert.equal(memberWantsToAdvance("there's more to it"), false);
});
