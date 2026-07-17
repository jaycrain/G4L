import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPulsePoints, buildPulsePath, DEFAULT_PULSE_GEOM, pulseTodayX } from '../lib/dashboard/resilience-pulse.ts';

const g = DEFAULT_PULSE_GEOM;

test('resilience pulse · EMPTY state — no beats → a flat baseline path, no points', () => {
  assert.deepEqual(buildPulsePoints([]), []);
  assert.equal(buildPulsePath([]), `M${g.padX},${g.baselineY} L${g.width - g.padX},${g.baselineY}`);
});

test('resilience pulse · beat encoding — good is UP, false_start is DOWN, quiet is ON the baseline', () => {
  const [good, fs, quiet] = buildPulsePoints([{ kind: 'good' }, { kind: 'false_start' }, { kind: 'quiet' }]);
  assert.ok(good!.y < g.baselineY, 'good call is a peak (above the line)');
  assert.ok(fs!.y > g.baselineY, 'false start dips below the line');
  assert.equal(quiet!.y, g.baselineY, 'quiet day is flat on the line');
  // recovery reads as the win: the up-beat rises FARTHER than the dip drops (a miss-then-return still looks good)
  assert.ok(g.baselineY - good!.y > fs!.y - g.baselineY, 'the up-beat is taller than the dip is deep');
});

test('resilience pulse · TODAY is always the last beat at the right edge (early + populated = same component)', () => {
  const one = buildPulsePoints([{ kind: 'quiet' }]);
  assert.equal(one.length, 1);
  assert.equal(one[0]!.today, true);
  assert.equal(one[0]!.x, pulseTodayX(g), 'day-1 today sits at the right edge');
  const many = buildPulsePoints(Array<{ kind: 'good' }>(10).fill({ kind: 'good' }));
  assert.equal(many[many.length - 1]!.today, true);
  assert.equal(many[many.length - 1]!.x, pulseTodayX(g), 'today is always the right edge');
  assert.ok(many[0]!.x < many[many.length - 1]!.x, 'earlier beats step left across the rolling window');
});

test('resilience pulse · NEVER a rising trajectory — a flat run stays flat (rhythm, not a score)', () => {
  const ys = new Set(buildPulsePoints(Array<{ kind: 'quiet' }>(8).fill({ kind: 'quiet' })).map((p) => p.y));
  assert.equal(ys.size, 1, 'every quiet day shares the baseline y — no upward drift / accumulation');
});

// --- auto-placed labels (sparse, capped) ---------------------------------------------------------------------
import { buildPulseAnnotations } from '../lib/dashboard/resilience-pulse.ts';
const G = (kinds) => buildPulseAnnotations(buildPulsePoints(kinds.map((k) => ({ kind: k }))));

test('resilience pulse labels · today is ALWAYS present', () => {
  assert.ok(G(['good']).some((a) => a.text === 'Today'));
  assert.ok(G(['good', 'quiet', 'good']).some((a) => a.text === 'Today'));
});

test('resilience pulse labels · RECOVERY is the hero — a dip then rising beats gets "back in rhythm"', () => {
  const anns = G(['good', 'good', 'false_start', 'good', 'good', 'good']);
  assert.ok(anns.some((a) => a.text === 'back in rhythm ↑'), 'the bounce is labelled');
  assert.ok(anns.some((a) => a.text === 'Today'));
  // the adjacent "False Start" is dropped so the two don't crowd — recovery wins
  assert.ok(!anns.some((a) => a.text === 'False Start'), 'the crowding False Start yields to the higher-priority bounce');
});

test('resilience pulse labels · a lone dip (no recovery) shows "False Start"; a quiet run shows "Quiet Days"', () => {
  assert.ok(G(['good', 'false_start', 'quiet', 'quiet']).some((a) => a.text === 'False Start'));
  assert.ok(G(['good', 'quiet', 'quiet', 'quiet', 'quiet', 'good']).some((a) => a.text === 'Quiet Days'));
});

test('resilience pulse labels · CAPPED — never more than today + 2 events, however busy', () => {
  const busy = ['good', 'good', 'good', 'quiet', 'quiet', 'quiet', 'false_start', 'good', 'good', 'good', 'quiet', 'good'];
  assert.ok(G(busy).length <= 3, 'today + at most 2 notable labels — never crowds');
});
