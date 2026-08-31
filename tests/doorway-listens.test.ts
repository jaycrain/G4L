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

// ── TWO QUESTIONS STACKED — the other half of "it didn't listen" ──────────────────────────────────────────────
//
// Donna, same walk, on the False Start Protocol: "It ended up stacking two questions on top of each other. And,
// when I answered the first question, there was no opportunity to answer the second one."
//
// receiveThen() joins the model's receipt to a SCRIPTED question. receiptOnly() is supposed to remove the model's
// own forward question first — but it only stripped one that was literally last. The model habitually asks and
// then adds a coda ("...what did that look like? Give me a glimpse"), so the text did not end in '?', nothing was
// stripped, and the member got two questions. She answers the first; the engine is waiting on the second.
//
// withQuestion() was hardened for this exact shape after two of Jay's walks, with a paragraph-scoped check and a
// comment saying so. The fix never reached receiptOnly — one fact, two sites, and the stale copy was the one
// feeding every scripted hand-off in the arc.
import { receiptOnly, receiveThen } from '../lib/agent/onboarding-staged.ts';

const CODA = 'That is a real loss. What did that look like for you? Give me a glimpse of that.';

test('a question with a coda after it is still stripped from the receipt', () => {
  assert.equal(receiptOnly(CODA), 'That is a real loss.');
});

test('THE MEMBER NEVER GETS TWO QUESTIONS in one scripted hand-off', () => {
  const reply = receiveThen(CODA, 'Before the ratings: where has your world actually got bigger since you started?');
  const questions = (reply.match(/\?/g) ?? []).length;
    assert.equal(questions, 1, `a hand-off must carry exactly one question, got ${questions}:\n${reply}`);
});

test('a reflection with no question is passed through whole', () => {
  const plain = 'Twelve years is a long time. That lands.';
  assert.equal(receiptOnly(plain), plain, 'nothing to strip — never trim a receipt that was not asking');
});

test('a turn that is ONLY a question leaves the scripted opener to stand alone', () => {
  assert.equal(receiptOnly('What did that cost you?'), '');
  assert.equal(receiveThen('What did that cost you?', 'Here is the next thing.'), 'Here is the next thing.');
});

test('a question in an earlier paragraph is kept — only the LAST paragraph is the forward ask', () => {
  // The model quoting the member's own question mid-reflection is not the model asking. Scoping to the last
  // paragraph is what keeps this from eating the receipt.
  const t = 'You asked me what the point was.\n\nThat is fair, and it lands.';
  assert.equal(receiptOnly(t), t);
});

test('THE REGRESSION: the old trailing-only strip left the coda case stacked', () => {
  const oldReceiptOnly = (m: string) => {
    const t = (m ?? '').trim();
    if (!t || !/\?\s*$/.test(t)) return t;
    return t.replace(/\s*[^.!?]*\?\s*$/, '').trim();
  };
  assert.equal(oldReceiptOnly(CODA), CODA, 'the old one stripped nothing here');
  const oldReply = `${oldReceiptOnly(CODA)} Before the ratings: where has your world got bigger?`;
  assert.ok((oldReply.match(/\?/g) ?? []).length === 2, 'which is how the member got two questions');
});
