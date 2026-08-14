import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReconnectTurn } from '../lib/agent/reconnect.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// A STAGE TRANSITION CLEARS THE CONFIRM GATE — and the §2d Window beat that proved why.
//
// When a handler changes b.stage it has just emitted the NEW stage's opener. Nothing is pending a check across
// that seam, so the member's next message must reach the new stage's gather(), never its confirm().
//
// THE BUG THIS PINS. drift's confirm() hands into The Window, but it never reset awaitingConfirm — six of
// Reconnect's seven transitions didn't. So the member's FIRST answer to the Window opener (their actual Tuesday
// vision) was dispatched to windowStage.confirm(). When it read as assent, the Window CLOSED IMMEDIATELY: the
// entire visioning beat was skipped, and because driftPayload had just been cleared by drift's own commit, there
// was no payload to queue — so "The spark" keeper was lost without a trace.
//
// It surfaced only in a live walk (Jennifer, 2026-08-09) because it needs the member's opening Tuesday line to
// read as affirmative — which is exactly what a hopeful answer to "how do you wake up?" tends to do. The walk
// ended with one keeper where there should have been two.
//
// The fix is in the KERNEL (runArcTurn), not in each handler: the transition sites were one fact written seven
// times, and six copies were already wrong.
// ============================================================================================================

const collected = { doors: ['grind'], reclaimList: ['ride again'] };
const history = (): ConvMessage[] => [
  { role: 'agent', text: 'and how far did that run?' },
  { role: 'member', text: 'a couple of years' },
];

test('drift → window · the confirm gate does NOT leak across the seam', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'I stopped riding and stopped noticing', collected };
  const handoff = applyReconnectTurn(pending, history(), "yeah, that's the shape of it", { text: '', replyIntent: 'done' });

  assert.equal(handoff.state.stage, 'window', 'it hands into The Window');
  assert.equal(handoff.state.awaitingConfirm ?? false, false, 'and arrives with NOTHING pending a confirm');
});

test("drift → window · an AFFIRMATIVE first Tuesday answer is drawn out, not swallowed as a confirm", () => {
  // THE REGRESSION. Before the fix this closed the Window on the spot and dropped the spark keeper.
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'I stopped riding', collected };
  const handoff = applyReconnectTurn(pending, history(), "yeah, that's exactly it", { text: '', replyIntent: 'done' });

  const vision = 'I wake up without feeling behind, and I reach for the book instead of my phone';
  const next = applyReconnectTurn(
    handoff.state as ConvState,
    [...history(), { role: 'member', text: "yeah, that's exactly it" }, { role: 'agent', text: handoff.reply }],
    vision,
    { text: 'Tell me more about that morning.', replyIntent: 'done' },
  );

  assert.equal(next.state.stage, 'window', 'still IN the Window — the beat was not skipped');
  assert.doesNotMatch(next.reply, /that's the spark/i, 'it did not close on her first sentence');
  // And the vision is held as keeper material rather than thrown away.
  assert.equal(next.state.driftPayload, vision, "her Tuesday is captured for the spark keeper");
});

test('the drift keeper still commits on the way through — the fix did not cost the good path', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'I stopped riding and stopped noticing', collected };
  const handoff = applyReconnectTurn(pending, history(), "yeah, that's the shape of it", { text: '', replyIntent: 'done' });
  const queued = (handoff.state as { pendingHarvest?: { label: string; payloadRef: string }[] }).pendingHarvest ?? [];
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.label, 'The Fade'); // the protected term — "the drift" was an off-canon second name for it
  assert.equal(queued[0]!.payloadRef, 'I stopped riding and stopped noticing');
});
