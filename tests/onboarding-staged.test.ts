import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStagedTurn, stagedOpening, correctsReflection } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

// Replay through the PURE staged engine (no API), the same discipline as tests/onboarding-replay.test.ts.
type Step = { member: string; model: ModelTurn };
function replayStaged(steps: Step[], from: ConvState = { stage: 'identity', collected: {} }) {
  let state = from;
  const history: ConvMessage[] = [];
  const turns: Turn[] = [];
  for (const s of steps) {
    const t = applyStagedTurn(state, history, s.member, s.model);
    turns.push(t);
    history.push({ role: 'member', text: s.member }, { role: 'agent', text: t.reply });
    state = t.state;
    if (t.complete) break;
  }
  return { turns, finalState: state };
}

test('STAGED opening — opens on the identity question, stage = identity', () => {
  const t = stagedOpening();
  assert.equal(t.state.stage, 'identity');
  assert.equal(t.complete, false);
  assert.match(t.reply, /most like yourself/i);
});

test('STAGED identity — gather → reflect-confirm → advance to the gap stage', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was a competitive cyclist who raced every weekend', model: { text: 'That comes through.', record: { athleticPast: 'a competitive cyclist who raced every weekend' } } },
    { member: 'The Athlete', model: { text: 'The Athlete.', record: { identityNoun: 'Athlete' } } },
    { member: 'Yes, that’s her', model: { text: 'Good.' } },
  ]);
  // turn 2: named → reflect-confirm + await confirm
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects the named identity and awaits confirm');
  assert.match(turns[1]!.reply, /Athlete/);
  assert.match(turns[1]!.reply, /did I get|right\?/i);
  // turn 3: affirm → advance + reframe
  assert.equal(finalState.stage, 'gap', 'advances to the gap stage on confirm');
  assert.equal(finalState.awaitingConfirm, false);
  assert.match(turns[2]!.reply, /how it went|distance started to open/i, 'reframes into how-it-opened');
  assert.equal(finalState.collected.identityNoun, 'Athlete');
});

test('STAGED identity — skip path advances straight to the gap stage (nothing to confirm)', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was someone who chased every new idea', model: { text: 'I hear that.', record: { athleticPast: 'someone who chased every new idea' } } },
    { member: 'honestly I’m not sure I can name it yet', model: { text: 'That’s okay.', record: { identitySkipped: true } } },
  ]);
  assert.equal(finalState.collected.identitySkipped, true);
  assert.equal(finalState.stage, 'gap', 'skip advances straight to the gap stage');
  assert.match(turns[1]!.reply, /find her through the work/i, 'acknowledges the skip warmly');
});

test('STAGED identity — a correction re-opens the stage (never advances on "no")', () => {
  const atReflect: ConvState = {
    stage: 'identity', awaitingConfirm: true, identityTurns: 1,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' },
  };
  const turn = applyStagedTurn(atReflect, [], 'no, that’s not quite her — more the Builder', { text: 'Got it.' });
  assert.equal(turn.complete, false);
  assert.equal(turn.state.stage, 'identity', 'stays in identity on a correction');
  assert.equal(turn.state.awaitingConfirm, false, 'clears the pending confirm');
  assert.match(turn.reply, /truer|get it right|my mistake/i, 're-gathers the word');
});

test('STAGED identity — an ambiguous reply at confirm advances (never traps)', () => {
  const atReflect: ConvState = {
    stage: 'identity', awaitingConfirm: true, identityTurns: 1,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' },
  };
  const turn = applyStagedTurn(atReflect, [], 'hmm, I think so', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'gap', 'ambiguous (not a correction) advances — no trap');
});

test('correctsReflection — catches a real correction, not an affirmation', () => {
  assert.equal(correctsReflection('no, that’s not it'), true);
  assert.equal(correctsReflection('not quite — more the Builder'), true);
  assert.equal(correctsReflection('yes, that’s her'), false);
  assert.equal(correctsReflection('yeah no, that’s her'), false); // colloquial yes (affirmation guard)
  assert.equal(correctsReflection('perfect'), false);
});
