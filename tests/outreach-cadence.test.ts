import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadenceCheck, effectiveRhythm, inQuietHours, type CadenceInput } from '../lib/outreach/cadence.ts';

const base: CadenceInput = {
  channel: 'outbound', rhythm: 'few_week', ignoredStreak: 0, outboundLast7d: 0,
  hasOpenThread: false, hoursSinceLastInApp: null, localHour: 10,
};

test('in-app is exempt from ceiling + quiet hours (member came to us), but still no double-nudge', () => {
  assert.equal(cadenceCheck({ ...base, channel: 'in_app', outboundLast7d: 99, localHour: 2 }).ok, true);
  assert.equal(cadenceCheck({ ...base, channel: 'in_app', hasOpenThread: true }).ok, false);
});

test('in-app cooldown: a nudge surfaced recently holds; past the cooldown it clears; never-surfaced is clear', () => {
  // never surfaced → clear
  assert.equal(cadenceCheck({ ...base, channel: 'in_app', hoursSinceLastInApp: null }).ok, true);
  // surfaced 2h ago (< 20h floor) → held — this is what stops the dismiss→regenerate treadmill
  const held = cadenceCheck({ ...base, channel: 'in_app', hoursSinceLastInApp: 2 });
  assert.equal(held.ok, false);
  assert.match(held.reason!, /cooldown/);
  // surfaced 21h ago (> 20h floor) → clear again
  assert.equal(cadenceCheck({ ...base, channel: 'in_app', hoursSinceLastInApp: 21 }).ok, true);
  // the cooldown is in-app-only — it never gates outbound (outbound has its own ceiling)
  assert.equal(cadenceCheck({ ...base, channel: 'outbound', hoursSinceLastInApp: 2 }).ok, true);
});

test('outbound honors the weekly rhythm ceiling', () => {
  assert.equal(cadenceCheck({ ...base, rhythm: 'few_week', outboundLast7d: 3 }).ok, true, 'under 4/wk');
  const r = cadenceCheck({ ...base, rhythm: 'few_week', outboundLast7d: 4 });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /ceiling/);
  assert.equal(cadenceCheck({ ...base, rhythm: 'weekly', outboundLast7d: 1 }).ok, false, 'weekly = 1/wk');
});

test('outbound respects quiet hours; morning presence (7–9am) is allowed', () => {
  assert.equal(cadenceCheck({ ...base, localHour: 22 }).ok, false, '10pm is quiet');
  assert.equal(cadenceCheck({ ...base, localHour: 3 }).ok, false, '3am is quiet');
  assert.equal(cadenceCheck({ ...base, localHour: 8 }).ok, true, '8am morning presence');
  assert.equal(cadenceCheck({ ...base, localHour: 20 }).ok, true, '8pm still allowed');
});

test('only-when-asked never reaches out (outbound), but in-app still shows', () => {
  assert.equal(cadenceCheck({ ...base, rhythm: 'on_ask' }).ok, false);
  assert.equal(cadenceCheck({ ...base, rhythm: 'on_ask', channel: 'in_app' }).ok, true);
});

test('auto-back-off decays the effective rhythm toward the floor when ignored', () => {
  assert.equal(effectiveRhythm('daily', 0), 'daily');
  assert.equal(effectiveRhythm('daily', 2), 'few_week', '2 ignored → one step down');
  assert.equal(effectiveRhythm('daily', 4), 'weekly', '4 ignored → two steps → floor');
  assert.equal(effectiveRhythm('daily', 20), 'weekly', 'never past the floor');
  assert.equal(effectiveRhythm('on_ask', 10), 'on_ask', 'on_ask stays off');
  // A daily member who has ignored 4 in a row is now held at 1/wk (weekly ceiling), not 7.
  assert.equal(cadenceCheck({ ...base, rhythm: 'daily', ignoredStreak: 4, outboundLast7d: 1 }).ok, false);
});

test('inQuietHours handles the midnight-wrapping default window', () => {
  for (const h of [21, 23, 0, 6]) assert.equal(inQuietHours(h), true, `${h} quiet`);
  for (const h of [7, 12, 20]) assert.equal(inQuietHours(h), false, `${h} awake`);
});
