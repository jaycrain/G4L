// The reactive ladder: who is due, when it stops, and when Jay gets them.
//
// Every case here is a boundary, and boundaries in a nudge system are not academic — one off-by-one is the
// difference between "reached out on day 7" and "texted someone twice in a day".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessAbsence, shouldReach, shouldHandToJay,
  RE_ENGAGE_LADDER_DAYS, ESCALATE_AFTER_LAST_RUNG_DAYS,
} from '../lib/outreach/absence.ts';
import type { AwayRow } from '../lib/outreach/episodes.ts';

const NOW = Date.UTC(2026, 5, 1);
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const reach = (n: number, status = 'sent'): AwayRow =>
  ({ trigger: 're_engagement', status, createdAt: daysAgo(n) });

test('present until the first rung', () => {
  const v = assessAbsence({ lastActiveAt: daysAgo(6), reaches: [], now: NOW });
  assert.equal(v.state, 'present');
  assert.equal(shouldReach(v), false);
});

test('due exactly ON the first rung, not a day late', () => {
  const v = assessAbsence({ lastActiveAt: daysAgo(RE_ENGAGE_LADDER_DAYS[0]), reaches: [], now: NOW });
  assert.equal(v.state, 'due');
  assert.equal(shouldReach(v), true);
  if (v.state === 'due') assert.equal(v.step, 1);
});

test('after reaching, it waits for the NEXT rung rather than reaching again', () => {
  // Away 8 days, already reached on day 7. Rung two is 10 days — nothing is owed today.
  const v = assessAbsence({ lastActiveAt: daysAgo(8), reaches: [reach(1)], now: NOW });
  assert.equal(v.state, 'waiting');
  assert.equal(shouldReach(v), false);
  if (v.state === 'waiting') assert.equal(v.nextRungInDays, 2);
});

test('the ladder runs in order, one reach per rung', () => {
  const away = 30;
  const two = assessAbsence({ lastActiveAt: daysAgo(away), reaches: [reach(23), reach(20)], now: NOW });
  assert.equal(two.state, 'due', 'two attempts made, third rung reached');
  if (two.state === 'due') assert.equal(two.step, 3);
});

test('THE LADDER STOPS. A spent ladder never reaches again', () => {
  const reaches = [reach(23), reach(20), reach(1)];
  const v = assessAbsence({ lastActiveAt: daysAgo(31), reaches, now: NOW });
  assert.equal(shouldReach(v), false, 'three attempts is all the Companion gets');
  assert.equal(v.state, 'waiting', 'and it does not escalate the instant the last rung fires');
});

test('escalates to Jay only after the ladder has finished AND time has passed', () => {
  const reaches = [reach(40), reach(37), reach(20)];
  const last = RE_ENGAGE_LADDER_DAYS[RE_ENGAGE_LADDER_DAYS.length - 1]!;
  const v = assessAbsence({
    lastActiveAt: daysAgo(last + ESCALATE_AFTER_LAST_RUNG_DAYS), reaches, now: NOW,
  });
  assert.equal(v.state, 'escalate');
  assert.equal(shouldHandToJay(v), true);
  assert.equal(shouldReach(v), false, 'handing over is not another message');
});

test('EACH ABSENCE GETS THE WHOLE LADDER — old reaches do not carry over', () => {
  // Went quiet a year ago, was reached three times, came back, drifted again last week. If attempts were
  // counted across all time they would arrive already spent and be handed straight to Jay, with the
  // Companion never having spoken. Reaches before their last sign of life belong to the previous stretch.
  const old = [reach(400), reach(397), reach(370)];
  const v = assessAbsence({ lastActiveAt: daysAgo(7), reaches: old, now: NOW });
  assert.equal(v.state, 'due');
  if (v.state === 'due') assert.equal(v.step, 1, 'a fresh absence starts at rung one');
});

test('a held message does not consume a rung', () => {
  // The validator stopped it, so the member never heard from us. Burning an attempt on a message that never
  // left would quietly shorten the ladder to two.
  const v = assessAbsence({ lastActiveAt: daysAgo(10), reaches: [reach(3, 'held')], now: NOW });
  assert.equal(v.state, 'due');
  if (v.state === 'due') assert.equal(v.step, 1);
});

test('someone who never arrived is not an absence', () => {
  const v = assessAbsence({ lastActiveAt: null, reaches: [], now: NOW });
  assert.equal(v.state, 'never_started');
  assert.equal(shouldReach(v), false, 'a member who never started is an onboarding problem, not a nudge one');
  assert.equal(shouldHandToJay(v), false);
});
