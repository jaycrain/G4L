// THE GAP IS THE MEMBER'S OWN ACCOUNT — ENFORCED, NOT ASKED FOR.
//
// Found by walking the live engine, 2026-08-30. A member's 204-character account —
//
//   "My dad got sick in 2019 and I became his carer for three years. Everything I did for myself just stopped —
//    the riding, the friends, all of it. By the time he died I did not recognise the person left over."
//
// was replaced in storage by the model's tidy 52-character summary: "Became a carer for her father and lost her
// routines." A quarter of the length, third person, and it is what her summary card, her dashboard ("in your own
// words") and every later surface would have shown back to her.
//
// The set_gap tool description already forbids this in the strongest terms — "NEVER rewrite it into the THIRD
// person… Never paraphrase, reorder, smooth, or add." It was prompt-only. This file's own doctrine: a prompt
// makes good output likely; only the engine makes bad output impossible. [[member-words-outrank-model-guess]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, isThirdPersonGap } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const HERS = 'My dad got sick in 2019 and I became his carer for three years. Everything I did for myself just ' +
  'stopped — the riding, the friends, all of it. By the time he died I did not recognise the person left over.';

const inGap = (gap?: string): ConvState =>
  ({ stage: 'gap', collected: { athleticPast: 'raced bikes', identityNoun: 'Racer', ...(gap ? { gap } : {}) }, doorAsked: true }) as never;

const turn = (state: ConvState, msg: string, model: unknown): Turn =>
  applyStagedTurn(state, [], msg, model as never);

test('a model paraphrase cannot replace what she actually wrote', () => {
  const t = turn(inGap(HERS), 'That is the whole of it.', {
    text: 'That sounds like a lot.',
    record: { gap: 'Became a carer for her father and lost her routines.' },
  });
  const stored = (t.state as ConvState).collected.gap ?? '';
  assert.ok(stored.startsWith('My dad got sick'), 'her words survived');
  assert.equal(stored.length, HERS.length, 'and survived whole — not trimmed to the summary');
});

test('the guard is NARROW — a first-person story about other people is hers and is kept', () => {
  // The tool's own good example. Third-person pronouns are not disqualifying; the absence of her voice is.
  // A false positive here silently discards a real capture, which is the failure being prevented.
  const t = turn(inGap(), 'It was when my wife lost her job.', {
    text: 'Mm.',
    record: { gap: 'My wife got laid off, which hit her hard, and everything I did for myself went with it.' },
  });
  assert.match((t.state as ConvState).collected.gap ?? '', /my wife got laid off/i, 'kept — it is in her voice');
});

test('the predicate, directly', () => {
  assert.equal(isThirdPersonGap('Became a carer for her father and lost her routines.'), true);
  assert.equal(isThirdPersonGap('She stopped riding after the divorce.'), true);
  assert.equal(isThirdPersonGap('My wife got laid off, which hit her hard.'), false, 'hers, mentions another');
  assert.equal(isThirdPersonGap('I stopped training and never started again.'), false);
  assert.equal(isThirdPersonGap('We moved and I lost the whole routine.'), false, '"we" is first person too');
  assert.equal(isThirdPersonGap(''), false, 'an empty gap is not a paraphrase — it is nothing, handled elsewhere');
  assert.equal(isThirdPersonGap('Divorce, and then the years just went.'), false,
    'no pronouns at all is not evidence of a paraphrase — refuse only what cannot be her account');
});

test('a first-person model recording is still accepted — the beat must still work', () => {
  // The guard must not buy safety by refusing everything. The model recording her words IS the normal path.
  const t = turn(inGap(), 'My dad got sick and I became his carer.', {
    text: 'Mm.',
    record: { gap: 'My dad got sick in 2019 and I became his carer for three years.' },
  });
  assert.match((t.state as ConvState).collected.gap ?? '', /I became his carer/, 'the ordinary path is unaffected');
});
