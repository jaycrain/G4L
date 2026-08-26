// WHAT THE COMPANION PROMISES MUST MATCH WHAT IT ADMINISTERS.
//
// Jay, walking the Rebuild Checkpoint on 2026-08-26: "I believe it skipped some dietary questions at the end of
// the session, there was only one before it closed me out."
//
// Nothing was skipped. He was told there would be twelve and there were six.
//
// Greg's Measurement Canvas V5 cut B4 from twelve activity/diet halves to six single items on 2026-08-14 — the
// item list changed, the scoring changed, pairwiseAverage was deleted. The one thing that did not change was the
// sentence the member reads: "A dozen of these, one to five." Rewire and Reclaim have always said "Six of these",
// so Rebuild was also the odd one of three.
//
// WHY THIS IS WORSE THAN A TYPO. A member told a number and given half of it does not think "stale copy". They
// think the product lost their answers — and at a CHECKPOINT that doubt lands on the measurement itself, which is
// the one thing that has to be trustworthy for the Grinta move at the close to mean anything. Jay distrusted it
// immediately and he was right to.
//
// A CLASS TEST, because the failure was a count in prose drifting from a count in code, and there are three of
// them. Re-cutting an instrument is expected — Greg does it — so the guard belongs on the seam, not on B4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHECKPOINT_COMMITMENT_ITEMS,
  CHECKPOINT_CONTROL_ITEMS,
  CHECKPOINT_CHALLENGE_ITEMS,
} from '../lib/grinta/survey/instrument.ts';

const WORD: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, dozen: 12, 'two dozen': 24,
};

/**
 * The number a member is promised — and ONLY that number.
 *
 * A first pass matched every number-word in the opener and reported three false failures: "one to five" is the
 * SCALE, and "Four weeks in" is how long they have been rebuilding. Both are true sentences that happen to
 * contain a numeral. The count is the one attached to the items — "Six of these", "There are twelve of them",
 * "A dozen of these" — so match that phrase rather than the digits near it.
 */
function claimsIn(source: string, constant: string): number[] {
  const start = source.indexOf(`const ${constant} =`);
  assert.notEqual(start, -1, `${constant} not found — was it renamed?`);
  // FIND THE END OF THE STATEMENT BY INDENTATION, NOT BY PUNCTUATION. Two earlier attempts cut at the first ';'
  // and both were wrong for the same reason: a semicolon is not a statement terminator when it is inside a
  // string. The first found the one in this test's own explanatory comment; the second found one in the copy
  // ITSELF — "weight or finishing an event; it's the point where you notice your world got bigger". A guard on
  // member-facing prose cannot assume the prose is free of code punctuation. The declaration continues for as
  // long as its lines are indented, and ends at the next top-level line.
  const lines = source.slice(start).split('\n');
  const body = lines
    .slice(0, lines.findIndex((l, i) => i > 0 && /^\S/.test(l)) || undefined)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)) // comments legitimately discuss the OLD counts
    .join(' ');

  const found: number[] = [];
  for (const m of body.matchAll(/\b(?:there are\s+)?(a dozen|two dozen|[a-z]+)\s+of\s+(?:these|them)\b/gi)) {
    const word = m[1]!.toLowerCase().replace(/^a\s+/, '');
    if (word in WORD) found.push(WORD[word]!);
  }
  return found;
}

const CHECKPOINTS = [
  { phase: 'rewire', file: 'lib/agent/rewire.ts', constant: 'W3_CHECKPOINT_OPEN', items: CHECKPOINT_COMMITMENT_ITEMS },
  { phase: 'rebuild', file: 'lib/agent/rebuild.ts', constant: 'B4_CHECKPOINT_OPEN', items: CHECKPOINT_CONTROL_ITEMS },
  { phase: 'reclaim', file: 'lib/agent/reclaim.ts', constant: 'C4_CHECKPOINT_OPEN', items: CHECKPOINT_CHALLENGE_ITEMS },
];

test('EVERY CHECKPOINT PROMISES THE NUMBER OF ITEMS IT ACTUALLY ASKS', () => {
  const lies: string[] = [];
  for (const c of CHECKPOINTS) {
    const claims = claimsIn(readFileSync(c.file, 'utf8'), c.constant);
    assert.ok(claims.length > 0, `${c.phase}'s checkpoint never tells the member how many — say the number`);
    for (const n of claims) {
      if (n !== c.items.length) lies.push(`${c.phase}: promises ${n}, administers ${c.items.length}`);
    }
  }
  assert.deepEqual(lies, [], `the Companion is promising a count it does not deliver:\n${lies.join('\n')}`);
});

test('the three checkpoints are the same length, so "consistent between Rs" is true', () => {
  // Jay, same walk: "are these Ceremonies consistent between Rs?" They are — and the item counts are too. If a
  // future re-cut makes one longer that is a decision, not a bug; this failing is the prompt to say so out loud.
  const lengths = CHECKPOINTS.map((c) => c.items.length);
  assert.deepEqual(lengths, [6, 6, 6], `checkpoint lengths diverged: ${lengths.join(', ')}`);
});
