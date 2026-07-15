import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedReviewSessions } from '../lib/workspace/review.ts';
import type { Forecast, ForecastPhase, ForecastItem } from '../lib/curriculum/view.ts';

// The read-only review index: the member's COMPLETED sessions as reviewable workspace keys, from the forecast's done
// items — mapped to the redesign session model (Reconnect's granular Atlas assets collapse to one 'reconnect'), and
// checkpoints/measurements excluded (a Grinta read isn't a kept artifact to revisit).

function item(id: string, state: ForecastItem['state'], kind: ForecastItem['kind'] = 'session', route?: string): ForecastItem {
  return { id, title: id, kind, summary: '', state, openable: true, ...(route ? { route } : {}) };
}
function phase(name: string, items: ForecastItem[]): ForecastPhase {
  return { phase: name, label: name, status: 'Complete', items };
}
function forecast(phases: ForecastPhase[]): Forecast {
  return { phases, current: null, daily: [] };
}

test('only DONE sessions are reviewable; Reconnect collapses to one; checkpoints/measurements excluded', () => {
  const fc = forecast([
    phase('reconnect', [
      item('RCN-EXC', 'done'), // a granular Atlas session
      item('RCN-DOORS', 'done'), // another → both map to the single 'reconnect' key
      item('RCN-IDQ', 'done', 'measurement'), // excluded (not a session)
      item('RCN-CHK', 'done', 'checkpoint'), // excluded
    ]),
    phase('rewire', [
      item('RWR-W1', 'done', 'session', '/rewire/{memberId}/w1'),
      item('RWR-W2', 'done', 'session', '/rewire/{memberId}/w2'),
      item('RWR-W3', 'up', 'session', '/rewire/{memberId}/w3'), // not done → not reviewable
    ]),
  ]);
  const rev = completedReviewSessions(fc);
  const keys = rev.map((r) => r.key);
  assert.deepEqual(keys, ['reconnect', 'w1', 'w2'], 'reconnect once, w1+w2 done, w3 not done, no measurement/checkpoint');
  assert.equal(rev[0]!.label, 'Reconnect', 'label from the redesign session-registry');
});

test('nothing done → empty (a fresh member has nothing to revisit)', () => {
  const fc = forecast([phase('reconnect', [item('RCN-EXC', 'up'), item('RCN-DOORS', 'current')])]);
  assert.deepEqual(completedReviewSessions(fc), []);
});
