import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saysNothingToChange, memberDeflecting } from '../lib/agent/onboarding-intent.ts';

// DONNA, 2026-08-30, in C1: "I ended up saying 'list holds' or 'list is fine' six times (I counted)." And:
// "it keeps reverting to its protocol and asking more questions... It moved on when I explicitly asked it to twice."
//
// C1 runs Greg's six revision passes and each advanced on memberDeflecting — a REFUSAL signal. The answer those
// passes actually invite ("nothing to change here") matched nothing, so every pass held her to its turn cap.
// The comment above the bug already said "'Nothing' is an answer, not a failure to answer." The code did not.

const NO_CHANGE = [
  'list holds', 'list is fine', 'the list holds', 'The list stands.', 'list looks good',
  'nothing to change', 'nothing needs changing', 'nothing to add', 'no changes', 'no change',
  'same as before', 'leave it as is', 'keep the list the same', "it's fine", "that's fine",
  'all good', 'fine', 'unchanged',
];

// A revision pass exists to catch a real edit. Reading any of these as "nothing to change" would DROP the change
// the member just asked for — the failure that would be far worse than the one being fixed.
const REAL_CHANGES = [
  'Add sleep through the night',
  'Drop the debt one',
  'Change the first one to say strength, not fitness',
  'My marriage holds me back, put that first',       // contains "holds"
  'The money one stands out as the hardest',          // contains "stands"
  'Nothing about the money one feels right anymore',  // starts "Nothing" but IS a change
  'I want to reword the second item',
  'That one is fine but the third needs work',        // contains "is fine" AND a change
];

test('"nothing to change" is recognised as an ANSWER to a revision pass', () => {
  const missed = NO_CHANGE.filter((m) => !saysNothingToChange(m));
  assert.deepEqual(missed, [], 'these all mean the pass is answered — none may hold the member');
});

test('a real edit is NEVER swallowed as "no change"', () => {
  const swallowed = REAL_CHANGES.filter((m) => saysNothingToChange(m));
  assert.deepEqual(swallowed, [], 'reading a change as "nothing" would drop what she asked for');
});

test('a bare affirmative only counts when it IS the message', () => {
  assert.equal(saysNothingToChange('fine'), true);
  assert.equal(saysNothingToChange('That one is fine but the third needs work'), false,
    'the same word inside a longer sentence is not a no-change answer');
});

test('THE REGRESSION: the refusal signal alone caught almost none of these', () => {
  // memberDeflecting is not wrong — it answers a different question. Kept as the measurement that justified
  // adding a second signal rather than widening it, since widening a refusal detector to include contentment
  // would make every "fine" read as "stop asking".
  const caughtByRefusal = NO_CHANGE.filter((m) => memberDeflecting(m));
  assert.ok(caughtByRefusal.length <= 2, `refusal caught ${caughtByRefusal.length}/${NO_CHANGE.length} — that gap is the bug`);
  assert.deepEqual(NO_CHANGE.filter((m) => !saysNothingToChange(m) && !memberDeflecting(m)), [],
    'together they now cover every phrasing she used');
});
