import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, parseStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// Identity tap-to-pick (Jay, 2026-07-29): the identity HANDLE is captured by a definitive chooser, not extracted from
// conversation (the model kept failing to commit a clear pick). The model draws out the past self and offers candidate
// words (offer_identity_words); the client renders chips + write-your-own; the member's tap/coin IS the handle, captured
// VERBATIM by the engine. These fixtures lock the whole loop offline (no API).

const drawnOut: ConvState = {
  stage: 'identity',
  collected: { athleticPast: 'I raced road bikes every weekend and chased summits' },
};

test('parseStagedTurn — offer_identity_words yields identityCandidates (and does NOT set identityNoun)', () => {
  const m = parseStagedTurn([
    { type: 'text', text: 'Here are a few words — tap one or write your own.' },
    { type: 'tool_use', name: 'offer_identity_words', input: { words: ['Athlete', 'Cyclist', 'Competitor'] } },
  ]);
  assert.deepEqual(m.identityCandidates, ['Athlete', 'Cyclist', 'Competitor']);
  assert.equal(m.record?.identityNoun, undefined, 'the offer never names the identity — the member’s tap does');
});

test('OFFER turn — model candidates become an identity_pick expectation; stays in identity, pick pending', () => {
  const t = applyStagedTurn(drawnOut, [], 'That was the best version of me — out on the road, lungs burning.', {
    text: 'Here are a few words for who that was — tap one, or write your own.',
    identityCandidates: ['Athlete', 'Cyclist'],
  });
  assert.deepEqual(t.expects, { kind: 'identity_pick', candidates: ['Athlete', 'Cyclist'] });
  assert.equal(t.state.stage, 'identity', 'the offer holds in identity — the pick resolves next turn');
  assert.deepEqual(t.state.pendingIdentityPick, ['Athlete', 'Cyclist'], 'the candidates are threaded for the pick turn');
  assert.equal(t.complete, false);
});

test('PICK turn — a tapped chip is captured VERBATIM as the handle and advances to the gap', () => {
  const pending: ConvState = { ...drawnOut, pendingIdentityPick: ['Athlete', 'Cyclist'] };
  const t = applyStagedTurn(pending, [], 'Athlete', { text: '' });
  assert.equal(t.state.collected.identityNoun, 'Athlete', 'their exact word — no model in the capture path');
  assert.equal(t.state.stage, 'gap', 'the pick is definitive: move straight on to how the gap opened');
  assert.equal(t.state.pendingIdentityPick, undefined, 'the pending pick is cleared once resolved');
  assert.equal(t.expects, undefined, 'the gap is a conversational turn — no chips');
  assert.match(t.reply, /Athlete/, 'the reply accepts the word warmly');
});

test('PICK turn — a coined word (with an article) is cleaned + natural-cased, still verbatim in spirit', () => {
  const pending: ConvState = { ...drawnOut, pendingIdentityPick: ['Athlete', 'Cyclist'] };
  const t = applyStagedTurn(pending, [], 'the trailblazer', { text: '' });
  assert.equal(t.state.collected.identityNoun, 'Trailblazer', 'leading article stripped, natural case');
  assert.equal(t.state.stage, 'gap');
});

test('PICK turn — the skip sentinel routes to skip_identity, not a captured name', () => {
  const pending: ConvState = { ...drawnOut, pendingIdentityPick: ['Athlete', 'Cyclist'] };
  const t = applyStagedTurn(pending, [], '__identity_skip__', { text: '' });
  assert.equal(t.state.collected.identitySkipped, true, 'the "not sure yet" affordance skips cleanly');
  assert.equal(t.state.collected.identityNoun, undefined, 'never names them from a skip');
  assert.equal(t.state.stage, 'gap');
});

test('PICK turn — a natural "not sure" typed into write-your-own also skips (never named that)', () => {
  const pending: ConvState = { ...drawnOut, pendingIdentityPick: ['Athlete', 'Cyclist'] };
  const t = applyStagedTurn(pending, [], "I'm not sure yet", { text: '' });
  assert.equal(t.state.collected.identitySkipped, true);
  assert.equal(t.state.collected.identityNoun, undefined);
});

test('PICK turn — an empty submission re-offers the same chips rather than losing the moment', () => {
  const pending: ConvState = { ...drawnOut, pendingIdentityPick: ['Athlete', 'Cyclist'] };
  const t = applyStagedTurn(pending, [], '', { text: '' });
  assert.deepEqual(t.expects, { kind: 'identity_pick', candidates: ['Athlete', 'Cyclist'] }, 're-offer');
  assert.equal(t.state.stage, 'identity');
  assert.equal(t.state.collected.identityNoun, undefined);
});
