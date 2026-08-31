import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showComposer } from '../lib/chat/composer.ts';

// JAY'S RULING, 2026-08-31, on the one beat where two testers disagreed.
//
// Jay (8/28) wanted to change a line of his own Legacy Letter and had two buttons and nowhere to type — which is
// why beat_confirm keeps its composer everywhere else. Donna (8/30), same screen: "a straggler field for entering
// content that isn't necessary."
//
// Both right. He arrived wanting to TYPE, she arrived ready to ACCEPT. So the box is deferred, not removed:
// "Change a line" clears `expects` and the composer comes up with a prompt.

const legacy = { kind: 'beat_confirm', set: 'legacy' };
const ordinary = { kind: 'beat_confirm', set: 'default' };

test('the Legacy confirm shows chips only — no empty box beside them', () => {
  assert.equal(showComposer(legacy, false), false);
});

test('EVERY OTHER confirm keeps its box — the asymmetry argument still governs them', () => {
  // "a needless text box is a moment's confusion, and a missing one is a member who cannot say the thing they
  // came to say." That reasoning is untouched outside the Legacy set.
  assert.equal(showComposer(ordinary, false), true);
  assert.equal(showComposer({ kind: 'beat_confirm' }, false), true, 'an unset set is the default set');
});

test("after 'Change a line' the box is there — the engine clears expects, and no expectation means composer", () => {
  // This is the path that makes deferring safe: his case costs one tap, not the ability to speak.
  assert.equal(showComposer(undefined, false), true);
  assert.equal(showComposer(null, false), true);
});

test('a structured beat still has no composer, and Continue still suppresses it', () => {
  assert.equal(showComposer({ kind: 'scale' }, false), false, 'the answer IS the structure');
  assert.equal(showComposer({ kind: 'reclaim_list' }, false), false);
  assert.equal(showComposer(legacy, true), false);
  assert.equal(showComposer(ordinary, true), false, 'awaitingContinue outranks everything');
});
