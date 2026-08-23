import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVoiceGate, detectVoiceTells } from '../lib/agent/voice-gate.ts';

// DONNA, 2026-08-22 — "these need to actually stop appearing, not just be added to a list again."
//
// The system prompt has carried a WORDS THAT READ AS AI section for weeks and calls "quiet" the worst offender.
// She then hit "quiet" on a live walk, twice in one message. A prompt makes good output likely; this makes the
// removable half impossible.

test('the adverb and the adjective are deleted — the sentence survives intact', () => {
  assert.equal(applyVoiceGate('it quietly cost you fifteen years').text, 'it cost you fifteen years');
  assert.equal(applyVoiceGate('there was a quiet moment in there').text, 'there was a moment in there');
  assert.equal(
    applyVoiceGate('no wonder that part of you got quiet under all of it').text,
    'no wonder that part of you went silent under all of it',
  );
});

test('the VERB survives — "quiet the noise" is good English and good voice', () => {
  const s = 'Let us quiet the noise for a second.';
  assert.equal(applyVoiceGate(s).text, s);
});

test('it never touches a product noun', () => {
  // "the quiet one" is the Autopilot Door's recognition line. A rule that eats the product's own vocabulary is
  // worse than the tell it removes — the same lesson the teal rule needed.
  const s = 'You marked the quiet one — no single event, just years of it.';
  assert.equal(applyVoiceGate(s).text, s);
});

test('"Quiet Day" is NOT exempt, because it is a retired label', () => {
  // Caught by the naming guard on the day this file was written: I exempted "Quiet Day" believing it was a live
  // Momentum call. It was retired — the member-facing label is "On Track". Exempting it would have protected a
  // phrase the Companion should not be saying at all.
  assert.equal(applyVoiceGate('you logged a quiet day').text, 'you logged a day');
});

test('clean prose is returned byte-identical', () => {
  const s = 'Tell me what it felt like in your body.';
  assert.equal(applyVoiceGate(s).text, s);
  assert.deepEqual(applyVoiceGate(s).removed, []);
});

test('an empty or whitespace turn is passed through untouched', () => {
  // The gate must never be the reason a reply is blank — the engine's own fallbacks own that case.
  assert.equal(applyVoiceGate('').text, '');
  assert.equal(applyVoiceGate('   ').text, '   ');
});

test('it REPORTS the tells it deliberately will not rewrite', () => {
  // "does that land", "the shape of it", "been carrying" all need a new SENTENCE, not a deleted word. The first
  // version of this gate tried to substitute and produced "is that right the way it happened?" — a mangled
  // question shipped to a member mid-story. Detection is what tells us whether the prompt is holding.
  assert.deepEqual(
    detectVoiceTells('Does that land? I want the shape of it, and what you have been carrying.').sort(),
    ['carrying', 'land', 'shape'],
  );
  assert.deepEqual(detectVoiceTells('Tell me what it felt like.'), []);
});

test('a rule firing twice in one turn still reports once, and both are removed', () => {
  // Her actual report: "landed" and "carry" twice within one message.
  const r = applyVoiceGate('it quietly cost you, and it quietly kept costing you');
  assert.equal(r.text, 'it cost you, and it kept costing you');
  assert.deepEqual(r.removed, ['quietly']);
});
