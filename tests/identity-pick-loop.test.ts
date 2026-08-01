import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// CAT-54 — the identity pick beat could trap a member in a dead loop.
//
// Walk 3: chips were offered, the persona answered "Sovereign. Yeah. That one." — and the beat re-prompted her
// FIFTEEN consecutive times, ending "Something is clearly stuck on your end… I'll wait."
//
// The damning detail: identityNoun was already set to "Sovereign" from her second reply onward. We had her
// answer and kept asking. Two sources of truth disagreed about the member's own word — the model recorded it,
// the engine's pick branch rejected the same message — and the rejection won SILENTLY. That is the house
// failure shape (member words outrank the model guess) on the one surface with no escape hatch:
// `pendingIdentityPick` was never cleared on a miss, so no input could end the beat.
//
// All three fixes are deterministic, so they're provable here without a live model.

const base = (over: Partial<ConvState> = {}): ConvState => ({
  stage: 'identity',
  collected: {},
  pendingIdentityPick: ['Sovereign', 'Untamed', 'Alive'],
  ...over,
} as ConvState);

/** One turn through the STAGED engine (the one prod runs), with the model recording nothing — the common
 *  real failure, and exactly what happened in walk 3. */
const turn = (state: ConvState, message: string) =>
  applyStagedTurn(state, [], message, { text: '' } as never);

test('a handle ALREADY SET ends the beat — we never re-ask a question they answered', () => {
  // The exact walk-3 state: the model recorded "Sovereign", the engine was still holding chips out.
  const out = turn(base({ collected: { identityNoun: 'Sovereign' } }), 'Sovereign. Yeah. That one.');
  assert.notEqual(out.state.stage, 'identity', 'it must move on, not re-prompt');
  assert.equal(out.state.pendingIdentityPick, undefined, 'and stop holding the chips out');
  assert.equal(out.state.collected.identityNoun, 'Sovereign', 'keeping her word, verbatim');
});

test('a candidate NAMED INSIDE a sentence is a pick — people do not answer in bare words', () => {
  // "Sovereign. Yeah. That one." never exact-matched a chip, which is how the loop started.
  for (const reply of ['Sovereign. Yeah. That one.', 'I already picked — Sovereign.', 'sovereign, i think']) {
    const out = turn(base(), reply);
    assert.equal(out.state.collected.identityNoun, 'Sovereign', `"${reply}" is an unambiguous pick`);
    assert.notEqual(out.state.stage, 'identity', `"${reply}" must advance`);
  }
});

test('TWO candidates named is a real ambiguity — ask, do not guess', () => {
  // The guard has to stay narrow, or it would pick a word out of a member who was weighing two.
  const out = turn(base(), 'Torn between Sovereign and Untamed honestly');
  assert.equal(out.state.collected.identityNoun, undefined, 'must not choose for her');
  assert.equal(out.state.stage, 'identity', 'and must stay to ask');
});

test('the beat CANNOT loop forever — two misses and we let them move on', () => {
  // The runaway escape every other stage had and this one didn't. Junk twice, then out.
  let s = base();
  const first = turn(s, '🙃🙃🙃');
  assert.equal(first.state.stage, 'identity', 'one miss re-prompts, which is right');
  s = first.state;
  const second = turn(s, '🙃🙃🙃');
  assert.notEqual(second.state.stage, 'identity', 'the second must NOT trap her — fifteen was the bug');
  assert.equal(second.state.pendingIdentityPick, undefined);
  assert.equal(second.state.collected.identitySkipped, true, 'skipped, and recoverable later from the rail');
});
