// Every seeded topic must point at a Session that exists.
//
// A wrong session key fails SILENTLY here — topicForSession returns null and the nudge quietly falls back to the
// Community front page, which is the exact behaviour this work exists to remove. Nothing errors, nothing logs, and
// the member lands on a generic feed after a Session that was supposed to have a thread waiting.
//
// My first draft got three of four keys wrong ('rewire-w3', 'reclaim-c3', 'rewire-w2'), so this is not theoretical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_TOPICS, topicForSession } from '../lib/connect/session-topics.ts';
import { sessionById } from '../lib/workspace/session-registry.ts';

test('every seeded topic keys to a real Session', () => {
  for (const t of SESSION_TOPICS) {
    assert.ok(sessionById(t.sessionKey), `"${t.sessionKey}" is not a session id — the nudge would silently fall back`);
  }
});

test('the topics are questions, and name no one', () => {
  for (const t of SESSION_TOPICS) {
    assert.match(t.title, /\?$/, `"${t.title}" should be a question — it is an invitation, not a headline`);
    // The no-real-names ruling reaches every member-facing surface, seeded content included.
    for (const n of ['Jay', 'Greg', 'Donna', 'Crain', 'Welk']) {
      assert.doesNotMatch(`${t.title} ${t.body}`, new RegExp(`\\b${n}\\b`), `${n} must not appear in seeded copy`);
    }
  }
});

test('an unknown or missing key falls back rather than throwing', () => {
  assert.equal(topicForSession('b2'), null, 'a Session with no topic yet returns null');
  assert.equal(topicForSession(null), null);
  assert.equal(topicForSession(undefined), null);
});
