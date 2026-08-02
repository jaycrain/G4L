// The fold from "messages we sent" to "stretches the member was away".
//
// The whole value of this module is the edge cases, so they are the tests: a held message must not become a
// memory of reaching out, two absences separated by a return must not merge into one, and an open absence
// must not be reported as a return.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldAwayEpisodes, awayRecallLine, isReach, type AwayRow } from '../lib/outreach/episodes.ts';

const day = (n: number) => new Date(Date.UTC(2026, 3, n)).toISOString(); // April 2026
const reach = (n: number, status = 'sent'): AwayRow => ({ trigger: 're_engagement', status, createdAt: day(n) });

test('a held or unsurfaced message is NOT a memory of reaching out', () => {
  // The one thing worse than forgetting we reached out is remembering that we did when we didn't. A 'held'
  // row means the validator or the cadence stopped it — the member's phone never moved.
  assert.equal(isReach(reach(1, 'held')), false);
  assert.equal(isReach(reach(1, 'ready')), false);
  assert.equal(isReach(reach(1, 'sent')), true);
  assert.equal(isReach(reach(1, 'dismissed')), true, 'dismissed still reached them — they saw it and closed it');
  assert.equal(isReach({ trigger: 'morning_presence', status: 'sent', createdAt: day(1) }), false,
    'only the absence trigger makes an away episode');
});

test('several reaches inside one silence are ONE episode, not several', () => {
  const eps = foldAwayEpisodes([reach(2), reach(9), reach(20)], [day(24)]);
  assert.equal(eps.length, 1, 'a member experiences one stretch away, not three messages');
  assert.equal(eps[0]!.attempts, 3);
  assert.equal(eps[0]!.daysToReturn, 22);
});

test('a return between two reaches splits them into two episodes', () => {
  // Away, came back on the 10th, drifted again, came back on the 28th. Two absences.
  const eps = foldAwayEpisodes([reach(2), reach(20)], [day(10), day(28)]);
  assert.equal(eps.length, 2);
  assert.equal(eps[0]!.daysToReturn, 8);
  assert.equal(eps[1]!.daysToReturn, 8);
});

test('an absence still running is open, not a return', () => {
  const eps = foldAwayEpisodes([reach(2)], []);
  assert.equal(eps[0]!.returnedAt, null);
  assert.equal(eps[0]!.daysToReturn, null, 'never report a return we have no evidence for');
  assert.equal(awayRecallLine(eps), null, 'and it contributes nothing to recall');
});

test('activity BEFORE the reach does not count as coming back', () => {
  // They were active, then went quiet, then we reached. The earlier activity is what preceded the silence.
  const eps = foldAwayEpisodes([reach(10)], [day(1)]);
  assert.equal(eps[0]!.returnedAt, null);
});

test('no reaches means no episodes and no recall', () => {
  assert.deepEqual(foldAwayEpisodes([], [day(1)]), []);
  assert.equal(awayRecallLine([]), null);
});

test('the recall line states the facts and forbids the scoreboard', () => {
  const line = awayRecallLine(foldAwayEpisodes([reach(2), reach(9)], [day(11)]))!;
  assert.match(line, /April 2026/);
  assert.match(line, /away about 9 days/);
  assert.match(line, /reached out 2 times/);
  // The guards that keep Jay's own phrasing — "you came roaring back, let's do it again!" — out of the model.
  assert.match(line, /Do NOT praise the return/);
  assert.match(line, /never a streak/i);
  assert.match(line, /not a failing/);
  assert.doesNotMatch(line, /comeback!|roaring/i);
});

test('recall shows a few, not a history', () => {
  // Five absences over a year should not produce a five-item recital in the middle of a conversation.
  const rows = [2, 6, 10, 14, 18, 22].map((n) => reach(n));
  const activity = [4, 8, 12, 16, 20, 24].map((n) => day(n));
  const eps = foldAwayEpisodes(rows, activity);
  assert.equal(eps.length, 6);
  const line = awayRecallLine(eps)!;
  assert.equal(line.split('\n  • ').length - 1, 3, 'at most three, most recent first');
});
