// Greg's exact B3 exchange, replayed through the real arc.
//
// From his screenshot, 2026-08-06:
//
//   Companion:  "…Want to lock them in, or tweak one?"
//   Greg:       "lock in"
//   Companion:  "No problem — tell me what you'd change, and we'll adjust it."      ← the dead end
//   Greg:       "How will I track it?"
//   Companion:  [re-proposes the entire plan, verbatim]
//
// The predicate has its own coverage in confirm-corpus.test.ts. This is the SEAM: the predicate can be right while
// the stage still does the wrong thing with it. Both of Greg's turns go through applyRebuildB3Turn, and both
// assertions are about what he would actually have READ.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRebuildB3Turn } from '../lib/agent/rebuild.ts';
import { proposalSignature } from '../lib/agent/coach-gate.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// His plan, verbatim from the screenshot.
const ACTIVITY = '15 minutes of functional fitness exercise, 5 days this week, mixing up the type of movement each day';
const DIET = 'Adding a piece of fruit with breakfast, 5 days this week';

/** The state the arc is in the moment the plan has been proposed and it's waiting on him.
 *  Per-stage scratch persists under `stageScratch[stageId]` — NOT a top-level `scratch`. Getting that wrong makes
 *  the arc re-propose the plan instead of entering the confirm branch, so every assertion here passes or fails for
 *  the wrong reason. (It did, on the first run of this file.) */
function awaitingConfirm(): { state: ConvState; history: ConvMessage[] } {
  const state = {
    stage: 'pilot',
    collected: { pilotActivity: ACTIVITY, pilotDiet: DIET },
    // `proposedSig` records WHICH plan was put to him, so the engine never prints one he's already seen
    // (coach-gate.ts). A gate opened before that shipped has `proposed` but no signature — see the migration
    // test below for what that member experiences.
    stageScratch: { pilot: { proposed: true, proposedSig: proposalSignature({ activity: ACTIVITY, diet: DIET }) } },
  } as unknown as ConvState;
  return { state, history: [{ role: 'agent', text: 'Want to lock them in, or tweak one?' }] };
}

test('A SESSION ALREADY AT THE GATE WHEN THIS SHIPPED: one more proposal, then correct', () => {
  // Jay was mid-C3 with `{ proposed: true }` and no signature when the fix deployed. There is no way to know
  // which plan he was last shown, so the honest move is to show it once — which is what a returning member
  // needs anyway — and record the signature. From the next turn on, the loop is closed. Deliberate, not
  // accidental: the alternative is assuming he saw something he may not have.
  const state = {
    stage: 'pilot',
    collected: { pilotActivity: ACTIVITY, pilotDiet: DIET },
    stageScratch: { pilot: { proposed: true } }, // pre-fix shape: no proposedSig
  } as unknown as ConvState;
  const history: ConvMessage[] = [{ role: 'agent', text: 'Want to lock them in, or tweak one?' }];

  const first = applyRebuildB3Turn(state, history, 'lock them in', { text: '' });
  assert.match(first.reply, /Here's your week, then/, 'the one re-orienting proposal');

  const after = applyRebuildB3Turn(first.state, [...history, { role: 'agent', text: first.reply }], 'lock them in', { text: '' });
  assert.equal(after.complete, true, 'and from here it commits — the loop does not resume');
});

test('the fixture really is at the confirm gate (guard against a false pass)', () => {
  // If this ever re-proposes the plan instead, every other test in this file is meaningless.
  const { state, history } = awaitingConfirm();
  const turn = applyRebuildB3Turn(state, history, 'lock in', { text: '' });
  assert.doesNotMatch(turn.reply, /Here's your week, then/, 'the arc re-proposed — the fixture is not at the gate');
});

test('"lock in" LOCKS IT IN — the words the Companion itself offered', () => {
  const { state, history } = awaitingConfirm();
  const turn = applyRebuildB3Turn(state, history, 'lock in', { text: '' });
  assert.equal(turn.complete, true, 'Greg said yes; the session must close, not reopen');
  assert.match(turn.reply, /locked in/i, `he read: "${turn.reply}"`);
  assert.doesNotMatch(turn.reply, /tell me what you'?d change/i, 'the dead end that cost him the session');
});

test('the other natural phrasings of the same answer also land', () => {
  for (const yes of ['lock them in', 'locked in', 'yes', 'go ahead', "let's do it", 'looks good']) {
    const { state, history } = awaitingConfirm();
    const turn = applyRebuildB3Turn(state, history, yes, { text: '' });
    assert.equal(turn.complete, true, `"${yes}" should commit the plan`);
  }
});

test('a real tweak STILL reopens — the fix must not swallow a change', () => {
  // The expensive direction at this gate: committing a plan he asked to alter. hasRevisionTail guards it.
  for (const tweak of ['yes but make it 3 days', 'can we change the fruit one', "actually I'd prefer mornings"]) {
    const { state, history } = awaitingConfirm();
    const turn = applyRebuildB3Turn(state, history, tweak, { text: '' });
    assert.equal(turn.complete, false, `"${tweak}" is a change — must not commit`);
  }
});

test('HIS SECOND MESSAGE: a question is not a confirm', () => {
  // "How will I track it?" must not commit the plan. What the gate SHOULD do with a question is still an open
  // design item (today it reopens the coaching, which is why he saw the plan again) — but reading it as agreement
  // would be worse: it would close the session on a question he asked in good faith.
  const { state, history } = awaitingConfirm();
  const turn = applyRebuildB3Turn(state, history, 'How will I track it?', { text: '' });
  assert.equal(turn.complete, false, 'asking how to do the thing is not agreeing to it');
});
