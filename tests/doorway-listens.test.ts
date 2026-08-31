import { test } from 'node:test';
import assert from 'node:assert/strict';
import { didNotAnswer } from '../lib/agent/onboarding-staged.ts';

// DONNA'S WALK, 2026-08-30. She wrote a version of "It asked me a question, disregarded my answer, and moved on"
// SIX times across four Sessions — the Drift Quiz, the Disinformation Audit, the Visualization Workshop, the False
// Start Protocol (twice) and Strengths & Weaknesses. One cause: the doorway's hold-detector required a message to
// BOTH end in '?' AND start with a wh-word. Ten of twelve ordinary "I don't follow" phrasings advanced.
//
// These tests are the contract in both directions, because the mirror-image bug — holding a real answer — would be
// just as bad and much harder to notice.

const CONFUSED = [
  'What does read hardest mean?',
  "I don't understand what you mean",
  "I'm not sure what you're asking",
  'Not sure what that means?',
  "I don't get it, what does that mean?",
  'Can you explain that',
  'Sorry, what?',
  'huh?',
  'That question makes no sense to me',
  'Explain please',
  'Can you say that differently',
  "I'm confused",
  'What is it I should be looking at?',
];

// Real answers. Every one of these MUST advance — a doorway that holds an answer is the opposite failure, and it
// would read to a member as the product refusing to accept what she said.
const ANSWERS = [
  'The body, probably.',
  'My marriage. That one still stings.',
  'Money, honestly.',
  'What I miss is riding',                    // starts with a wh-word and IS an answer
  'How I used to feel on a Saturday',         // ditto
  'Losing the job, and then my dad.',
  'Probably the money one.',
  'the quiet',
];

test('a member who says she does not follow is HELD, not moved past', () => {
  const advanced = CONFUSED.filter((m) => !didNotAnswer(m));
  assert.deepEqual(advanced, [], 'these all mean "I did not answer" — none may advance the doorway');
});

test('a real answer always ADVANCES — holding one is the mirror-image bug', () => {
  const held = ANSWERS.filter((m) => didNotAnswer(m));
  assert.deepEqual(held, [], 'a doorway that holds an answer refuses what the member just said');
});

test('a wh-word opener alone never holds — that widening was the tempting wrong fix', () => {
  // "What I miss is riding" is an answer. Had the fix simply ORed the two old conditions, this would have held.
  assert.equal(didNotAnswer('What I miss is riding'), false);
  assert.equal(didNotAnswer('What does read hardest mean?'), true, 'but with a question mark it is a question');
});

test('silence is not an answer', () => {
  for (const m of ['', '   ', '\n']) assert.equal(didNotAnswer(m), true);
});

test('THE REGRESSION: the old two-condition predicate let ten of these through', () => {
  // Kept as the measurement that justified the change, so a future narrowing shows up as this test going quiet.
  const asksBack = (m: string) => {
    const t = (m ?? '').trim();
    return t.endsWith('?') && /^(what|why|how|who|when|where|do|does|did|is|are|can|could|should|will|would)\b/i.test(t);
  };
  const missedByOld = CONFUSED.filter((m) => !asksBack(m));
  assert.ok(missedByOld.length >= 9, `the old predicate missed ${missedByOld.length} of ${CONFUSED.length}`);
  assert.deepEqual(missedByOld.filter((m) => !didNotAnswer(m)), [], 'and the new one catches every one it missed');
});
