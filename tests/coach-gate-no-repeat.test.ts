// THE ENGINE MUST NEVER PUT THE SAME PROPOSAL ON SCREEN TWICE.
//
// Three coach stages had the identical loop: coach → capture an artifact → propose it → and on any reply that
// isn't a confirm, set `proposed = false` and fall through to a `ready` check computed from the artifact — which
// the reply didn't change. So the next turn re-proposed it, verbatim, forever.
//
//   proposal · "tell me what you'd change" · the same proposal · "tell me what you'd change" · …
//
// The engine's no-verbatim-repeat guard can't catch it, because the two lines ALTERNATE and it only fires on an
// exact consecutive duplicate.
//
// Reported three times from three directions before it was understood as one bug:
//   · Greg, B3 — asked "How will I track it?" and got the entire plan block back.
//   · C1 — the same loop, found by our OWN persona harness (scripts/c1-refine-walk.ts). "Dana" is a scripted
//     member, NOT a real one; the harness caught this before a member had to report it.
//   · Jay, C3 — 25 messages deep with the artifact captured and unchanged throughout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposalSignature, shouldPropose, markProposed, type CoachGate } from '../lib/agent/coach-gate.ts';
import { applyRebuildB3Turn } from '../lib/agent/rebuild.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// ── the gate itself ───────────────────────────────────────────────────────────────────────────────────────────

test('proposes once, then not again while nothing has changed', () => {
  const gate: CoachGate = {};
  const sig = proposalSignature({ a: 'ride 3x', b: 'fruit at breakfast' });
  assert.equal(shouldPropose(gate, true, sig), true, 'first time: show it');
  markProposed(gate, sig);
  assert.equal(shouldPropose(gate, true, sig), false, 'second time: DO NOT show it again');
  assert.equal(shouldPropose(gate, true, sig), false, 'nor the third, nor the twenty-fifth');
});

test('proposes AGAIN the moment the artifact actually changes', () => {
  const gate: CoachGate = {};
  markProposed(gate, proposalSignature({ a: 'ride 3x', b: 'fruit at breakfast' }));
  const changed = proposalSignature({ a: 'ride 3x', b: 'veg at dinner' });
  assert.equal(shouldPropose(gate, true, changed), true, 'a real edit earns a fresh proposal');
});

test('a re-record that changes nothing VISIBLE does not re-propose', () => {
  // The model re-emits the same artifact with keys in a different order, or with stray whitespace. That is not a
  // change the member can see, and showing the block again would read as a loop.
  const gate: CoachGate = {};
  markProposed(gate, proposalSignature({ a: 'ride 3x', b: 'fruit at breakfast' }));
  assert.equal(shouldPropose(gate, true, proposalSignature({ b: 'fruit at breakfast ', a: ' ride 3x' })), false);
});

test('not ready never proposes, however many times it is asked', () => {
  const gate: CoachGate = {};
  assert.equal(shouldPropose(gate, false, proposalSignature({ a: 'x' })), false);
});

test('THE GATE HAS NO CLOSE — once proposed it stays open', async () => {
  // My first cut closed the gate on any non-confirm, which meant a member who asked a question then said "lock
  // them in" had to say it TWICE. There is deliberately no operation that un-proposes: the gate is left by
  // confirming, or replaced by a changed artifact.
  const ops = Object.keys(await import('../lib/agent/coach-gate.ts'));
  assert.ok(!ops.some((k) => /close|reset|clear|unpropose/i.test(k)), `coach-gate exposes a way to close the gate: ${ops}`);
});

// ── the seam: Greg's actual B3 turn ───────────────────────────────────────────────────────────────────────────

const ACTIVITY = '15 minutes of functional fitness exercise, 5 days this week';
const DIET = 'Adding a piece of fruit with breakfast, 5 days this week';

/** Mid-B3 with both changes locked and the plan already proposed once. */
function afterFirstProposal(): { state: ConvState; history: ConvMessage[] } {
  const sig = proposalSignature({ activity: ACTIVITY, diet: DIET });
  return {
    state: {
      stage: 'pilot',
      collected: { pilotActivity: ACTIVITY, pilotDiet: DIET },
      stageScratch: { pilot: { proposed: true, proposedSig: sig } },
    } as unknown as ConvState,
    history: [{ role: 'agent', text: 'Want to lock them in, or tweak one?' }],
  };
}

test("GREG'S TURN: asking a question does not reprint the plan", () => {
  const { state, history } = afterFirstProposal();
  const turn = applyRebuildB3Turn(state, history, 'How will I track it?', { text: 'You’ll log it each day on your dashboard.' });
  assert.doesNotMatch(turn.reply, /Here's your week, then/, 'the plan block must not come back');
  assert.match(turn.reply, /log it each day/i, 'the model answers the question he actually asked');
  assert.equal(turn.complete, false);
});

test('and the confirm gate is STILL open afterwards', () => {
  // The fix would be worthless if dodging the repeat also lost the "yes".
  const { state, history } = afterFirstProposal();
  const asked = applyRebuildB3Turn(state, history, 'How will I track it?', { text: 'On your dashboard each day.' });
  const after = applyRebuildB3Turn(asked.state, [...history, { role: 'member', text: 'How will I track it?' }, { role: 'agent', text: asked.reply }], 'lock them in', { text: '' });
  assert.equal(after.complete, true, 'a later yes still commits the plan');
  assert.match(after.reply, /locked in/i);
});

test('a REAL change still earns a fresh proposal', () => {
  // Never trade the loop fix for a silent one: if the model records a different plan, show it.
  const { state, history } = afterFirstProposal();
  const turn = applyRebuildB3Turn(state, history, 'make the eating one veg at dinner instead', {
    text: '', plan: { activityChange: ACTIVITY, dietChange: 'A vegetable at dinner, 5 days this week' },
  } as never);
  assert.match(turn.reply, /vegetable at dinner/i, 'the changed plan is put to them');
});

test('THE LOOP CANNOT RUN: ten non-confirm turns, the plan appears at most once', () => {
  let { state } = afterFirstProposal();
  const history: ConvMessage[] = [{ role: 'agent', text: 'Want to lock them in, or tweak one?' }];
  let printed = 0;
  for (let i = 0; i < 10; i++) {
    const turn = applyRebuildB3Turn(state, history, 'hmm, let me think about it', { text: '' });
    if (/Here's your week, then/.test(turn.reply)) printed++;
    history.push({ role: 'member', text: 'hmm, let me think about it' }, { role: 'agent', text: turn.reply });
    state = turn.state;
  }
  assert.equal(printed, 0, `the already-seen plan was reprinted ${printed}× across ten turns`);
});
