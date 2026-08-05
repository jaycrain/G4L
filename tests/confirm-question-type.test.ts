// A NEGATION MEANS OPPOSITE THINGS DEPENDING ON THE QUESTION WE ASKED.
//
//     asked "…or is there more to it?"        "Not really"  →  no more        →  DONE
//     asked "does that name the shape of it?" "Not really"  →  you got it wrong → DISPUTE
//
// One predicate was serving both. It was written conservatively — correctly — for the gap's "is there more?", then
// reused at four Reconnect confirms that ask the opposite. Measured against real dispute phrasings, 9 of 12 read as
// `done`: the member pushes back and the engine records agreement. Nothing looks wrong afterwards, which is what
// makes it the worst failure shape here — she said "that's not me" and we committed it anyway.
//
// The fix can't be a wider regex; the two families are word-for-word identical at the opening. So the question is
// now an argument. Both directions are fixtured at BOTH gates, because over-firing traps a member in a re-open loop
// and that is its own failure.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGapConfirm, resolveConfirmCorroborated, memberRejectsReflection } from '../lib/agent/onboarding-intent.ts';
import { isKeeperMaterial } from '../lib/agent/reconnect.ts';

const atMore = (m: string) => resolveGapConfirm(m, undefined, 'anything_more');
const atRight = (m: string) => resolveGapConfirm(m, undefined, 'is_this_right');

test('THE SAME WORDS, THE OPPOSITE MEANING', () => {
  // The pair that makes a regex-only fix impossible.
  assert.equal(atRight('Not really, no.'), 'dispute');
  assert.equal(atRight('Not really, that covers it.'), 'done');
  assert.equal(atRight("No, that's not it."), 'dispute');
  assert.equal(atRight("No, that's it."), 'done', 'the negation answers "anything to change?", not the reflection');
});

test('a member rejecting the reflection is HEARD — the 9 that were missed', () => {
  for (const no of [
    'No, that is not it at all',
    'Not really, no',
    'No — you have missed it',
    'Not exactly',
    'Hmm, not really',
    'No that misses the point',
    'I would not put it that way',
    'That is wrong',
    'Nope, not that',
    'No.',
    "That's off base",
    "That's not me",
  ]) {
    assert.equal(atRight(no), 'dispute', `"${no}" is a member pushing back — never record it as agreement`);
  }
});

test('BUT A CONFIRM IS STILL A CONFIRM — no re-open loop', () => {
  for (const yes of [
    "Yes.", "That's exactly it.", 'Perfectly depicted.', 'Spot on',
    "No, that's it.", 'No, nothing else', 'No more', 'Nope, that is everything',
    "Not really, that covers it.", "That's the shape of it",
  ]) {
    assert.notEqual(atRight(yes), 'dispute', `"${yes}" accepts the reflection — do not reopen`);
  }
});

test('THE GAP GATE IS UNCHANGED — its conservatism was correct', () => {
  // The whole risk of adding a question type is silently changing the gate that already worked. A bare "no" there
  // answers "is there more?" and must keep meaning DONE.
  for (const m of ['No.', 'Nope', 'Not really', "No, that's it", 'No, nothing else', 'Not exactly']) {
    assert.notEqual(atMore(m), 'dispute', `"${m}" at "is there more?" means no more — must still advance`);
  }
});

test('an addition still draws out at both gates', () => {
  const adding = 'Yes, and there was the thing with my brother I have not mentioned yet.';
  assert.equal(atRight(adding), 'addition');
  assert.equal(atMore(adding), 'addition');
});

test('A REJECTION IS NEVER OVERRULED by the model tag', () => {
  // The corroboration gate only ever converts 'more' → 'done'. It must never soften a dispute the member gave.
  const resolve = (m: string, i?: 'done' | 'more' | 'dispute') =>
    resolveConfirmCorroborated(m, i, isKeeperMaterial, 'is_this_right');
  assert.equal(resolve('Not really, no.', 'done'), 'dispute', 'the model saying "done" cannot erase her "no"');
  assert.equal(resolve('Not really, no.', 'more'), 'dispute');
  assert.equal(resolve('That is wrong', 'done'), 'dispute');
  // …and the praise fix from the previous batch still holds.
  assert.equal(resolve('Perfectly depicted.', 'more'), 'done');
});

test('memberRejectsReflection is inert on empty input', () => {
  assert.equal(memberRejectsReflection(''), false);
  assert.equal(memberRejectsReflection('   '), false);
});

test('the /g regex inside it does not alternate between calls', () => {
  // GAP_CONFIRM_WORDS_RE is /g — a stale lastIndex would make repeated calls flip-flop. Call twice, same answer.
  for (const m of ["No, that's it.", 'Not really, no.', "That's exactly it."]) {
    assert.equal(memberRejectsReflection(m), memberRejectsReflection(m), `unstable for "${m}"`);
    assert.equal(atRight(m), atRight(m));
  }
});
