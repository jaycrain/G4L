import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFollowUp, type Spoken } from '../lib/agent/follow-up.ts';

// A MEMBER MUST NEVER HEAR THE SAME QUESTION TWICE.
//
// Jay, walking Reconnect on his own account: "Second time it's asked me this." The drift beat has three
// follow-ups and picked one with `count % 3`, so the fourth ask wraps to the first. The two fixes before this
// one were both to the arithmetic — question marks, then agent messages — and neither could stop a wrap, because
// modulo has no end. This asks a different question: which of these have I already said?
//
// The invariant already exists elsewhere: the onboarding replay harness asserts a turn never repeats verbatim.
// These are the beats that never inherited it.

const VARIANTS = ['first probe?', 'second probe?', 'third probe?'] as const;
const agent = (text: string): Spoken => ({ role: 'agent', text });
const member = (text: string): Spoken => ({ role: 'member', text });

test('it walks the list in order', () => {
  assert.equal(nextFollowUp(VARIANTS, []), 'first probe?');
  assert.equal(nextFollowUp(VARIANTS, [agent('first probe?')]), 'second probe?');
  assert.equal(nextFollowUp(VARIANTS, [agent('first probe?'), agent('second probe?')]), 'third probe?');
});

test('IT RUNS OUT — it does not wrap, which is the whole bug', () => {
  const all = VARIANTS.map((v) => agent(v));
  assert.equal(
    nextFollowUp(VARIANTS, all),
    null,
    'with every variant spent the answer is "stop asking", not "start again at the top"',
  );
});

test('a probe appended to the model\'s reflection still counts as said', () => {
  // The engine emits "<reflection>\n\n<probe>", so the stored turn is never the bare probe. Matching only the
  // exact string would have made every one of them look unsaid, and the guard would pass while repeating.
  const history = [agent('You lost the one place you got to be nobody. \n\nfirst probe?')];
  assert.equal(nextFollowUp(VARIANTS, history), 'second probe?');
});

test('only OUR turns count — a member echoing the question back does not spend it', () => {
  assert.equal(nextFollowUp(VARIANTS, [member('first probe?')]), 'first probe?');
});

test('the same variant said twice still only spends itself', () => {
  const history = [agent('first probe?'), agent('first probe?')];
  assert.equal(nextFollowUp(VARIANTS, history), 'second probe?');
});
