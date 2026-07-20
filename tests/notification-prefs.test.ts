import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeNotificationPatch } from '../lib/outreach/prefs-input.ts';

// The Notifications dial's trust boundary (Mobile slice 2): the client sends what it renders; this drops anything
// unrecognized before it reaches setPref, and enforces the governance rule that in-app is always on.

test('valid rhythm passes; an unknown rhythm is dropped', () => {
  assert.deepEqual(sanitizeNotificationPatch({ rhythm: 'weekly' }), { rhythm: 'weekly' });
  assert.deepEqual(sanitizeNotificationPatch({ rhythm: 'hourly' }), {});
});

test('channels: in-app is forced ON, unknown channels dropped, values coerced to booleans', () => {
  const r = sanitizeNotificationPatch({ channels: { push: true, email: false, sms: true, bogus: true, in_app: false } as never });
  assert.deepEqual(r.channels, { in_app: true, push: true, email: false, sms: true });
});

test('quiet hours: 0–23 kept + floored; out-of-range dropped', () => {
  assert.deepEqual(sanitizeNotificationPatch({ quietStart: 21, quietEnd: 7 }), { quietStart: 21, quietEnd: 7 });
  assert.deepEqual(sanitizeNotificationPatch({ quietStart: 9.9 }), { quietStart: 9 });
  assert.deepEqual(sanitizeNotificationPatch({ quietStart: 24, quietEnd: -1 }), {});
});

test('empty / junk patch → empty clean patch (nothing written)', () => {
  assert.deepEqual(sanitizeNotificationPatch({}), {});
  assert.deepEqual(sanitizeNotificationPatch({ rhythm: '', quietStart: 'x' as never }), {});
});
