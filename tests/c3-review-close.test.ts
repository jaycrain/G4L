// C3'S WEEK ENDS IN GREG'S REVIEW, NOT IN A COUNT.
//
// C3.md:608–622 specifies three review stages: pattern review (what stands out, the conditions that supported
// quality, the barriers that interfered, a TENTATIVE summary), the process-product connection, and a closing that
// affirms the habit. The generic week close read the counts back and stopped.
//
// It runs in the dashboard Companion's week-close turn rather than as a Session, because that is where a week
// already ends — inventing a second Session for it would have been a new pattern where one existed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReview } from '../lib/practice/close.ts';
import { detectVoiceTells } from '../lib/agent/voice-gate.ts';

const grid = (rows: Array<{ label: string; done: number }>) =>
  ({ kind: 'c3_quality' as const, rows: rows.map((r) => ({ ...r, slot: r.label, marks: [], target: null })) }) as never;

const FULL = grid([
  { label: 'Moved my body', done: 5 },
  { label: 'Some calm', done: 3 },
  { label: 'Real connection', done: 1 },
]);

test('C3-86 · it asks for the CONDITIONS and the BARRIERS — it does not supply them', () => {
  // Greg's testable-as wants both. Asked, not concluded: a summary that supplied them would be the narrative of
  // growth C2-37 forbids, one Session later.
  const r = buildReview(FULL);
  const all = [r.opener, ...r.lines].join('\n');
  assert.match(all, /what was going on in the days that felt like quality/i, 'the conditions');
  assert.match(all, /what got in the way/i, 'the barriers');
});

test('the pattern summary is TENTATIVE, and never claims cause', () => {
  const r = buildReview(FULL);
  const all = [r.opener, ...r.lines].join('\n');
  assert.match(all, /may be telling you/i, "Greg's own hedged register");
  // Seven days cannot support a claim about someone's life. The deny-list is the same one C2-81 asks for.
  assert.deepEqual(detectVoiceTells(all).filter((t) => t.startsWith('causality:')), [], 'the close overclaims');
});

test('no pattern is invented from a week that has none', () => {
  // Two elements one day apart is not a shape. Naming one would be inventing the thing stage 6 exists to draw out.
  const flat = buildReview(grid([{ label: 'Moved my body', done: 2 }, { label: 'Some calm', done: 2 }]));
  const all = [flat.opener, ...flat.lines].join('\n');
  assert.doesNotMatch(all, /showed up most/i, 'no pattern claimed from a flat week');
  assert.match(all, /does not fall into an obvious shape/i, 'and it says so rather than going quiet');
});

test('C3-87 · it never promises wellness as an outcome of tracking', () => {
  // The one thing this close must not do, and exactly what a close about good days is tempted to do.
  for (const g of [FULL, grid([{ label: 'Moved my body', done: 0 }])]) {
    const r = buildReview(g);
    const all = [r.opener, ...r.lines].join('\n');
    assert.doesNotMatch(all, /will (feel|be) better|better days ahead|improves? your (wellbeing|health)|happier/i);
  }
});

test('stage 7 · tracking is the process, and the B3 parallel is named', () => {
  const all = [buildReview(FULL).opener, ...buildReview(FULL).lines].join('\n');
  assert.match(all, /tracking is the process/i);
  assert.match(all, /pilot week in Rebuild/i, "Greg's own parallel");
});

test('stage 8 · it affirms the HABIT, not the results — including on an empty week', () => {
  // The distinction is the whole rule. A week with nothing marked still built the habit of looking, and a close
  // that only affirms a good week teaches a member that a bad one is not worth reporting.
  const empty = buildReview(grid([{ label: 'Moved my body', done: 0 }, { label: 'Some calm', done: 0 }]));
  const all = [empty.opener, ...empty.lines].join('\n');
  assert.match(all, /you watched your own days for a week/i, 'the habit is affirmed either way');
  assert.doesNotMatch(all, /well done|great work|proud/i, 'and never praised');
});

test('the review is what gets kept, so the member has it after the chat scrolls', () => {
  const r = buildReview(FULL);
  assert.ok(r.keeperBody.includes('Moved my body'), 'the counts are in the keeper');
  assert.ok(r.keeperBody.includes('tracking is the process') || r.keeperBody.includes('Tracking is the process'),
    'and so is what the week was for');
});
