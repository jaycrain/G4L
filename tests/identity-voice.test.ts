import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';

// A PROHIBITION WITHOUT ITS BOUNDARY BECOMES A BAN.
//
// Two rules shipped within hours of each other on 2026-08-14, and BOTH had the same failure mode:
//   "normalize, don't praise"          read alone → the Companion goes flat
//   "address them as you, not the Identity" read alone → the Companion stops handing the Identity back at all
//
// The second one nearly happened. Cowork sent the sweep instruction at 14:54 and a guardrail addendum at 15:16
// titled "READ BEFORE running the sweep — it's the guardrail so the sweep doesn't overshoot". The sweep shipped
// at 15:20 without it. The authored sweep turned out to be correct, but the SYSTEM PROMPT rule as first written
// led with "ALWAYS ADDRESS THEM AS 'YOU' — never by their Identity" and carried three vivid negative examples
// against one thin positive. Jay, on seeing the line the rule endangers: "This is perfect application of using
// the Identity back to the member."
//
// So the boundary is now load-bearing prompt content, and this guard exists because the failure is SILENT: a
// future tidy-up that trims the prompt for length would delete the carve-out, the model would quietly stop
// producing the best beat in the product, and nothing would fail. Nobody would notice for months.

const KEEP_EXEMPLAR = 'the Player is still there. You named him.';

test('the prompt carries the KEEP exemplar verbatim — the beat the rule endangers', () => {
  assert.ok(
    MEMBER_AGENT_SYSTEM_PROMPT.includes(KEEP_EXEMPLAR),
    'the reference example for returning the Identity at a threshold is gone from the prompt.\n' +
      'It is there to stop the "say you, not the Identity" rule from flattening the good use.\n' +
      'If you are shortening this prompt, cut something else.',
  );
});

test('it teaches by CONTRAST — the fix case and the keep case both present', () => {
  // A rule with only prohibitions trains suppression. A rule with only permissions trains overuse. The prompt
  // has to carry both poles or the model picks one and runs to the end of it.
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /what it cost the Player/, 'the FIX pole (routine address) is gone');
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /never rewrite that into "you're still there"/i, 'the KEEP pole is gone');
});

test("the four tests survive — they are what makes the carve-out decidable rather than a vibe", () => {
  // Cowork's four: milestone/earned · rare · framed as THEIR act · pivots back to second person. Without these
  // "sometimes you may name the Identity" is an invitation to guess, and the model guesses generously.
  for (const [name, re] of [
    ['milestone', /milestone or checkpoint/i],
    ['rare', /rare — one beat/i],
    ['their act', /framed as THEIR act/i],
    ['pivots back', /pivots straight back to second person/i],
  ] as const) {
    assert.match(MEMBER_AGENT_SYSTEM_PROMPT, re, `test "${name}" is missing — the carve-out is no longer decidable`);
  }
});

test('the rule of thumb is stated as RETURN-vs-ADDRESS, which is the whole distinction', () => {
  assert.match(
    MEMBER_AGENT_SYSTEM_PROMPT,
    /return to them at a threshold — never a way you address them in passing/i,
    'the one-line form of the rule is what survives a skim; without it the examples are just anecdotes',
  );
});
