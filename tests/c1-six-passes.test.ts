// C1 RUNS GREG'S SIX REVISION PASSES, AND COMMITS AS IT GOES.
//
// C1.md:495 specifies seven stages — engagement, then six passes over the Reclaim List. We shipped ONE open
// coaching turn that asked the model to settle the whole refinement and hand back a rewritten list.
//
// Jay, 2026-08-29, on the contract: "one change at a time" and "commit as you go."
//
// THIS IS THE MEMBER'S MOST PROTECTED DATA. The Reclaim List is what every other surface points at, and a lost
// item is the one failure we cannot detect afterwards — the evidence is the thing that went missing. So the
// assertions here are mostly about what must NOT happen: no change without a confirm, no change to an item the
// model invented, no silent drop, no partial reorder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reclaimC1PassesOpening, applyReclaimC1PassesTurn, RECLAIM_C1_PASSES_ARC,
  groundListChange, applyListChange,
} from '../lib/agent/reclaim.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const LIST = ['gravel races', 'ride with friends', 'sleep like I used to', 'read again'];
const open = () => reclaimC1PassesOpening([...LIST]);
const say = (t: Turn, msg: string, model: Record<string, unknown> = {}) =>
  applyReclaimC1PassesTurn(t.state as ConvState, [], msg, { text: 'Mm.', ...model } as never);
const listOf = (t: Turn) => (t.state as ConvState).collected.reclaimList ?? [];

test('C1 opens on Greg’s stage 1 — the frame and the stance, not the first question', () => {
  const t = open();
  assert.equal((t.state as ConvState).stage, 'c1-open');
  assert.match(t.reply, /list you made in Reconnect/i, 'it names what they are looking at');
  // THE STANCE IS THE LOAD-BEARING LINE (C1.md:495 — "refinement not correction"). Without it a member reads six
  // passes over their own list as a test they are failing.
  assert.match(t.reply, /not to check whether you stuck to it/i, 'refinement, not correction');
  assert.match(t.reply.trim(), /\?$/, 'and it ends on a question they answer in words');
});

test('all six of Greg’s passes run, in his order', () => {
  assert.deepEqual(RECLAIM_C1_PASSES_ARC.stageOrder, [
    'c1-open', 'c1-enduring', 'c1-deprioritise', 'c1-borrowed', 'c1-concrete', 'c1-emergent', 'c1-reorder', 'c1-close',
  ]);
});

test('a change is PROPOSED, never applied on the turn it is recorded', () => {
  // The whole gate. A model that records a drop and an engine that applies it in the same turn is a member
  // finding an item gone from their list without having agreed to it.
  let t = say(open(), 'It reads differently now.');
  assert.equal((t.state as ConvState).stage, 'c1-enduring');
  const proposed = say(t, 'The reading one has gone.', { listChange: { op: 'drop', target: 'read again' } });
  assert.deepEqual(listOf(proposed), LIST, 'the list is UNCHANGED at the moment of proposing');
  assert.match(proposed.reply, /Take “read again” off the list\?/, 'and the member is shown exactly what will happen');
  assert.equal((proposed.state as ConvState).awaitingConfirm, true);
});

test('and applied only on a confirm — which commits immediately, not at the end', () => {
  let t = say(open(), 'It reads differently now.');
  t = say(t, 'The reading one has gone.', { listChange: { op: 'drop', target: 'read again' } });
  const committed = say(t, 'Yes, take it off.');
  assert.deepEqual(listOf(committed), ['gravel races', 'ride with friends', 'sleep like I used to']);
  // COMMIT AS YOU GO (Jay): a member who stops here keeps this change. The alternative — one confirmation at the
  // end — loses everything if they leave mid-Session, which is the likelier event in a Session this long.
  assert.notEqual((committed.state as ConvState).stage, 'complete', 'and the Session carries on');
});

test('a decline drops the proposal — it does not sit there waiting to be applied later', () => {
  // The failure this prevents: a member says "no, leave it" to a removal, keeps talking, and two turns later a
  // stale pending change gets committed by a reply that happens to read as a yes.
  let t = say(open(), 'It reads differently.');
  t = say(t, 'Maybe the reading one.', { listChange: { op: 'drop', target: 'read again' } });
  t = say(t, 'No, actually leave that one.');
  assert.deepEqual(listOf(t), LIST, 'nothing was removed');
  const later = say(t, 'Yes, that sounds right.');
  assert.deepEqual(listOf(later), LIST, 'and a later yes cannot commit the change they declined');
});

test('the model cannot touch an item that is not on the list', () => {
  // GROUNDING IS THE SAFETY PROPERTY. The model half-remembers, paraphrases, and invents; the engine has to find
  // the exact item or refuse. A fuzzy match would silently retarget a deletion onto the wrong goal, which is
  // worse than refusing. [[their-own-words-back]]
  let t = say(open(), 'It reads differently.');
  const invented = say(t, 'Drop the cycling one.', { listChange: { op: 'drop', target: 'do more cycling' } });
  assert.deepEqual(listOf(invented), LIST);
  assert.notEqual((invented.state as ConvState).awaitingConfirm, true, 'nothing was proposed at all');
});

test('grounding, directly — every op refuses what it cannot verify', () => {
  assert.equal(groundListChange({ op: 'drop', target: 'not on the list' }, LIST), null);
  assert.deepEqual(groundListChange({ op: 'drop', target: 'Gravel Races' }, LIST), { op: 'drop', target: 'gravel races' },
    'case and whitespace are forgiven; the words are not');
  assert.equal(groundListChange({ op: 'reword', target: 'read again', text: 'read again' }, LIST), null,
    'a reword to the same words is a no-op and must not be proposed');
  assert.equal(groundListChange({ op: 'add', text: 'gravel races' }, LIST), null, 'an add that duplicates is refused');
  // A PARTIAL REORDER IS INDISTINGUISHABLE FROM A REORDER THAT DROPS WHAT IT FORGOT — the exact silent loss this
  // contract exists to make impossible.
  assert.equal(groundListChange({ op: 'reorder', order: ['read again', 'gravel races'] }, LIST), null);
  assert.deepEqual(
    groundListChange({ op: 'reorder', order: [...LIST].reverse() }, LIST),
    { op: 'reorder', order: [...LIST].reverse() },
  );
});

test('apply is pure and returns a new array', () => {
  // An in-place mutation does not survive the wire — the engine's `collected` is shallow-copied, so only a
  // REPLACEMENT crosses back. That cost a whole beat once. [[mutating-state-vanishes-over-the-wire]]
  const before = [...LIST];
  const after = applyListChange(LIST, { op: 'drop', target: 'read again' });
  assert.deepEqual(LIST, before, 'the input is untouched');
  assert.notEqual(after, LIST);
});

test('a pass can legitimately change nothing, and says so by moving on', () => {
  // "No, they all still matter" is a complete answer to pass one. A beat that cannot hear that teaches the
  // member the way out is to invent an edit — on their own Reclaim List.
  let t = say(open(), 'It reads differently.');
  assert.equal((t.state as ConvState).stage, 'c1-enduring');
  t = say(t, "They all still matter, let's move on");
  assert.equal((t.state as ConvState).stage, 'c1-deprioritise', 'it advanced with nothing changed');
  assert.deepEqual(listOf(t), LIST);
});

test('a whole walk reaches the close, and every committed change survives it', () => {
  let t = say(open(), 'It reads differently now.');
  t = say(t, 'Still the racing.', { listChange: { op: 'reword', target: 'gravel races', text: 'ride Big Sugar' } });
  t = say(t, 'Yes, that is better.');
  for (let i = 0; i < 4; i++) t = say(t, 'Nothing to change there, move on');
  t = say(t, 'Sleep at the top.', { listChange: { op: 'reorder', order: ['sleep like I used to', 'ride Big Sugar', 'ride with friends', 'read again'] } });
  t = say(t, 'Yes.');
  assert.equal((t.state as ConvState).stage, 'c1-close');
  const done = say(t, 'Sleeping properly, definitely.');
  assert.equal(done.complete, true);
  assert.deepEqual(listOf(done), ['sleep like I used to', 'ride Big Sugar', 'ride with friends', 'read again'],
    'the reword and the reorder both survived to the close');
  assert.match(done.reply, /refined — not corrected/i);
});
