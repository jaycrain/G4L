import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundToMemberWords } from '../lib/agent/member-words.ts';

// A PLAYBOOK ENTRY IS WHAT THEY SAID, NOT WHAT WE WROTE.
//
// Jay, 2026-08-12: the Companion offered to keep a sentence it had composed — "Visualization Sessions are feeding my
// fast rides and PRs — and those are killing the cravings. The loop is real." — in the first person, as his. He was
// asked to confirm it, which makes it survivable but not right: a member approving OUR sentence is not the same as
// us keeping THEIRS. His rule, set the day before: grammar, spelling, a little structure — never words in his mouth.
//
// The prompt now says so. These tests cover the part that does not depend on the model complying.

const SAID = [
  'The visualization Sessions are feeding my fast rides and I got two PRs this week',
  "honestly the rides are killing my cravings, I don't even want the bread",
];

test('a line the member actually typed comes back as THEIRS', () => {
  const g = groundToMemberWords('the rides are killing my cravings', SAID);
  assert.equal(g.grounded, 'verbatim');
  assert.match(g.text, /the rides are killing my cravings/);
});

test('A COMPOSED SENTENCE GROUNDS TO NOTHING — the exact line from Jay’s walk', () => {
  // Every noun in it came from him; the SENTENCE did not. That distinction is the whole rule, and it is why
  // "it sounds like him" was never the test.
  //
  // groundToMemberWords hands the input BACK when it cannot find it — deciding what to do about that is the
  // caller's job, not the matcher's, and the assertion below is at the layer that actually decides. (I first
  // wrote this against the returned text and it failed for the right reason: I was testing the wrong layer.)
  const g = groundToMemberWords(
    'Visualization Sessions are feeding my fast rides and PRs — and those are killing the cravings. The loop is real.',
    SAID,
  );
  assert.equal(g.grounded, 'none', 'not his — so the handler refuses it rather than storing ours');
});

test('and so does a line that borrows none of his words — same verdict, which is the point', () => {
  // Borrowing his nouns does not make a sentence his. Both cases land on 'none', so the handler treats a
  // plausible-sounding composition exactly as strictly as an obviously invented one.
  const g = groundToMemberWords('Consistency compounds and the compound effect is undeniable.', SAID);
  assert.equal(g.grounded, 'none');
});

// ── the wiring, asserted at the call site ────────────────────────────────────────────────────────────────────
const HANDLER = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
const PROMPT = readFileSync(new URL('../lib/agent/checkin.ts', import.meta.url), 'utf8');

test('the handler GROUNDS the proposal instead of storing the model’s wording', () => {
  const block = HANDLER.slice(HANDLER.indexOf("name === 'propose_playbook_entry'"));
  const scoped = block.slice(0, block.indexOf("name === 'create_measure'"));
  assert.match(scoped, /groundToMemberWords\(proposed, said\)/, 'the body is grounded before it is stored');
  assert.match(scoped, /grounded === 'none'/, 'and an ungrounded proposal is refused, not silently kept');
  assert.match(scoped, /section !== 'why_works'/, 'why_works is exempt — the science was never their phrasing');
});

test('the tool tells the model the body must be the member’s own words', () => {
  assert.match(PROMPT, /THE BODY MUST BE THE MEMBER'S OWN WORDS/, 'stated where the model reads it');
  assert.match(PROMPT, /may NOT compose a sentence for them/);
  assert.doesNotMatch(PROMPT, /Phrase it tight, in their voice/, 'the old licence to compose is gone');
});

test('OUR NAMED TERMS ARE PROTECTED IN THE PROMPT', () => {
  // The same shot used "the loop" to mean an everyday feedback cycle. The Loop is the specific pattern where
  // Reclaim fades and the member Reconnects — a member who has been taught it should never have to work out which
  // one we meant. (I made the identical mistake in code comments hours earlier, calling entry points "doors".)
  assert.match(PROMPT, /OUR NAMED TERMS MEAN ONE THING EACH/);
  assert.match(PROMPT, /do NOT call any other cycle, feedback or connection "the loop"/i);
  for (const term of ['The Fade is', 'The Door is', 'The Journey is']) {
    assert.ok(PROMPT.includes(term), `${term} … is defined for the model`);
  }
});
