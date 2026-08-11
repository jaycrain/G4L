import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketize, trendSummary, isRange, RANGES, type DayCount } from '../lib/momentum/trend.ts';

const d = (day: string, good = 0, missed = 0, quiet = 0): DayCount => ({ day, good, missed, quiet });

test('week and 2-week keep one column PER DAY — averaging would destroy the thing they came to see', () => {
  const days = [d('2026-08-04', 1), d('2026-08-05', 0, 1), d('2026-08-06', 2)];
  for (const r of ['7', '14'] as const) {
    const b = bucketize(days, r);
    assert.equal(b.length, 3, `${r} keeps every day`);
    assert.deepEqual(b.map((x) => x.label), ['04', '05', '06']);
  }
});

test('a month groups into weeks; a year groups into months', () => {
  const month = [d('2026-08-03', 1), d('2026-08-04', 1), d('2026-08-12', 1)];
  assert.ok(bucketize(month, '30').length < month.length, 'weeks collapse adjacent days');

  const year = [d('2026-06-01', 1), d('2026-06-20', 1), d('2026-07-02', 1), d('2026-08-09', 1)];
  const b = bucketize(year, '365');
  assert.deepEqual(b.map((x) => x.label), ['Jun', 'Jul', 'Aug'], 'one column a month, in order');
  assert.equal(b[0]!.good, 2, 'June’s two days add up');
});

test('A DAY WITH NO CALLS STAYS ABSENT — never zero-filled', () => {
  // Zero-filling would draw months of flatline through the middle of a real pattern, and it would quietly assert
  // that a day someone didn't log is a day they failed. Absent is the honest shape.
  const b = bucketize([d('2026-08-01', 1), d('2026-08-28', 1)], '30');
  assert.equal(b.reduce((a, x) => a + x.logged, 0), 2, 'two logged days, not twenty-eight');
});

test('counts survive bucketing exactly — nothing is lost or double-counted', () => {
  const days = [d('2026-08-01', 2, 1, 0), d('2026-08-02', 0, 0, 3), d('2026-08-15', 1, 1, 1)];
  for (const r of RANGES.map((x) => x.key)) {
    const b = bucketize(days, r);
    assert.equal(b.reduce((a, x) => a + x.good, 0), 3, `good preserved at ${r}`);
    assert.equal(b.reduce((a, x) => a + x.missed, 0), 2, `false starts preserved at ${r}`);
    assert.equal(b.reduce((a, x) => a + x.quiet, 0), 4, `quiet preserved at ${r}`);
  }
});

test('bucketing is stable regardless of input order', () => {
  const days = [d('2026-08-15', 1), d('2026-08-01', 1), d('2026-08-08', 1)];
  assert.deepEqual(bucketize(days, '365').map((x) => x.label), ['Aug']);
  assert.equal(bucketize([...days].reverse(), '30').length, bucketize(days, '30').length);
});

test('THE SUMMARY REPORTS, IT DOES NOT ASSESS', () => {
  // Momentum is a mirror, not a grade. No score, no streak, no "doing well" — a false start is honest, and it is
  // named beside a good call rather than against it.
  const s = trendSummary(bucketize([d('2026-08-01', 2, 1), d('2026-08-02', 0, 0, 1)], '7'), '7');
  assert.match(s, /2 good calls/);
  assert.match(s, /1 false start/);
  assert.match(s, /2 days you logged/);
  assert.doesNotMatch(s, /quiet day/i, '"Quiet Days" is a RETIRED member-facing label — it is "On Track" now');
  const q = trendSummary(bucketize([d('2026-08-01', 0, 0, 3)], '7'), '7');
  assert.match(q, /3 on-track days/, 'a COUNT of days — bare "3 on track" would read as a verdict on them');
  // "On Track" stays out of this list — it is the CANONICAL member-facing label for a quiet day, not a grade we
  // invented. What is banned is the sentence assessing them; the assertion below pins the count phrasing that
  // keeps it a record rather than a verdict.
  assert.doesNotMatch(s, /streak|score|great|well done|keep it up|you're|doing well|%/i, 'no grade anywhere');
});

test('an empty window forecasts rather than scolding', () => {
  const s = trendSummary([], '30');
  assert.match(s, /fills in as you go/i);
  assert.doesNotMatch(s, /this 2 weeks|this 30/i, 'no window name — "this 2 weeks" reads wrong and the pill already says it');
  assert.doesNotMatch(s, /missed|behind|should/i);
});

test('singulars read correctly — a lone call is not "1 good calls"', () => {
  const s = trendSummary(bucketize([d('2026-08-01', 1)], '7'), '7');
  assert.match(s, /1 good call —/);
});

test('only the four ranges are accepted', () => {
  assert.ok(isRange('7') && isRange('365'));
  assert.equal(isRange('90'), false);
  assert.equal(isRange('../etc/passwd'), false);
});
