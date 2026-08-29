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

// ── REDIRECT IS A SUBSTITUTE, NOT A TEMPTATION ───────────────────────────────────────────────────────────────
//
// Jay's stored False Start Protocol reads "Redirect — A cocktail or the wrong food". That is what he would be
// redirecting AWAY from. His recovery move, on his Playbook card and ticked in his weekly tracker, is the thing
// he is recovering from.
//
// The engine cannot tell a substitute from a temptation, and a keyword list of vices is exactly the shape that
// has now failed four times at the Reframe. The model can tell, and had never been asked to.
test('the model is told what a Redirect is, and what to do when it gets a temptation', () => {
  assert.match(PROMPT, /REDIRECT IS A SUBSTITUTE, NOT A TEMPTATION/, 'the steering has to say it outright');
  assert.match(PROMPT, /ask what they would do instead/i, 'and say what to do about it — reflect, then re-ask');
  assert.match(PROMPT, /never write the substitute for them/i, 'without writing their move for them');
});

test('the engine still stores their words, not a guess', () => {
  // The fix is steering, deliberately. An engine that rejected answers by keyword would refuse real ones —
  // "a cocktail" is a temptation for him and could be someone else's genuine wind-down.
  assert.match(code, /b\.collected\.w3Redirect = msg;/, 'the member owns the words; the model owns the catch');
});

// ── NO TALLIES ───────────────────────────────────────────────────────────────────────────────────────────────
//
// Jay: "counting seems problematic programmatically and doesn't have enough value."
//
// It announced "Five lies named" over answers that were not lies. He corrected one, and it recounted to "four
// lies named, four true lines put to them" — still wrong, because it had already conceded a SECOND one two turns
// earlier ("that one doesn't need a counter, it already is the true line"). It subtracted the one he objected to
// and kept the one it had objected to itself.
//
// A model doing arithmetic mid-conversation will keep getting it slightly wrong, and the number was never the
// value: what a member needs is which lines are theirs, not how many.
test('the Companion is told never to count', () => {
  assert.match(PROMPT, /NEVER COUNT/, 'stated as a rule, not a nudge');
  assert.match(PROMPT, /no tallies/i, 'and it names the behaviour');
  assert.match(PROMPT, /the engine will state it; you never do/i,
    'counting is not banned from the product — it is moved to the thing that actually knows');
});
