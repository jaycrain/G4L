import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runArcTurn } from '../lib/agent/onboarding-staged.ts';
import { REBUILD_B3_ARC } from '../lib/agent/rebuild.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

// CAT-35 — coach mode was the ONE kernel path with no liveness floor. The plan-completeness contract guarantees
// "never leave without a plan" but said nothing about "always able to LEAVE": if the model never locked both
// fields — member stonewalls, or it simply never calls record_plan — B3 looped forever and blocked B3→B4.

function stonewall(turns: number) {
  let state: ConvState = { stage: 'pilot', collected: {} };
  const history: ConvMessage[] = [];
  let last = { reply: '', complete: false as boolean };
  for (let i = 0; i < turns; i++) {
    // The model converses but never calls record_plan — the exact reproduced failure.
    const t = runArcTurn(REBUILD_B3_ARC, state, history, "I don't know", { text: 'What feels doable?' });
    history.push({ role: 'member', text: "I don't know" }, { role: 'agent', text: t.reply });
    state = t.state;
    last = { reply: t.reply, complete: t.complete };
    if (t.complete) break;
  }
  return { ...last, state };
}

test('a member who never lands a plan is RELEASED at the ceiling, not trapped', () => {
  const r = stonewall(35);
  assert.equal(r.complete, true, 'B3 must be able to end — otherwise B3→B4 is blocked forever');
  assert.equal(r.state.stage, 'complete');
});

test('the exit never invents a plan they did not agree to', () => {
  const r = stonewall(35);
  assert.equal(r.state.collected.pilotActivity ?? '', '', 'no fabricated activity change');
  assert.equal(r.state.collected.pilotDiet ?? '', '', 'no fabricated diet change');
  assert.match(r.reply, /nothing's lost|no right answer/i, 'they leave normalised, not scolded');
});

test('a normal coaching pace is NEVER hurried — only the absolute ceiling releases', () => {
  const r = stonewall(10);
  assert.equal(r.complete, false, 'coaching is legitimately slow and circular; 10 turns is a conversation');
});
