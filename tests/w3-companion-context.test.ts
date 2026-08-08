import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextBlock, type CheckinContext } from '../lib/agent/checkin.ts';

// What the COMPANION is told during a W3 monitoring week.
//
// This is the seam between the store (proven elsewhere) and the model. The store can be perfect and the week
// still fail, because the agent asks the wrong question or invents a trigger the member never named. Greg's
// requirement is unusually strict about authorship — "The system cannot supply a trigger list" — and the only
// place that can be violated at runtime is this text.

const base = (): CheckinContext =>
  ({
    displayName: 'Reshma',
    identityNoun: 'runner',
    doorDisplayNames: [],
    idScore: null,
    direction: null,
    currentFocus: null,
    lastCompletedAsset: null,
    reclaimList: [],
  }) as unknown as CheckinContext;

const w3 = (over: Partial<NonNullable<CheckinContext['practiceWeek']>> = {}): CheckinContext => ({
  ...base(),
  practiceWeek: {
    kind: 'w3_logging',
    day: 3,
    rows: [{ label: 'Noticed the day', target: null, done: 2, todayDone: false }],
    tappable: false,
    triggers: ['late nights after a rough day', 'when I travel'],
    readyToClose: false,
    review: null,
    ...over,
  },
});

test("the agent is given the member's triggers VERBATIM", () => {
  const text = contextBlock(w3());
  assert.match(text, /late nights after a rough day/, 'their words, not a tidied label');
  assert.match(text, /when I travel/);
});

test('the agent is told to ASK which trigger fired, never to decide', () => {
  const text = contextBlock(w3());
  assert.match(text, /ask lightly which one it was/i);
  assert.match(text, /Never decide for them which trigger fired/i);
  // Greg: "The system cannot supply a trigger list or a recovery script."
  assert.match(text, /not a menu you invented/i);
});

test("'new' is presented as a real answer, not a gap", () => {
  const text = contextBlock(w3());
  assert.match(text, /'new'/);
  assert.match(text, /a real answer and\s+not a gap|real answer/i);
});

test('a W3 week is never described as markable by the agent', () => {
  const text = contextBlock(w3());
  assert.match(text, /mirrors a log they keep themselves/i, 'W3 is not tappable — the agent must not tick cells');
  assert.doesNotMatch(text, /mark_practice_day/, 'the marking tool must not be suggested for this week');
});

test('the no-verdict rule travels with the week', () => {
  const text = contextBlock(w3());
  assert.match(text, /NEVER present this as compliance or a score/i);
  assert.match(text, /A blank day is a day, not a miss/i);
});

test('a member who named no triggers is described honestly, not papered over', () => {
  const text = contextBlock(w3({ triggers: [] }));
  assert.match(text, /\(none named\)/, 'the agent must know the list is empty rather than infer one');
  assert.doesNotMatch(text, /late nights/);
});

test('the trigger instruction appears ONLY for W3 — other weeks are untouched', () => {
  const b3 = {
    ...base(),
    practiceWeek: {
      kind: 'b3_pilot', day: 2,
      rows: [{ label: '15 minutes of functional fitness', target: 5, done: 1, todayDone: false }],
      tappable: true, readyToClose: false, review: null,
    },
  } as CheckinContext;
  const text = contextBlock(b3);
  assert.doesNotMatch(text, /which one it was/i, "B3's week must not inherit W3's trigger questioning");
  assert.match(text, /mark_practice_day/, 'B3 IS tappable and keeps its marking instruction');
});
