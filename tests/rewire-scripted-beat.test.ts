// W-18: the arc must not double-bubble. withScriptedBeat suppresses the engine's scripted question when the model's
// reflection already ends in a question (model reflects, engine asks — never both); otherwise it appends via BEAT_SEP.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withScriptedBeat, dropTrailingQuestion } from '../lib/agent/rewire.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';

test('withScriptedBeat · model already asked → drop the scripted question (no double-bubble)', () => {
  const reflected = 'Showing up runs deep for you.\n\nWhat do you tell yourself when the old voice gets loud?';
  assert.equal(withScriptedBeat(reflected, 'SCRIPTED Q'), reflected, 'the model asked — engine stays quiet');
});

test('withScriptedBeat · model only reflected → append the scripted beat via BEAT_SEP', () => {
  const reflected = 'That one lands — the cost was real.';
  assert.equal(withScriptedBeat(reflected, 'SCRIPTED Q'), `${reflected}${BEAT_SEP}SCRIPTED Q`);
});

test('withScriptedBeat · empty reflection → the scripted beat carries the turn', () => {
  assert.equal(withScriptedBeat('', 'SCRIPTED Q'), 'SCRIPTED Q');
});

test('withScriptedBeat · a ? in an EARLIER paragraph does not suppress (only the last paragraph counts)', () => {
  const reflected = 'Was that the moment?\n\nEither way, it stayed with you.';
  assert.equal(withScriptedBeat(reflected, 'SCRIPTED Q'), `${reflected}${BEAT_SEP}SCRIPTED Q`, 'last para has no ? → append');
});

// Jay's walk: at the CLOSE the model re-posed "what do you picture?" and the engine ran the whole wrap behind it —
// asked a question it never waited for. dropTrailingQuestion keeps the receipt, drops the dead-end question.
test('dropTrailingQuestion · strips a trailing question paragraph, keeps the receipt', () => {
  const reply = `"Just get back on it" — that's it, simple and true.\n\nRestart — what's the image that pulls you back?`;
  assert.equal(dropTrailingQuestion(reply), `"Just get back on it" — that's it, simple and true.`);
});

test('dropTrailingQuestion · strips a trailing question across BEAT_SEP too', () => {
  assert.equal(dropTrailingQuestion(`That lands.${BEAT_SEP}So what do you picture?`), 'That lands.');
});

test('dropTrailingQuestion · a lingering trailing question SENTENCE is trimmed', () => {
  assert.equal(dropTrailingQuestion('That lands. What do you picture?'), 'That lands.');
});

test('dropTrailingQuestion · a receipt with no question is untouched; empty stays empty', () => {
  assert.equal(dropTrailingQuestion('That one lands — the cost was real.'), 'That one lands — the cost was real.');
  assert.equal(dropTrailingQuestion(''), '');
  // an earlier question but a statement close is fine (only trailing questions go)
  assert.equal(dropTrailingQuestion('Was it worth it? It was.'), 'Was it worth it? It was.');
});
