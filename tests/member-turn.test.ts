import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMemberContent } from '../lib/agent/member-turn.ts';

// JAY'S REAL W1 SESSION, 2026-08-11 — every line his Playbook was shown, verbatim. The two signoffs are the bug he
// caught; the rest are his actual true lines and MUST survive. This fixture is the whole specification.
const KEEP = [
  "You're a bad ass", // 4 words — isKeeperMaterial drops this, which is why W1 needed its own predicate
  'Pick your spots with the splurges, not just when it\'s convenient',
  'You deserve to be true to yourself, it always feels better than a rationalization',
  'I have time to do whatever I choose, whatever is important to me',
  'I\'m going to show up at Big Sugar in the best shape of my life',
];
const DROP = [
  'No, that felt good', // the signoff Jay flagged — a decline to the "want to tighten one?" close-check
  "That's me", // assent to a reflection, filed as a belief about himself
];

for (const line of KEEP) test(`KEEP: ${line.slice(0, 52)}`, () => assert.ok(isMemberContent(line)));
for (const line of DROP) test(`DROP: ${line}`, () => assert.ok(!isMemberContent(line)));

// BIASED TO KEEP. A negation with an assertion behind it is a line, not a decline — the whole-message-intent rule.
test('a leading "no" with real content behind it is still a true line', () => {
  assert.ok(isMemberContent('No, the real line is that I still race'));
  assert.ok(isMemberContent("No, it's right there. I've been moving towards it the last 3 weeks"));
});

test('bare assents and verdicts on the conversation are never lines', () => {
  for (const s of ['yep', 'that\'s it', 'sounds good', 'I like that', 'perfect', 'nope', 'ok'])
    assert.ok(!isMemberContent(s), `${s} should not be kept`);
});

// The guard must not become a length filter by the back door — that is the exact mistake it exists to avoid.
test('short assertions survive; length is never the test', () => {
  for (const s of ['I am still that guy', 'I choose this', 'My body is mine'])
    assert.ok(isMemberContent(s), `${s} is short but asserts something`);
});

// ── DECLINE vs REACTION — opposite handling, on purpose ─────────────────────────────────────────────────────────
import { isDeclineReply } from '../lib/agent/member-turn.ts';

test('a decline closes the beat; a mid-beat reaction does not', () => {
  assert.ok(isDeclineReply('No, that felt good'), 'answering the close-check with no ends it');
  assert.ok(isDeclineReply('nope'));
  assert.ok(isDeclineReply('no'));
  // "That's me" is an assent, not a decline. If it closed the beat, reacting warmly in the middle would end the
  // session and lose the lines not yet written — a worse bug than the stray keeper this all started with.
  assert.ok(!isDeclineReply("That's me"));
  assert.ok(!isDeclineReply('nice'));
  // And a negation carrying an assertion is neither — it is a line.
  assert.ok(!isDeclineReply('No, the real line is that I still race'));
});

// ── W2 · THE PICTURE ────────────────────────────────────────────────────────────────────────────────────────────
// The hold beat ends "When you're ready, tell me what comes up" and then never read the answer. Jay's richest line
// of the session was discarded while "Big Sugar for sure" made the card ("Should have probably pulled this one").
test("the picture beat keeps the member's scene, and not their reaction to it", () => {
  const rich =
    'The energy of a thousand other racers around me and them behind the barriers cheering. ' +
    'The noise, I love that noise and anticipation';
  assert.ok(isMemberContent(rich), 'the line Jay lost must now land');
  // A bare reaction to the reveal is not scene material. Claimed in the comment, so it has to be true.
  for (const r of ['wow', 'whoa', "that's powerful", 'damn', 'hmm', 'amazing', "that's a lot"])
    assert.ok(!isMemberContent(r), `${r} is a reaction, not the picture`);
  // ...but the same words INSIDE a described scene are content, not a reaction. Whole-message intent, again.
  assert.ok(isMemberContent('The light is powerful there and it fills the whole street'));
});
