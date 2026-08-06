// ONE CORPUS, EVERY COMMIT GATE.
//
// Four arcs each grew their own confirm regex for the same question — "I've proposed this; do you commit?" They were
// forked from one another, so they looked alike and behaved differently, and each had its own holes. Measured against
// the corpus below before the fix:
//
//     B3 pilot 14/18 missed · C1 refine 14/18 missed · C3 quality 15/18 missed · reclaim shape gate 10/12 missed
//
// A miss is not cosmetic. The member says yes and gets "tell me what you'd change" — Greg lost a session to it on
// 2026-08-06, replying "lock in" to a Companion that had just offered "Want to lock them in, or tweak one?".
//
// The vocabulary now lives once, in confirmsProposal. THIS TEST IS THE THING THAT KEEPS IT THERE: every gate is
// asserted against the same lists, so a fifth fork — or a well-meaning tweak to one gate — fails here rather than in
// someone's session. When you add a gate, add it to GATES.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotConfirms } from '../lib/agent/rebuild.ts';
import { refineConfirms, c3Confirms } from '../lib/agent/reclaim.ts';
import { saysYes } from '../lib/agent/onboarding-staged.ts';

// Every gate that answers "do you commit to what I just proposed?".
const GATES: [string, (m: string) => boolean][] = [
  ['B3 pilot plan', pilotConfirms],
  ['C1 list refine', refineConfirms],
  ['C3 quality day', c3Confirms],
  ['reclaim shape gate', saysYes],
];

// Ordinary ways a person says yes. Nothing exotic — this is the floor, not the ceiling.
const CONFIRMS = [
  'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'yes please', 'please do',
  'lock in', 'lock them in', 'lock it in', 'locked in',        // ← "lock in" is Greg's
  'save it', 'save that', 'saved', 'keep it', 'commit', 'confirmed', 'done',
  'do it', 'go ahead', 'go for it', "let's do it", "let's go", 'send it',
  'perfect', 'great', 'good', 'nice', 'fine', 'excellent', 'love it',
  'absolutely', 'definitely', 'totally', 'exactly', 'of course', 'for sure',
  "that's it", "that's the one", "that's right", 'that works', 'this works',
  'works for me', 'sounds good', 'sounds right', 'looks good', 'all good',
  "i'm in", "i'm good", 'ready', 'good to go', 'agreed',
];

// Replies that must NEVER commit. Over-firing is the expensive direction at a commit gate: it saves an artifact the
// member never agreed to, silently, with nothing afterwards to show it went wrong.
const NOT_CONFIRMS = [
  'no', 'nope', 'not quite', 'not yet', 'not really',
  'yes but make it twice a week',            // CAT-34 — a change riding on an affirmation
  "yeah, but I'd rather do three days",
  'can we change the eating one',
  'actually make it 3 days',
  "I'd prefer mornings",
  'can you swap the second one',
  'How will I track it?',                    // ← Greg's next message. A question is not a yes.
  'what happens next?',
  'good question, how do I log this?',       // opens with a confirm word, is not a confirm
  'ok but what does that mean',
];

for (const [name, gate] of GATES) {
  test(`${name} — accepts an ordinary yes`, () => {
    const missed = CONFIRMS.filter((c) => !GATE_DEPENDENT.has(c) && !gate(c));
    assert.deepEqual(missed, [], `${name} would answer these with "tell me what you'd change": ${JSON.stringify(missed)}`);
  });

  test(`${name} — never commits on a change, a refusal, or a question`, () => {
    const wrong = NOT_CONFIRMS.filter((c) => gate(c));
    assert.deepEqual(wrong, [], `${name} would commit an artifact the member did not agree to: ${JSON.stringify(wrong)}`);
  });
}

// Phrases whose meaning GENUINELY depends on which question was asked — the one lesson worth not flattening. At a
// commit gate ("save this?") "keep it" is a yes. At the shape gate ("shall I merge these two?") it means keep them
// SEPARATE, i.e. no. Sharing a vocabulary must not erase a real difference in what was asked.
const GATE_DEPENDENT = new Set(['keep it']);

test('THE GATES AGREE WITH EACH OTHER — that is the whole point', () => {
  // Before the sweep, the same sentence confirmed in Rebuild and dead-ended in Reclaim. Any divergence here means a
  // gate has started to fork again — except where the QUESTION genuinely differs (GATE_DEPENDENT).
  for (const phrase of [...CONFIRMS, ...NOT_CONFIRMS].filter((p) => !GATE_DEPENDENT.has(p))) {
    const verdicts = GATES.map(([, g]) => g(phrase));
    assert.equal(
      new Set(verdicts).size,
      1,
      `"${phrase}" is read differently by different gates: ${GATES.map(([n], i) => `${n}=${verdicts[i]}`).join(', ')}`,
    );
  }
});

test('the shape gate keeps its own vocabulary ON TOP of the shared core', () => {
  // "merge them" answers the shape proposal specifically and means nothing at the other gates — shared core plus
  // per-gate extras, not one regex flattened across every question.
  assert.equal(saysYes('merge them'), true);
  assert.equal(saysYes('combine those'), true);
  assert.equal(saysYes('move it to the playbook'), true);
});

test('a refusal at the shape gate outranks any warmth in it', () => {
  // "sounds good, but keep both" must not collapse two wants into one. Losing a want is the expensive direction.
  assert.equal(saysYes('keep both'), false);
  assert.equal(saysYes("they're different"), false);
  assert.equal(saysYes('sounds good but keep both'), false);
  assert.equal(saysYes('no, separate goals'), false);
});

test('empty and whitespace never confirm', () => {
  for (const [name, gate] of GATES) {
    assert.equal(gate(''), false, name);
    assert.equal(gate('   '), false, name);
  }
});
