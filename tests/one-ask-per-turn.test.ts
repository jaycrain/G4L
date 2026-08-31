import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVoiceGate, oneAskOnly } from '../lib/agent/voice-gate.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';

// THE PROMPT HAS ALWAYS SAID "One question at a time — never two, never three." The session eval caught the model
// doing it anyway, in R3 on 2026-08-31:
//
//   "Who's expecting you at ten? Say it plainly — a client, a room, a project someone's paying you to make.
//    What else is different by 7am? Not the medal — the ordinary stuff: how you wake, what you reach for…"
//
// Donna hit the same shape and named the cost: "when I answered the first question, there was no opportunity to
// answer the second one." A rule with no gate under it — the same argument voice-gate.ts was built on.
//
// DIFFERENT MECHANISM FROM v3.5.77, which stopped the ENGINE appending a scripted question after a model one.
// This is the model stacking two by itself.

const REAL_R3 = [
  'Somewhere to be by ten. Not urgent — expected.',
  "Who's expecting you at ten? Say it plainly — a client, a room, a project someone's paying you to make.",
  'What else is different by 7am? Not the medal — the ordinary stuff: how you wake, what you reach for.',
].join('\n\n');

test('the live R3 case: the second ask is dropped, the first survives', () => {
  const { text, removed } = applyVoiceGate(REAL_R3);
  assert.match(text, /Who's expecting you at ten\?/, 'the first ask is what she answers, so it stays');
  assert.ok(!text.includes('What else is different by 7am'), 'the second ask goes');
  assert.ok(removed.includes('two-questions'), 'and it is reported, so we can see the rate');
});

test('THE FIRST ask wins — that is her observation, not a preference', () => {
  // "when I answered the first question, there was no opportunity to answer the second one." Keeping the LAST
  // would discard the one she actually engages with.
  const { text } = oneAskOnly('Reflection.\n\nFirst thing?\n\nSecond thing?');
  assert.match(text, /First thing\?/);
  assert.ok(!text.includes('Second thing'));
});

test('the turn ENDS on its question', () => {
  const { text } = oneAskOnly('Setup.\n\nWhat happened?\n\nTake your time with it.');
  assert.ok(text.trim().endsWith('?'), 'a coda after the ask is what buried the question in the first place');
});

test('"…? Or not quite?" is ONE ask — the confirm idiom must survive', () => {
  // Counting question marks instead of asks put two false reds in one eval run before this existed.
  const confirm = 'Is that close to it — that what faded was mattering? Or not quite?';
  assert.equal(oneAskOnly(confirm).trimmed, false);
  assert.equal(applyVoiceGate(confirm).text, confirm);
});

test('a turn with ONE question, or none, is never touched', () => {
  for (const t of ['That is a real loss.\n\nTake me back to how it went.', 'Twelve years. That lands differently now.']) {
    assert.equal(oneAskOnly(t).trimmed, false, t);
  }
});

test('two asks INSIDE one paragraph are cut back to the first, sentence whole', () => {
  const { text } = oneAskOnly('What did that cost you? And when did you first notice it?');
  assert.equal(text, 'What did that cost you?');
});

test('the prompt still carries the rule — the gate is the floor, not the replacement', () => {
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /One question at a time — never two, never three/);
});
