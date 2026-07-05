import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, Turn } from '../lib/agent/onboarding.ts';

// The administered "Introduction to Grinta" baseline stage — off the depth kernel. These lock the survey's own
// behavior (the arc-level handoff from Reclaim is covered in onboarding-staged.test.ts).

// A member mid-survey: two items already answered, awaiting item index 2.
const midSurvey = (): ConvState => ({ stage: 'grinta', collected: { identityNoun: 'Runner', gap: 'x'.repeat(40), reclaimList: ['a', 'b', 'c'] }, administeredResponses: [3, 4] });

test('grinta stage · an unclear (non 1–5) answer RE-ASKS the current item, records nothing, does not advance', () => {
  const turn = applyStagedTurn(midSurvey(), [], 'hmm, not sure', { text: '' });
  assert.equal(turn.complete ?? false, false);
  assert.equal(turn.state.stage, 'grinta');
  assert.deepEqual(turn.state.administeredResponses, [3, 4], 'nothing recorded on an unclear answer');
  assert.match(turn.reply, /number from 1 to 5/i, 'gently re-asks with the 1–5 scale');
  assert.match(turn.reply, /3 of 12/, 're-delivers the CURRENT item (index 2 → "3 of 12")');
});

test('grinta stage · a valid 1–5 records and advances to the next item', () => {
  const turn = applyStagedTurn(midSurvey(), [], '5', { text: '' });
  assert.deepEqual(turn.state.administeredResponses, [3, 4, 5]);
  assert.match(turn.reply, /4 of 12/, 'delivers the next item');
});

// Walk all 12 items with a per-strand pattern and assert the baseline scores correctly THROUGH the engine.
function walk(vals: number[]): Turn {
  let s: ConvState = { stage: 'grinta', collected: { identityNoun: 'Runner', gap: 'x'.repeat(40), reclaimList: ['a', 'b', 'c'] }, administeredResponses: [] };
  const h: ConvMessage[] = [];
  let turn = null as unknown as Turn;
  for (const v of vals) {
    turn = applyStagedTurn(s, h, String(v), { text: '' });
    s = turn.state;
  }
  return turn;
}

test('grinta stage · the 12-item walk completes, scores per strand, and reveals the baseline (no ID Score)', () => {
  // Reconnect all 5, Rewire all 3, Rebuild all 1, Reclaim all 4  → composite 3.25
  const turn = walk([5, 5, 5, 3, 3, 3, 1, 1, 1, 4, 4, 4]);
  assert.equal(turn.complete, true);
  assert.equal(turn.state.stage, 'complete');
  const g = turn.state.collected.grintaBaseline!;
  assert.equal(g.strands.reconnect, 5);
  assert.equal(g.strands.rewire, 3);
  assert.equal(g.strands.rebuild, 1);
  assert.equal(g.strands.reclaim, 4);
  assert.equal(g.composite, 3.25);
  assert.match(turn.reply, /starting Grinta is 3.25/, 'the reveal shows the number');
  assert.match(turn.reply, /Reconnect is first/i, 'the light ceremony lights Reconnect next');
  assert.doesNotMatch(turn.reply, /ID Score|out of 100/i, 'NO ID Score at onboarding — earned in Reconnect');
});
