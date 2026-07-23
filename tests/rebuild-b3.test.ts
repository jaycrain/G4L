import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB3Opening, applyRebuildB3Turn, composePilotPlan } from '../lib/agent/rebuild.ts';
import { practicePrompt } from '../lib/practice/store.ts';
import type { ConvState, ModelTurn } from '../lib/agent/onboarding.ts';

// B3 · The Lifestyle Pilot (COACH mode). The model owns the conversation; the engine holds the plan-COMPLETENESS
// contract — it never completes until BOTH changes are locked (model's judgment, via model.plan) and the member
// CONFIRMS. Driven offline by synthetic ModelTurns (the replay pattern — no API).

const m = (text: string, plan?: ModelTurn['plan']): ModelTurn => ({ text, ...(plan ? { plan } : {}) });
const step = (state: ConvState, msg: string, model: ModelTurn) => applyRebuildB3Turn(state, [], msg, model);

test('B3 · opens into the pilot, movement first', () => {
  const t = rebuildB3Opening();
  assert.equal(t.state.stage, 'pilot');
  assert.match(t.reply, /Lifestyle Pilot/i);
  assert.match(t.reply, /start with movement/i);
  assert.equal(t.complete, false);
});

test('B3 · the completeness contract — no complete until BOTH changes locked AND confirmed', () => {
  let t = rebuildB3Opening();

  // Turn 1: member vague, model coaches (no lock) → still coaching, not complete.
  t = step(t.state, 'I want to move more', m('How many days a week feels doable?'));
  assert.equal(t.complete, false);
  assert.match(t.reply, /how many days/i, "the model's coaching question is the reply");

  // Turn 2: model LOCKS the activity change; diet still missing → still coaching (model's next question).
  t = step(t.state, 'a 10-minute walk after dinner, 3 days', m('Great. Now one small change to how you eat?', { activityChange: 'a 10-minute walk after dinner, 3 days' }));
  assert.equal(t.complete, false);
  assert.equal(t.state.collected?.pilotActivity, 'a 10-minute walk after dinner, 3 days', 'activity captured');
  assert.equal(t.state.collected?.pilotDiet, undefined, 'diet not yet');
  assert.match(t.reply, /how you eat/i);

  // Even if the member says "yes" now, it must NOT complete — the plan isn't whole.
  const premature = step(t.state, 'yes', m('Take your time — what could you try?'));
  assert.equal(premature.complete, false, 'never completes on an incomplete plan');

  // Turn 3: model LOCKS the diet change → both present → engine PROPOSES the whole plan (not the model text).
  t = step(t.state, 'add a vegetable at dinner', m('', { dietChange: 'a vegetable at dinner, 5 days' }));
  assert.equal(t.complete, false, 'proposing is not completing');
  assert.match(t.reply, /a 10-minute walk after dinner/i, 'the proposal reflects the activity change');
  assert.match(t.reply, /a vegetable at dinner/i, 'and the diet change');
  assert.match(t.reply, /lock them in|tweak/i, 'the confirm gate');

  // Turn 4: member CONFIRMS → complete.
  t = step(t.state, 'yes, lock it in', m(''));
  assert.equal(t.complete, true, 'confirm completes');
  assert.equal(t.state.stage, 'complete');
  assert.match(t.reply, /Locked in/i);
  assert.equal(t.state.collected?.pilotActivity, 'a 10-minute walk after dinner, 3 days');
  assert.equal(t.state.collected?.pilotDiet, 'a vegetable at dinner, 5 days');
});

test('B3 · "Lock them in" (the chip for two changes) confirms — not treated as a tweak', () => {
  let t = rebuildB3Opening();
  t = step(t.state, 'a 10-minute walk after dinner, 3 days', m('And one small change to how you eat?', { activityChange: 'a 10-minute walk after dinner, 3 days' }));
  t = step(t.state, 'a vegetable at dinner', m('', { dietChange: 'a vegetable at dinner, 5 days' })); // → proposal
  assert.equal(t.complete, false);
  // The exact reply the UI sends for two changes — must complete, not re-open coaching.
  t = step(t.state, 'Lock them in', m(''));
  assert.equal(t.complete, true, '"Lock them in" is a confirm');
  assert.equal(t.state.stage, 'complete');
});

test('B3 · locking the activity on a TERMINAL line does not dead-end — the eating change is carried forward', () => {
  // Jay's walk (2026-07-23): the member affirmed the walk, the model locked it and said only "Great, locking that in."
  // with no next question, and the thread just stopped — a dead end with the eating change still waiting. The engine
  // must carry the turn forward to the open change.
  let t = rebuildB3Opening();
  t = step(t.state, '2-3 and about 30 minutes each', m('Great, locking that in.', { activityChange: 'a 30-minute morning walk, 2-3 days' }));
  assert.equal(t.complete, false, 'one change is not a whole plan');
  assert.equal(t.state.collected?.pilotActivity, 'a 30-minute morning walk, 2-3 days', 'activity locked');
  assert.equal(t.state.collected?.pilotDiet, undefined, 'diet still open');
  assert.match(t.reply, /how you eat/i, 'the turn pivots to the eating change instead of dead-ending');
  assert.match(t.reply, /locking that in/i, "the model's acknowledgment is kept");
});

test('B3 · when the model already pivots to eating in its own line, the engine does not double-ask', () => {
  let t = rebuildB3Opening();
  // Model locks activity AND asks the eating question in the same reply — the scripted beat must be suppressed.
  t = step(t.state, 'a 10-minute walk after dinner', m('Locked in. Now — what small change to how you eat feels doable?', { activityChange: 'a 10-minute walk after dinner' }));
  assert.equal(t.complete, false);
  assert.doesNotMatch(t.reply, /an upgrade rather than an overhaul/i, 'the scripted eating nudge is not appended on top of the model’s own question');
  assert.match(t.reply, /how you eat/i, "the model's own pivot stands");
});

test('B3 · revising after the proposal re-opens coaching, then confirm completes', () => {
  let t = rebuildB3Opening();
  t = step(t.state, 'walk', m('', { activityChange: 'a 15-minute walk, 4 days' }));
  t = step(t.state, 'more veg', m('', { dietChange: 'a vegetable at dinner' })); // both locked → proposes
  assert.match(t.reply, /lock it in|tweak/i);

  // Member tweaks instead of confirming → re-open coaching (not complete).
  t = step(t.state, 'actually make the walk 10 minutes', m('Sure — 10 minutes it is. Anything else?'));
  assert.equal(t.complete, false, 'a tweak does not complete');
  assert.match(t.reply, /10 minutes/i, "the model's revision reply");

  // Model re-locks the corrected activity → both present again → re-propose.
  t = step(t.state, 'that works', m('', { activityChange: 'a 10-minute walk, 4 days' }));
  assert.match(t.reply, /a 10-minute walk, 4 days/i, 're-proposed with the corrected change');

  // Confirm → complete.
  t = step(t.state, 'perfect', m(''));
  assert.equal(t.complete, true);
  assert.equal(t.state.collected?.pilotActivity, 'a 10-minute walk, 4 days');
});

test('B3 · empty model text falls back to a coaching nudge (never a blank reply)', () => {
  let t = rebuildB3Opening();
  t = step(t.state, 'hi', m('')); // model returned nothing, no lock
  assert.ok(t.reply.trim().length > 0, 'never blank');
  assert.match(t.reply, /movement/i, 'nudges toward the movement change');
});

test('composePilotPlan · one keeper body, both changes, member words', () => {
  const body = composePilotPlan('a 10-minute walk after dinner', 'a vegetable at dinner');
  assert.match(body, /Movement — a 10-minute walk after dinner/);
  assert.match(body, /Eating — a vegetable at dinner/);
});

test('practicePrompt · b3_pilot is plan-aware, degrades gracefully', () => {
  const withPlan = practicePrompt('b3_pilot', { plan: { activityChange: 'A 10-min walk', dietChange: 'A veg at dinner' } });
  assert.match(withPlan!, /a 10-min walk/i, 'names the activity change');
  assert.match(withPlan!, /a veg at dinner/i, 'names the diet change');
  assert.doesNotMatch(withPlan!, /missed|failed/i, 'non-judgmental');
  const noPlan = practicePrompt('b3_pilot', {});
  assert.match(noPlan!, /two changes/i, 'degrades to a generic ask');
});
