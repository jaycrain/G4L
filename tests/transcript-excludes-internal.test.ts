// THE TRANSCRIPT CONTAINS ONLY WHAT A MEMBER READS.
//
// `docs/member-transcript.md` is the artifact marketing and the second-edition book quote VERBATIM. Anything that
// reaches it is, by the standing sync protocol, quotable G4L copy. So the cost of a leak is not a tidiness
// problem — it is a wrong line in print, discovered after printing.
//
// Six blind spots in six bundles, each one a filter that could only see the case it was written for:
//   1. multi-line JSX prose            4. code-comment continuations (Jay's own walk feedback, quoted in a fix)
//   2. concatenated string fragments   5. model steering + tool descriptions (excluded by DECLARATION)
//   3. sentences ending on a pronoun   6. authoring `note:` fields — this one
//
// #6 is the case the declaration rule provably cannot catch, which is why it needs its own guard: LEGACY_PROMPTS
// holds `prompt` (member copy) and `note` (internal) in the SAME object literal. Excluding the declaration would
// have taken the Legacy Letter's six questions out of canon; including it leaked a quote attributed to a real
// person — and sent Cowork to open a decision row about a surface no member has ever seen.
//
// This asserts BOTH directions, because every previous fix here broke the other one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const transcript = () => readFileSync('docs/member-transcript.md', 'utf8');

test('internal authoring notes never reach the transcript', () => {
  const t = transcript();
  // The one that leaked, verbatim.
  assert.doesNotMatch(t, /There should always be Unfinished Business/,
    'an authoring note reached the artifact the book quotes');
  // And the general shape: a real person named inside a quotation in member copy.
  assert.doesNotMatch(t, /^- (Greg|Jay|Donna|Welk|Crain):/m,
    'a note attributing a line to a named person reached the transcript');
});

test('…and the member-facing copy beside them SURVIVES', () => {
  // The half that an over-broad rule breaks. My first attempt at excluding by declaration matched "PROMPT" and
  // silently pulled 40 real questions — every IDQ and audit item stem, and these six — out of canon. Caught only
  // by measuring what moved. These are the canaries.
  const t = transcript();
  for (const q of [
    'What is your Unfinished Business?',
    'What does a Tuesday look like for you one year from now?',
    'What does the measuring stick say?',
    "What adventure have you completed that you haven't started yet today?",
    'What relationship has deepened because you kept showing up?',
    'What have you given back?',
  ]) {
    assert.ok(t.includes(q), `the Legacy Letter question "${q.slice(0, 40)}…" must stay in canon`);
  }
});

test('the front door is in canon — it has fallen out twice', () => {
  // Once because the reader could not see JSX text at all; once because I put an explanatory comment INSIDE the
  // <p> while fixing a typo on the same line. It is the highest-traffic string in the product.
  assert.match(transcript(), /Just you and a Companion built for this one thing/,
    'the front-door line must be present, with a capital C');
});
