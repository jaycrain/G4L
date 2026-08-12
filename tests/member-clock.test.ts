import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDate, mondayIndex, weekStart, weekEnd, trackerRun, currentWindow, priorWindow, columnFor, runIsOver, daysBetween,
} from '../lib/time/member-clock.ts';

// THE MEMBER'S CLOCK. Every date the product shows or stores should come from here.
//
// The bug: no timezone existed, so everything ran on UTC and a member in Denver had anything after 6pm local
// recorded as tomorrow. The tests that matter are the boundary ones — 6pm Denver, DST, and a Saturday close.

const DENVER = 'America/Denver';

test('6PM IN DENVER IS STILL TODAY — the exact bug', () => {
  // 2026-08-12T00:42Z is Jay's real C3 close. It was 6:42pm on the 11th for him, and we stored the 12th.
  assert.equal(localDate(DENVER, new Date('2026-08-12T00:42:46Z')), '2026-08-11');
  assert.equal(localDate(null, new Date('2026-08-12T00:42:46Z')), '2026-08-12', 'UTC is what we used to record');
  // And the midnight boundary itself, in summer (MDT, UTC-6).
  assert.equal(localDate(DENVER, new Date('2026-08-12T05:59:00Z')), '2026-08-11', 'a minute before local midnight');
  assert.equal(localDate(DENVER, new Date('2026-08-12T06:00:00Z')), '2026-08-12', 'and a minute after');
});

test('DST IS WHY WE STORE A ZONE AND NOT AN OFFSET', () => {
  // Boulder is UTC-6 in August and UTC-7 in December. A stored -6 would be right for half the year, which is
  // worse than none — it looks correct whenever you check it in summer.
  assert.equal(localDate(DENVER, new Date('2026-08-12T05:30:00Z')), '2026-08-11', 'MDT: 11:30pm on the 11th');
  assert.equal(localDate(DENVER, new Date('2026-12-12T05:30:00Z')), '2026-12-11', 'MST: 10:30pm on the 11th');
  assert.equal(localDate(DENVER, new Date('2026-12-12T07:30:00Z')), '2026-12-12', 'MST rolls an hour later in UTC');
});

test('an unknown or missing zone falls back to UTC rather than throwing at a member', () => {
  assert.equal(localDate('Mars/Olympus', new Date('2026-08-12T00:42:00Z')), '2026-08-12');
  assert.equal(localDate(null, new Date('2026-08-12T00:42:00Z')), '2026-08-12');
});

test('weeks run Monday to Sunday', () => {
  assert.equal(mondayIndex('2026-08-10'), 0, 'Monday is 0');
  assert.equal(mondayIndex('2026-08-16'), 6, 'Sunday is 6');
  assert.equal(weekStart('2026-08-13'), '2026-08-10', 'Thursday belongs to that Monday');
  assert.equal(weekEnd('2026-08-13'), '2026-08-16', 'and that Sunday');
  assert.equal(weekStart('2026-08-16'), '2026-08-10', 'Sunday belongs to the week that opened it, not the next');
});

test('THE PARTIAL FIRST WEEK: a Thursday close draws Thu-Sun, then rolls to Mon-Sun', () => {
  const run = trackerRun('2026-08-13'); // closed Thursday
  assert.deepEqual(
    { start: run.stub!.start, end: run.stub!.end, days: run.stub!.days, partial: run.stub!.partial },
    { start: '2026-08-13', end: '2026-08-16', days: 4, partial: true },
  );
  assert.deepEqual(
    { start: run.main.start, end: run.main.end, days: run.main.days },
    { start: '2026-08-17', end: '2026-08-23', days: 7 },
  );
  assert.equal(currentWindow(run, '2026-08-14').start, '2026-08-13', 'Friday is still in the stub');
  assert.equal(currentWindow(run, '2026-08-18').start, '2026-08-17', 'the following Tuesday is in the full week');
});

test('THE RUN ENDS - it does not roll on forever', () => {
  // The bug in the first version of this: it answered "what week is it now", so every Monday produced a fresh
  // week and a practice week became immortal. A practice week is BOUNDED; that is the point of it.
  const run = trackerRun('2026-08-13'); // Thursday
  assert.equal(runIsOver(run, '2026-08-23'), false, 'not on the closing Sunday itself');
  assert.equal(runIsOver(run, '2026-08-24'), true, 'over on the Monday after the full week');
  assert.equal(runIsOver(run, '2026-09-30'), true, 'and it stays over');
});

test('the stub stays visible once it has rolled - member ticks never vanish', () => {
  // Jay's call, 2026-08-12: a member who ticked four days Thu-Sun must not open the grid on Monday to an empty one.
  const run = trackerRun('2026-08-13');
  assert.equal(priorWindow(run, '2026-08-14'), null, 'while the stub IS the current week there is no prior');
  assert.equal(priorWindow(run, '2026-08-17')?.start, '2026-08-13', 'once rolled, the stub is shown above');
  assert.equal(priorWindow(trackerRun('2026-08-10'), '2026-08-12'), null, 'a Monday close never has one');
});

test('a MONDAY close has no stub - it is a full week immediately', () => {
  const run = trackerRun('2026-08-10');
  assert.equal(run.stub, null);
  assert.deepEqual({ start: run.main.start, end: run.main.end, days: run.main.days }, { start: '2026-08-10', end: '2026-08-16', days: 7 });
  assert.equal(runIsOver(run, '2026-08-17'), true, 'a Monday close is the seven days it always was');
});

test('A SATURDAY CLOSE IS THE EDGE THAT BREAKS THIS', () => {
  // Two days, then Mon-Sun. The reason the review rule exists: a one- or two-day stub is not a week.
  const run = trackerRun('2026-08-15');
  assert.deepEqual({ days: run.stub!.days, partial: run.stub!.partial, end: run.stub!.end }, { days: 2, partial: true, end: '2026-08-16' });
});

test('A SUNDAY CLOSE IS A ONE-DAY STUB, AND IT MUST NEVER TRIGGER A REVIEW', () => {
  // Otherwise a Sunday-afternoon close produces a one-day "week" and immediately reviews it, which would read as
  // the program mocking them.
  const run = trackerRun('2026-08-16');
  assert.deepEqual({ days: run.stub!.days, partial: run.stub!.partial }, { days: 1, partial: true });
  assert.equal(runIsOver(run, '2026-08-17'), false, 'the one-day stub must not end the run');
  assert.equal(runIsOver(run, '2026-08-23'), false, 'nor the Sunday closing the full week');
  assert.equal(runIsOver(run, '2026-08-24'), true, 'the Monday after the FULL week ends it');
});

test('columns are indexed from the window START, which is not always Monday', () => {
  const run = trackerRun('2026-08-13'); // Thu
  const stub = run.stub!;
  assert.equal(columnFor(stub, '2026-08-13'), 0, 'Thursday is column 0 in the stub');
  assert.equal(columnFor(stub, '2026-08-16'), 3, 'Sunday is the last');
  assert.equal(columnFor(stub, '2026-08-12'), null, 'the day before it started is outside');
  assert.equal(columnFor(stub, '2026-08-17'), null, 'and so is the Monday after');
  assert.equal(columnFor(run.main, '2026-08-17'), 0, 'Monday is column 0 in the full week');
});

test('daysBetween is plain calendar arithmetic, including across a DST change', () => {
  assert.equal(daysBetween('2026-08-10', '2026-08-16'), 6);
  assert.equal(daysBetween('2026-08-16', '2026-08-10'), -6);
  // US DST ends 2026-11-01. A naive hour-based diff would give 6.04 days and round wrong.
  assert.equal(daysBetween('2026-10-26', '2026-11-01'), 6, 'the fall-back weekend is still six days');
});

test('a browser-reported zone is validated before it is ever stored', async () => {
  const { isValidZone } = await import('../lib/time/zone-store.ts');
  assert.equal(isValidZone('America/Denver'), true);
  assert.equal(isValidZone('UTC'), true);
  assert.equal(isValidZone('Mars/Olympus'), false, 'unknown zones are discarded, not stored');
  assert.equal(isValidZone(''), false);
  assert.equal(isValidZone("America/Denver'; drop table member_profile --"), false, 'and nothing shaped like that');
});
