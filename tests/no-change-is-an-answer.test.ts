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

// ── C1 SHOWS HER THE LIST ─────────────────────────────────────────────────────────────────────────────────────
// Donna, 2026-08-30: "This needs to show me the Reclaim List instead of expecting me to go backwards to my
// Dashboard and then back into this. As I continue through the exercise it just feels like I'm flying blind."
//
// C1's opening announced "Your Reclaim List, from Reconnect" and then talked ABOUT it for three beats without
// ever showing it — and the code comment inside that copy claimed "the list is real and on screen". It was not.
// Six passes then asked her to revise a list she could not see.
import { reclaimC1PassesOpening } from '../lib/agent/reclaim.ts';

const SEP = String.fromCharCode(30);
const ITEMS = ['Lose 20 lbs.', 'Regain strength and fitness', 'Cover monthly expenses'];

test("C1's opening SHOWS the list, not just a heading for it", () => {
  const reply = reclaimC1PassesOpening(ITEMS).reply;
  for (const item of ITEMS) assert.ok(reply.includes(item), `${item} must be on screen`);
});

test('her items are rendered VERBATIM — never tidied, re-ordered or summarised', () => {
  // This is the one place she is asked whether her own sentences still fit. Showing a cleaned-up version would be
  // asking about something she never wrote.
  const messy = ['lose 20 lbs.', 'Find steady employment in a creative role (can be freelance)'];
  const reply = reclaimC1PassesOpening(messy).reply;
  for (const item of messy) assert.ok(reply.includes(item), `${item} verbatim`);
});

test('the list sits immediately before the question about it', () => {
  const bubbles = reclaimC1PassesOpening(ITEMS).reply.split(SEP);
  const listAt = bubbles.findIndex((b) => b.includes(ITEMS[0]!));
  const askAt = bubbles.findIndex((b) => /Reading it now/.test(b));
  assert.ok(listAt >= 0 && askAt >= 0);
  assert.equal(askAt, listAt + 1, 'she reads the list, then is asked about it — and the turn ends on the ask');
});

test('NO LIST → NO EMPTY HEADING. An absent list never renders as "you wrote nothing"', () => {
  const reply = reclaimC1PassesOpening([]).reply;
  assert.ok(!reply.includes('· '), 'nothing bulleted');
  assert.match(reply, /Reading it now/, 'and the opening still stands');
});
