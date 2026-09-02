import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReconnectTurn } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// W-35 (receive-before-you-move) — the Doors-excavation → IDQ handoff must RECEIVE the member's final answer
// before the scripted IDQ frame. The deterministic administered opener used to clobber what they just said
// (the founder answered a weighty question and got the cold "let's shift to something lighter" frame).
// ============================================================================================================

// UPDATED 2026-08-27: the Doors beat now has one more turn before the IDQ — Greg's fourth reflection question
// ("what does recognising these Doors change about how you see your own Fade"), which his R1 spec always asked
// for and we had never built. So `done` no longer lands on measurement; it asks, and the ANSWER lands there.
// The handoff contract these tests exist to protect is unchanged — it just happens one beat later.
const atInsightConfirm: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Rider', doors: ['grind'] } };

// UPDATED AGAIN 2026-08-28: there is now a BREAK at this seam — Greg's own docs specify pacing and a soft daily
// cap and never describe Reconnect as one sitting, and Jay and Donna both hit the same unbroken run. So `done`
// + the meaning answer lands on the break, and the stage advances to measurement when she says to carry on.
//
// W-35 IS UNCHANGED AND STILL THE POINT: whatever the second beat is, the member's final answer is received
// FIRST. The test now proves that across the extra turn rather than being deleted for having moved.
test('W-35 · the handoff LEADS with the model’s acknowledgment, then the R2 close', () => {
  const ack = 'Twelve years — that’s a long time to have carried it, and you named it plainly.';
  const asked = applyReconnectTurn(atInsightConfirm, [], 'about twelve years', { text: ack, replyIntent: 'done' });
  const turn = applyReconnectTurn(asked.state, [], 'It means I can stop pretending it was nothing.', { text: ack });
  // R2 ENDS HERE NOW (2026-08-28). The interim in-conversation break that briefly lived at this seam is gone —
  // Reconnect is three Sessions and a Checkpoint, so this is a Session CLOSE and the dashboard comes next.
  assert.equal(turn.complete, true, 'the Doors Session closes');
  assert.ok(turn.reply.startsWith(ack), 'receives their final answer FIRST — W-35, unchanged');
  assert.match(turn.reply, /back through every Door you named/i, 'then names what was done');
  assert.match(turn.reply, /Drift Quiz/i, 'and what the next Session is');
  assert.ok(turn.reply.indexOf('carried it') < turn.reply.indexOf('back through every Door'), 'receive before the frame');
});

test('W-35 · graceful — no model acknowledgment → the break stands alone (no stray separator)', () => {
  const asked = applyReconnectTurn(atInsightConfirm, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  const turn = applyReconnectTurn(asked.state, [], 'It means I stopped calling it laziness.', { text: '' });
  assert.equal(turn.state.stage, 'doors');
  assert.ok(turn.reply.startsWith("You've been back through every Door"), 'opens cleanly on the break');
  assert.doesNotMatch(turn.reply, /^\s*\n/, 'no leading blank separator when there is nothing to receive');
});

test('the R2 close ends the Session — leaving is now a property of the boundary, not a beat inside it', () => {
  const asked = applyReconnectTurn(atInsightConfirm, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  const turn = applyReconnectTurn(asked.state, [], 'It means I stopped calling it laziness.', { text: '' });
  assert.equal(turn.complete, true, 'the Session is over; she is returned to the dashboard');
  assert.doesNotMatch(turn.reply, /keep going|pick this up later/i, 'no in-conversation break survives the split');
});
