// The engine's stage and the model's turn must describe the same conversation.
//
// Donna's walk is the fixture that matters: the model asked "what do you want back?" while the engine still
// believed it was drawing out the gap, so she built her whole Reclaim List in chat and was then handed the
// builder for a list she had already made. These assert the divergence is SEEN, and that seeing it never costs
// the member a stage they have not actually been through.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectModelStage, lastAgentText, resolveStageAgreement } from '../lib/agent/stage-agreement.ts';

const ORDER = ['identity', 'gap', 'reclaim', 'grinta'];

test('detects the model running Reclaim — Donna\'s three real tells', () => {
  for (const t of [
    'Three things, close together. Now — what do you want back?',
    'Less conflict day to day. Peace and optimism in its place.\n\nWhat else do you want back?',
    "Then here's your Reclaim List as it stands:",
  ]) {
    assert.ok(detectModelStage(t)?.stage === 'reclaim', `should detect reclaim in: ${t}`);
  }
});

test('a FORECAST of the list is not the model running it', () => {
  // The engine's own gap-confirm line promises the list is coming. If this matched, every member who pasted a
  // list at the gap confirm would be shoved into reclaim by the engine's own copy.
  const forecast =
    "I've kept those — they're the things you want back, and we'll build that list together in a minute. " +
    "Right now I'm still with how it happened. Was there more to it?";
  assert.equal(detectModelStage(forecast), null);
});

test('divergence: model in reclaim while the engine is still in gap', () => {
  const a = resolveStageAgreement({
    engineStage: 'gap',
    priorAgentTurns: ['Three things, close together. Now — what do you want back?'],
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, true);
  assert.equal(a.diverged && a.modelStage, 'reclaim');
});

test('FORWARD ONLY — the engine is never pushed back to an earlier stage', () => {
  // The engine legitimately advanced to reclaim and emitted the opener itself; that copy is now the prior agent
  // turn. Equal is agreement, not divergence — otherwise the engine would re-trigger on its own words forever.
  const a = resolveStageAgreement({
    engineStage: 'reclaim',
    priorAgentTurns: ["Then here's your Reclaim List as it stands:"],
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, false);

  const behind = resolveStageAgreement({
    engineStage: 'grinta',
    priorAgentTurns: ['What else do you want back?'],
    stageOrder: ORDER,
  });
  assert.equal(behind.diverged, false, 'a model lagging the engine is normal, not a divergence');
});

test('no tell means no divergence — silence is not evidence', () => {
  const a = resolveStageAgreement({
    engineStage: 'gap',
    priorAgentTurns: ['Was your dad\'s illness the last of what landed in that stretch, or was there still more?'],
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, false);
});

test('a divergence that opens THIS turn is NOT acted on until the member has answered it', () => {
  // The member has not seen this question yet, so their current message still belongs to the previous beat.
  // Acting now hands it to the new stage's handler: it filed Donna's gap close as a Reclaim want and ran on into
  // the Grinta survey. One turn of lag costs nothing — the tell is still there when she replies to it.
  const a = resolveStageAgreement({
    engineStage: 'gap',
    priorAgentTurns: ['Was that the whole of it?'],
    currentModelText: 'Three things. Now — what do you want back?',
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, false);
});

test('STICKY — a tell from EARLIER in the walk still counts, so every want is kept', () => {
  // The model says it once, then follows up with bare "What else?" forever. Reading only the previous turn
  // caught the first want and dropped the rest — Donna's persona scored 1 of 3 on the live model.
  const a = resolveStageAgreement({
    engineStage: 'gap',
    priorAgentTurns: ['Now — what do you want back?', 'That is concrete. What else?', 'Getting that back. What else?'],
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, true);
  assert.equal(a.diverged && a.modelStage, 'reclaim');
});

test('STICKY self-cancels — an old tell cannot haunt the walk once the engine catches up', () => {
  const a = resolveStageAgreement({
    engineStage: 'reclaim',
    priorAgentTurns: ['Now — what do you want back?', 'What else?'],
    stageOrder: ORDER,
  });
  assert.equal(a.diverged, false);
});

test('lastAgentText reads the most recent Companion turn, not the member', () => {
  const h = [
    { role: 'agent' as const, text: 'first' },
    { role: 'member' as const, text: 'I lost my job two years ago.' },
    { role: 'agent' as const, text: 'Now — what do you want back?' },
    { role: 'member' as const, text: 'Firstly, I want financial stability.' },
  ];
  assert.equal(lastAgentText(h), 'Now — what do you want back?');
  assert.equal(lastAgentText([]), '');
});
