import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextBlock, type CheckinContext, type PracticeWeekCtx } from '../lib/agent/checkin.ts';

// FOUR WEEKS AT ONCE IS THE DESIGN, NOT AN EDGE CASE.
//
// Jay, 2026-08-11, shown that he had four running and could see one: "hell yes that's ok, that's what Greg wants!
// If all you have to do is click four boxes a day, or not, that's not too much to ask." The Playbook was fixed to
// render every open week. The Companion's context was not — it read `activePracticeWeek` (singular, newest), so
// the agent could be confidently blind to three weeks the member is looking at, which is exactly what CLAUDE.md
// forbids: no data the member can see is invisible here.
//
// The hard part is NOT visibility. It is that four weeks must not become four questions.

const week = (kind: string, label: string, day: number, over = false): PracticeWeekCtx => ({
  kind,
  label,
  day,
  rows: [{ label: `${label} row`, target: null, done: 1, todayDone: false }],
  tappable: true,
  readyToClose: over,
  review: over ? { opener: `${label} is done`, lines: ['one', 'two'] } : null,
});

const ctx = (weeks: PracticeWeekCtx[], primary?: PracticeWeekCtx): CheckinContext =>
  ({ doorDisplayNames: [], idScore: null, practiceWeeks: weeks, practiceWeek: primary ?? weeks[0] }) as CheckinContext;

const practiceLine = (c: CheckinContext): string =>
  contextBlock(c).split('\n').find((l) => /practice week|ALSO RUNNING|THEIR PRACTICE WEEK/i.test(l)) ?? '';

test('EVERY OPEN WEEK IS NAMED — the agent cannot be blind to three of four', () => {
  const line = practiceLine(
    ctx([
      week('c3_quality', 'Quality Days', 1),
      week('b3_pilot', 'The Lifestyle Pilot', 3),
      week('b2_noticing', 'Your map', 5),
      week('w3_logging', 'Mindful Monitoring', 6),
    ]),
  );
  for (const name of ['The Lifestyle Pilot', 'Your map', 'Mindful Monitoring']) {
    assert.ok(line.includes(name), `${name} is named to the Companion`);
  }
});

test('AND IT ASKS ABOUT ALL OF THEM — Jay overruled my "ask about one"', () => {
  // I shipped this asking about a single week, on the reasoning that four would be a roll call. Jay, same day:
  // "I don't think the roll call is a bad thing. You might be a little too concerned about that, feedback and
  // interaction is a good thing." Asking IS the engagement — a member running four weeks chose four.
  const line = practiceLine(
    ctx([week('c3_quality', 'Quality Days', 1), week('b3_pilot', 'The Lifestyle Pilot', 3), week('b2_noticing', 'Your map', 5)]),
  );
  assert.match(line, /ask about these too/i, 'the other weeks carry an ask, not just state');
  assert.doesNotMatch(line, /do NOT ask about each one/i, 'the old restraint is gone');
  assert.match(line, /Cover every one that still has a day open/i);
  // What survived is craft, not scope.
  assert.match(line, /in one beat/i, 'one beat, not four separate questions');
  assert.match(line, /never re-asked/i, 'a week already marked today is acknowledged, not asked again');
});

test('a week already fully marked today is reported as marked, not as an open ask', () => {
  const done = week('b3_pilot', 'The Lifestyle Pilot', 3);
  done.rows = [{ label: 'walk', target: null, done: 1, todayDone: true }];
  const line = practiceLine(ctx([week('c3_quality', 'Quality Days', 1), done]));
  assert.match(line, /The Lifestyle Pilot \(day 3 of 7 — all marked today\)/);
  assert.doesNotMatch(line, /still open today: walk/);
});

test('a member with ONE week gets no "also running" clause at all', () => {
  const line = practiceLine(ctx([week('b3_pilot', 'The Lifestyle Pilot', 2)]));
  assert.doesNotMatch(line, /ALSO RUNNING/i, 'nothing invented for a member who has one');
});

test('A FINISHED WEEK OUTRANKS THE NEWEST — weeks start on different days', () => {
  // The one that elapsed is often NOT the newest, and under the old newest-only read a week could finish and
  // never be reviewed at all. This is the case that made the singular read actively wrong, not merely partial.
  const newest = week('c3_quality', 'Quality Days', 1);
  const finished = week('w3_logging', 'Mindful Monitoring', 8, true);
  const raw = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /all\.find\(\(w\) => w\.readyToClose && w\.review\) \?\? all\[0\]/, 'finished first, else newest');

  // And the review line still leads when that is the primary.
  const line = practiceLine(ctx([newest, finished], finished));
  assert.match(line, /THEIR PRACTICE WEEK HAS FINISHED/i);
});

test('THE COMMITMENT NAMES ITS WEEK — a mark is not resolved by recency', () => {
  // "did my walk" used to be matched against the NEWEST week's commitments only, so a member whose walk lived in
  // an older week was told it "doesn't match anything on their week" — a refusal that reads as us losing it.
  const raw = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tool = src.slice(src.indexOf("name === 'mark_practice_day'"), src.indexOf("name === 'record_w3_day'"));

  assert.match(tool, /activePracticeWeeks\(db, memberId\)/, 'it looks at every open week');
  assert.match(tool, /kind = any\(\$2::text\[\]\)/, 'and searches commitments across all of them');
  assert.match(tool, /open\.find\(\(w\) => w\.kind === hit\.kind\)/, 'the matched commitment picks the week');
  assert.doesNotMatch(tool, /const pw = await activePracticeWeek\(/, 'never "the newest week"');
});

test('AN AMBIGUOUS COMMITMENT REFUSES rather than marking the wrong week', () => {
  // Two weeks can hold a similar label. Picking one silently marks a day on a week the member was not talking
  // about — invisible to them, and wrong in their own record. Same rule as retire_play.
  const raw = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tool = src.slice(src.indexOf("name === 'mark_practice_day'"), src.indexOf("name === 'record_w3_day'"));
  assert.match(tool, /sameLabel\.length > 1/, 'it detects the collision');
  assert.match(tool, /Do not guess/, 'and refuses out loud');
});

test('the confirmation NAMES the week, so the member can tell which was marked', () => {
  const raw = readFileSync(new URL('../app/dashboard/checkin-actions.ts', import.meta.url), 'utf8');
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /done for today on \$\{weekName\}/, 'the week is named back');
});
