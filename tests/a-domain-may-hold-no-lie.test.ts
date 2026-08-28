// A DOMAIN MAY HOLD NO LIE.
//
// Jay, W1, 2026-08-28: "This was confusing, I didn't answer these with lies."
//
// The Disinformation Audit walks five places a self-lie can hide. He answered several with the truth — "I'm still
// in there", "Hell yes", "I can ride better than I ever have" — and the beat closed on "Five lies named. Let's go
// back and do the real work on them."
//
// Walking five places is not a promise that five are hiding there. The count was asserted from the STRUCTURE (one
// answer per domain) rather than from what he actually said, which turns an instrument into a formality: if it
// finds five lies whatever you answer, its finding says nothing about you.
//
// The model already half-knew — its next turn read "that one doesn't need a counter, it already is the true
// line." Nothing had told it that was allowed, so it announced the tally and then contradicted it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/agent/rewire.ts', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
// THE STEERING AS THE MODEL RECEIVES IT. These prompts are built by concatenating string literals, so a phrase
// the model reads as one sentence is split across `" +` in the source — "never manufacture a " ends one literal
// and "counter for…" begins the next. Matching the raw file therefore fails on text that is demonstrably there.
// Joining the concatenation first is the only way to assert on what is actually sent.
const PROMPT = code.replace(/"\s*\+\s*\n?\s*"/g, '');

test('the model is told a domain may hold no lie', () => {
  assert.match(PROMPT, /A DOMAIN MAY HOLD NO LIE/, 'the steering has to say it outright');
  assert.match(PROMPT, /never manufacture a counter/i, 'an answer that is already true needs no counter written for it');
  assert.match(PROMPT, /never assert a number of lies the member did not name/i, 'the tally comes from what was said');
});

test('the scripted fallback does not claim every answer was a lie', () => {
  // "Every one of those sounds reasonable — that's the trick" makes the same claim the model made, so fixing only
  // the steering would leave the assertion intact on the path taken when the model returns nothing.
  const campaign = code.match(/const W1_CAMPAIGN =([\s\S]*?);/)![1]!;
  assert.doesNotMatch(campaign, /Every one of those/, 'that asserts all five were lies');
  assert.match(campaign, /The ones that sound most reasonable/, 'it speaks to the ones that were');
});

test('the Session still says what it is FOR', () => {
  // The fix must not soften the instrument into nothing — it hunts self-lies, and the opening still says so.
  // Relaxing an expert's instrument to dodge an awkward moment is its own failure mode.
  assert.match(code, /five places these lies hide/i, 'the frame is unchanged: five places a lie can hide');
  assert.match(code, /it catches self-lies, nothing else/i, 'and the Session keeps its job');
});
