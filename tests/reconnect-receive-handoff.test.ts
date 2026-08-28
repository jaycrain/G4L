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
test('W-35 · the handoff LEADS with the model’s acknowledgment, then the break', () => {
  const ack = 'Twelve years — that’s a long time to have carried it, and you named it plainly.';
  const asked = applyReconnectTurn(atInsightConfirm, [], 'about twelve years', { text: ack, replyIntent: 'done' });
  const turn = applyReconnectTurn(asked.state, [], 'It means I can stop pretending it was nothing.', { text: ack });
  assert.equal(turn.state.stage, 'doors', 'the stage is HELD for the break — see the note on rating chips');
  assert.ok(turn.reply.startsWith(ack), 'receives their final answer FIRST');
  assert.match(turn.reply, /excavation done/i, 'then names the boundary');
  assert.ok(turn.reply.indexOf('carried it') < turn.reply.indexOf('excavation done'), 'receive before the frame');
  assert.equal(turn.expects, undefined, 'and the break carries NO rating chips — it is not a 1–5 question');

  // …and carrying on delivers the instrument, whole, with its own framing.
  const on = applyReconnectTurn(turn.state, [], 'keep going', { text: '' });
  assert.equal(on.state.stage, 'measurement', 'the stage advances when she answers the break');
  assert.match(on.reply, /go through questions that determine your Identity Distance/i, 'the IDQ frame is intact');
});

test('W-35 · graceful — no model acknowledgment → the break stands alone (no stray separator)', () => {
  const asked = applyReconnectTurn(atInsightConfirm, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  const turn = applyReconnectTurn(asked.state, [], 'It means I stopped calling it laziness.', { text: '' });
  assert.equal(turn.state.stage, 'doors');
  assert.ok(turn.reply.startsWith("That's the excavation done"), 'opens cleanly on the break');
  assert.doesNotMatch(turn.reply, /^\s*\n/, 'no leading blank separator when there is nothing to receive');
});

// LEAVING AT THE BREAK IS A REAL OPTION — and it must not sneak her into the instrument she just deferred.
test('the break honours "later" — the stage does not advance behind her', () => {
  const asked = applyReconnectTurn(atInsightConfirm, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  const atBreak = applyReconnectTurn(asked.state, [], 'It means I stopped calling it laziness.', { text: '' });
  const away = applyReconnectTurn(atBreak.state, [], "I'll pick this up tomorrow", { text: '' });
  assert.equal(away.state.stage, 'doors', 'she is not walked into the IDQ after declining it');
  assert.match(away.reply, /saved exactly where you left it/i, 'and is told the leaving costs nothing');
  assert.doesNotMatch(away.reply, /Identity Distance/i, 'the instrument is not started');
});
