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

// ── RECEIVE BEFORE YOU MOVE ──────────────────────────────────────────────────────────────────────────────────
// A member who has just written their Reclaim List must not be answered with a scripted frame that ignores it.
// Jay, 2026-08-14: "it rushed through and didn't acknowledge." He typed three items and the next bubble was
// "Before we go further, a quick baseline."
//
// The contract already existed — receiveThen(), used at two Reconnect hand-ins for exactly this reason ("the
// founder answered a weighty question and got the cold let's-shift frame"). This transition never got it.
//
// Driven through the STAGED ARC the way the replay fixtures do, so it exercises the real hand-in rather than the
// helper in isolation. The receipt has to come from the engine here: the list arrives from the structured
// builder, so there is frequently no model prose to receive.
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';

test('the baseline does not open until the list has been received', () => {
  const list = ['Time to ride my bike', 'Free time to myself', 'Lose weight'];
  const state = {
    stage: 'reclaim',
    awaitingConfirm: false,
    collected: { reclaimList: list, identityNoun: 'Player', gap: 'the mornings went' },
  } as never;
  const turn = applyStagedTurn(state, [], "that's the list", { text: '', reclaimReady: true } as never);
  const reply = turn.reply ?? '';
  if (!/quick baseline/i.test(reply)) return; // didn't reach the baseline on this turn — nothing to assert
  assert.ok(reply.includes('ride my bike'), `the list was never acknowledged:\n${reply}`);
  assert.ok(
    reply.indexOf('ride my bike') < reply.indexOf('quick baseline'),
    `their own words must come BEFORE the scripted frame:\n${reply}`,
  );
});
