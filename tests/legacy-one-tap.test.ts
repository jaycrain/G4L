import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R3_ARC } from '../lib/agent/reconnect.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// DONNA, 2026-08-30: "There is STILL a bug where you have to click That's Mine 2x for Legacy letter to take."
// Still — she had reported it before, and it had not been found.
//
// THE CAUSE. Models habitually call record_legacy_letter again on the confirm turn, handing back the SAME text.
// The confirm branch treated any legacyBody as a redraft that "supersedes everything", so it re-showed the letter,
// re-asked the question, and discarded her tap. Tap one saved nothing; tap two committed. The only difference
// between the two taps was whether the model happened to speak.
//
// member-words-outrank-model-guess, on the one artifact that is entirely hers.

const LETTER = 'Dear me, a year from now. You went back to the studio, and it was not too late.';
const draft = (body: string) => ({ text: '', legacyBody: body }) as never;
const start = (): ConvState => ({ stage: 'legacy', collected: { identityNoun: 'Maker' } }) as ConvState;

function drafted() {
  return applyReconnectTurn(start(), [], 'ok', draft(LETTER), RECONNECT_R3_ARC).state;
}

test('ONE tap saves the letter, even when the model re-emits it that same turn', () => {
  const t = applyReconnectTurn(drafted(), [], serializeBeatConfirm('done', 'legacy'), draft(LETTER), RECONNECT_R3_ARC);
  assert.equal(t.complete, true, 'R3 closes on her tap');
  assert.ok((t.state as { legacyLetter?: unknown }).legacyLetter, 'and the letter is handed to the action to persist');
});

test('ONE tap still works when the model stays quiet', () => {
  const t = applyReconnectTurn(drafted(), [], serializeBeatConfirm('done', 'legacy'), { text: '' }, RECONNECT_R3_ARC);
  assert.equal(t.complete, true);
  assert.ok((t.state as { legacyLetter?: unknown }).legacyLetter);
});

test('a REAL edit still supersedes the tap — she asked for it and it arrived', () => {
  // The fix must not swing the other way. If the body genuinely changed, showing her the new version and asking
  // again is correct: her tap was about the letter she had read, not this one.
  const edited = `${LETTER} And tell them about the kids.`;
  const t = applyReconnectTurn(drafted(), [], serializeBeatConfirm('done', 'legacy'), draft(edited), RECONNECT_R3_ARC);
  assert.equal(t.complete, false, 'a changed letter is re-offered, never silently committed');
  assert.match(t.reply, /tell them about the kids/, 'and she sees the version that would be saved');
});

test('whitespace-only difference is still a re-emission, not an edit', () => {
  const t = applyReconnectTurn(drafted(), [], serializeBeatConfirm('done', 'legacy'), draft(`  ${LETTER}\n`), RECONNECT_R3_ARC);
  assert.equal(t.complete, true, 'trailing whitespace is not a revision');
});

test('"Change a line" is unaffected — it must still open the letter for editing', () => {
  const t = applyReconnectTurn(drafted(), [], serializeBeatConfirm('addition', 'legacy'), { text: '' }, RECONNECT_R3_ARC);
  assert.equal(t.complete, false, 'asking for a change never commits');
  assert.ok(!(t.state as { legacyLetter?: unknown }).legacyLetter, 'and nothing is stored on the way');
});
