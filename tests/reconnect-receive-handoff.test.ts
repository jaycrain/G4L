import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyReconnectTurn } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// W-35 (receive-before-you-move) — the Doors-excavation → IDQ handoff must RECEIVE the member's final answer
// before the scripted IDQ frame. The deterministic administered opener used to clobber what they just said
// (the founder answered a weighty question and got the cold "let's shift to something lighter" frame).
// ============================================================================================================

const atInsightConfirm: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Rider', doors: ['grind'] } };

test('W-35 · the handoff LEADS with the model’s acknowledgment, then the IDQ frame', () => {
  const ack = 'Twelve years — that’s a long time to have carried it, and you named it plainly.';
  const turn = applyReconnectTurn(atInsightConfirm, [], 'about twelve years', { text: ack, replyIntent: 'done' });
  assert.equal(turn.state.stage, 'measurement', 'still hands into the measurement block');
  assert.ok(turn.reply.startsWith(ack), 'receives their final answer FIRST');
  assert.match(turn.reply, /shift to something lighter/i, 'then delivers the IDQ frame');
  assert.ok(turn.reply.indexOf('carried it') < turn.reply.indexOf('shift to something lighter'), 'receive before the frame');
});

test('W-35 · graceful — no model acknowledgment → the IDQ frame stands alone (no stray separator)', () => {
  const turn = applyReconnectTurn(atInsightConfirm, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'measurement');
  assert.ok(turn.reply.startsWith('We’ve been deep') || turn.reply.startsWith("We've been deep"), 'opens cleanly on the IDQ frame');
  assert.doesNotMatch(turn.reply, /^\s*\n/, 'no leading blank separator when there is nothing to receive');
});
