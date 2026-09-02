// A DOOR SHE TAPPED IS NOT OURS TO DELETE.
//
// The gate, 2026-09-02. The Companion said, in its own words:
//
//   "So it isn't one door or the other. The cliff opened it, and The Load-Bearer walked in through the opening.
//    Let me add that alongside the career one, so the record holds both — the way you just told it."
//
// She agreed. The engine then removed The Career Cliff — which she had marked on the board minutes earlier as both
// FIRST and BIGGEST — and the closing line read her back a count the record no longer held.
//
// WHAT ACTUALLY WENT WRONG. The engine did exactly what it was told: the model tagged the proposal 'correct' (a
// swap) while its prose promised an add. Its sentence and its tool call disagreed, and only one of them is
// machine-readable.
//
// WHY THE FIX IS NARROW. Reading the model's prose to decide what it meant is the inference that got
// stage-agreement reverted for reciting a member's protest back to her as a goal. So this does not read prose. It
// uses the one thing on that screen that is not a reading of anything: she tapped cards and said THESE are mine.
// A re-seeing may promote a truer Door ahead of hers. It may not take hers out of her own record.
//
// AND MY FIRST ATTEMPT WAS TOO BROAD — three tests said so. I made every inferred correction non-destructive,
// which also broke the ordinary case: a correction on a Door she never marked SHOULD swap in place. The tests
// encoding that were right and I nearly rewrote them to fit my change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const reseeing = (over: Partial<Collected>, kind: 'correct' | 'widen' = 'correct', flatMislabel = false): ConvState => ({
  stage: 'doors',
  awaitingConfirm: true,
  pendingRevision: { fromSlug: 'career_cliff', toSlug: 'load_bearer', kind, ...(flatMislabel && { flatMislabel }) },
  collected: { identityNoun: 'Conductor', doors: ['career_cliff', 'aging_parents'], ...over } as Collected,
} as unknown as ConvState);

const confirm = (state: ConvState) =>
  (applyReconnectTurn(state, [], "yes — that's truer", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC)
    .state.collected as Collected).doors ?? [];

test('a Door she MARKED survives an inferred re-seeing — the truer one leads, hers is kept', () => {
  const doors = confirm(reseeing({ doorsMarked: ['career_cliff', 'aging_parents'] as never }));
  assert.ok(doors.includes('load_bearer' as never), 'the truer Door is added');
  assert.equal(doors[0], 'load_bearer', 'and leads, because she agreed it was truer');
  assert.ok(doors.includes('career_cliff' as never), 'and the Door SHE tapped is still in her record');
});

test('a Door she never marked still swaps in place — the ordinary case is untouched', () => {
  // The behaviour three existing tests protect, and they were right. Without a board there is no structured
  // statement to defend, and a re-seeing she confirms should replace the Door rather than clutter her set.
  const doors = confirm(reseeing({}));
  assert.ok(!doors.includes('career_cliff' as never), 'unmarked → the correction swaps');
  assert.ok(doors.includes('load_bearer' as never));
});

test('a FLAT MISLABEL swaps even when she marked it — because that is her own correction', () => {
  // flatMislabel is set when the member explicitly says we got the label wrong ("no, I meant the divorce"). That
  // is her words, not our reading, and it must be able to remove a Door she tapped. Otherwise the board becomes a
  // thing she cannot take back.
  const doors = confirm(reseeing({ doorsMarked: ['career_cliff'] as never }, 'correct', true));
  assert.ok(!doors.includes('career_cliff' as never), 'she corrected it herself — it goes');
  assert.ok(doors.includes('load_bearer' as never));
});

test('the board records what she tapped', () => {
  // The protection is only as good as the record it reads. If this stops being written, the guard above silently
  // stops guarding — the failure mode this whole week has been about.
  const at: ConvState = { stage: 'doors', collected: { identityNoun: 'Conductor', doors: [] } as Collected } as ConvState;
  const out = applyReconnectTurn(at, [],
    '[board] door:career_cliff=4 door:loss=4 first:career_cliff biggest:career_cliff open:career_cliff',
    { text: '' }, RECONNECT_R2_ARC);
  const marked = (out.state.collected as Collected).doorsMarked ?? [];
  assert.ok(marked.includes('career_cliff' as never), 'her taps are recorded');
  assert.ok(marked.includes('loss' as never));
});

// ── THE DOUBLE-BACK ──────────────────────────────────────────────────────────────────────────────────────────
//
// Donna hit this twice ("I clicked That's It button and it kept coming back"; the Companion's own "I doubled back
// when we were already done") and Marie twice more ("You already asked me about The Load-Bearer. We finished it").
// Three days, three walkers, and I was wrong about the cause twice before the queue log showed it:
//
//   bank career_cliff  → next=aging_parents
//   bank aging_parents → next=loss            ← "Then let's take The Loss" goes on screen
//   bank VANISHING     → next=loss            ← and again
//
// A re-seeing inserted a Door at the FRONT of the set mid-excavation. bankWalkedDoor asked "which Door is first
// unwalked?" instead of "which Door did I open?", got the newcomer, and the queue offered the announced Door a
// second time. Ordering is a legitimate thing for a re-seeing to change; re-pointing a walk in progress is not.
import { nextDoorToExcavate } from '../lib/agent/reconnect.ts';

test('a Door inserted mid-excavation does not make the engine re-announce the current one', () => {
  // Open a Door, then let a re-seeing put a different one at the front before she confirms.
  const opened: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Conductor', doors: ['career_cliff', 'loss'], doorsExcavated: ['career_cliff'] } as Collected,
    stageScratch: { doors: { openedDoor: 'loss' } },
  } as unknown as ConvState;

  // The re-seeing lands first: 'vanishing' jumps to the front of the set.
  (opened.collected as Collected).doors = ['vanishing', 'career_cliff', 'loss'] as never;

  const out = applyReconnectTurn(opened, [], "yes, that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  const excavated = (out.state.collected as Collected).doorsExcavated ?? [];

  assert.ok(excavated.includes('loss' as never),
    'the Door on screen must be the Door banked — otherwise it gets announced again');
  assert.ok(!excavated.includes('vanishing' as never),
    'and a Door she has not been asked about yet must not be marked walked');
});

test('the queue still advances normally when nothing jumps the line', () => {
  const at: ConvState = {
    stage: 'doors', awaitingConfirm: true,
    collected: { identityNoun: 'Conductor', doors: ['career_cliff', 'loss'] } as Collected,
  } as unknown as ConvState;
  const out = applyReconnectTurn(at, [], "yes, that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  const c = out.state.collected as Collected;
  assert.deepEqual(c.doorsExcavated, ['career_cliff'], 'banks the first');
  assert.equal(nextDoorToExcavate(c), 'loss', 'and moves to the next');
});
