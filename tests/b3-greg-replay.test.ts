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

test('A GATE WITH NO RECORDED SIGNATURE still commits on the member’s confirm', () => {
  // REVERSED 2026-08-07, one day after I wrote the opposite, and worth saying why rather than quietly editing.
  //
  // Yesterday this asserted that a gate carrying `{proposed:true}` with no signature should re-propose ONCE before
  // committing — reasoning that "there is no way to know which plan he was last shown". That reasoning was wrong.
  // A missing signature doesn't mean the artifact is unknown; it means we never fingerprinted it. The artifact is
  // right there in `collected`, unchanged, and it is exactly what generated the proposal the member is answering.
  //
  // So making them say "lock them in" twice bought no safety at all — it just reproduced Greg's complaint for the
  // sake of a caution that protected nothing. Confirm-first (confirmOutranksRerecord) makes this case correct for
  // free. The transitional state it guarded is also 24 hours in the past and empty.
  const state = {
    stage: 'pilot',
    collected: { pilotActivity: ACTIVITY, pilotDiet: DIET },
    stageScratch: { pilot: { proposed: true } }, // pre-fix shape: no proposedSig
  } as unknown as ConvState;
  const history: ConvMessage[] = [{ role: 'agent', text: 'Want to lock them in, or tweak one?' }];

  const turn = applyRebuildB3Turn(state, history, 'lock them in', { text: '' });
  assert.equal(turn.complete, true, 'their word is enough — they are answering a plan they can see');
  assert.match(turn.reply, /locked in/i);
  assert.doesNotMatch(turn.reply, /Here's your week, then/, 'and they are not handed it a second time');
});

test('GREG’S LIVE WALK, 8/7: a model re-record on the confirm turn must not re-propose over him', () => {
  // The exact failure the live walk caught. He was shown the plan, said "Lock them in", and the model called
  // record_plan again on that same turn with a paraphrase of its own capture ("…core work" → "…core work, mixed
  // movements"). The signature moved, change-check-first fired, and he got the plan back. His original complaint,
  // reintroduced by the repair for it. His words outrank the model rewriting its own note.
  const { state, history } = awaitingConfirm();
  const turn = applyRebuildB3Turn(state, history, 'Lock them in.', {
    text: '',
    plan: { activityChange: `${ACTIVITY}, mixed movements`, dietChange: DIET },
  } as never);
  assert.equal(turn.complete, true, 'the confirm wins over the paraphrase');
  assert.doesNotMatch(turn.reply, /Here's your week, then/);
});

test('but a REAL edit on the confirm turn still re-proposes (the expensive direction)', () => {
  // The guard that keeps confirm-first honest: an actual change must never be swallowed by it. "yes but make it 3
  // days" carries a revision tail, so it is not a confirm, and it falls through to the change-check.
  const { state, history } = awaitingConfirm();
  const turn = applyRebuildB3Turn(state, history, 'yes but make it 3 days', {
    text: '',
    plan: { activityChange: ACTIVITY, dietChange: DIET, activityDays: 3 },
  } as never);
  assert.equal(turn.complete, false, 'not committed behind their back');
  assert.match(turn.reply, /3 days/, 'the changed plan is put back to them');
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

// ── the day target (Greg's grid needs a number to close against) ───────────────────────────────────────────────

test('the target rides the EXISTING gate — no second confirm to get wrong', async () => {
  // Greg's sample grid carries "5 days in the week" per row. Capturing it must not add a second propose→confirm
  // step: the loop he actually hit came from gate mechanics, and a second gate is a second chance to build the same
  // bug. So days ride record_plan and appear inside the ONE proposal he already confirms.
  const { applyRebuildB3Turn } = await import('../lib/agent/rebuild.ts');
  const state = { stage: 'pilot', collected: {}, stageScratch: {} } as unknown as ConvState;

  const proposed = applyRebuildB3Turn(state, [], 'both of those', {
    text: '',
    plan: { activityChange: 'Walk 15 minutes', dietChange: 'Fruit at breakfast', activityDays: 5, dietDays: 6 },
  } as never);
  assert.match(proposed.reply, /Walk 15 minutes — 5 days/, "the member's own number, in the proposal");
  assert.match(proposed.reply, /Fruit at breakfast — 6 days/);
  assert.equal(proposed.complete, false, 'proposing is still not completing');

  const done = applyRebuildB3Turn(proposed.state, [], 'lock them in', { text: '' });
  assert.equal(done.complete, true, 'and the SAME single confirm still commits');
  assert.equal(done.state.collected?.pilotActivityDays, 5, 'the target survives to the commit');
  assert.equal(done.state.collected?.pilotDietDays, 6);
});

test('CHANGING JUST THE NUMBER re-proposes — it must not slip through silently', async () => {
  // The expensive direction: a member says "make it 4 days", the plan changes, and they never see it put back to
  // them. The day targets are in the proposal signature precisely to stop that.
  const { applyRebuildB3Turn } = await import('../lib/agent/rebuild.ts');
  const first = applyRebuildB3Turn({ stage: 'pilot', collected: {}, stageScratch: {} } as unknown as ConvState, [], 'yes', {
    text: '', plan: { activityChange: 'Walk 15 minutes', dietChange: 'Fruit at breakfast', activityDays: 5, dietDays: 5 },
  } as never);
  const changed = applyRebuildB3Turn(first.state, [], 'make the walking 3 days', {
    text: '', plan: { activityChange: 'Walk 15 minutes', dietChange: 'Fruit at breakfast', activityDays: 3, dietDays: 5 },
  } as never);
  assert.match(changed.reply, /Walk 15 minutes — 3 days/, 'the changed plan is put back to them');
  assert.equal(changed.complete, false);
});

test('a member who WON’T pick a number still commits a plan', async () => {
  // The target is optional at every layer. Blocking a commitment on a number they declined to give would turn a
  // nicety into a gate — the exact trap CAT-36 was about.
  const { applyRebuildB3Turn } = await import('../lib/agent/rebuild.ts');
  const proposed = applyRebuildB3Turn({ stage: 'pilot', collected: {}, stageScratch: {} } as unknown as ConvState, [], 'both', {
    text: '', plan: { activityChange: 'Walk 15 minutes', dietChange: 'Fruit at breakfast' },
  } as never);
  assert.doesNotMatch(proposed.reply, /\bdays\b/, 'no invented "5 days" they never chose');
  const done = applyRebuildB3Turn(proposed.state, [], 'yes', { text: '' });
  assert.equal(done.complete, true);
  assert.equal(done.state.collected?.pilotActivityDays, undefined);
});

test('a nonsense target is dropped, and the plan is unharmed', async () => {
  const { parseB3Model } = await import('../lib/agent/rebuild.ts');
  for (const bad of [0, 8, 99, -1, 3.5, 'lots']) {
    const t = parseB3Model([{ type: 'tool_use', name: 'record_plan', input: { activityChange: 'Walk', activityDays: bad } }] as never);
    assert.equal(t.plan?.activityChange, 'Walk', `the change survives a bad target (${bad})`);
    assert.equal(t.plan?.activityDays, undefined, `${bad} is not a day count for a seven-day week`);
  }
  const good = parseB3Model([{ type: 'tool_use', name: 'record_plan', input: { activityChange: 'Walk', activityDays: 5 } }] as never);
  assert.equal(good.plan?.activityDays, 5);
});
