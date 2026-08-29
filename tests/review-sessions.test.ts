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

test('only DONE sessions are reviewable; Reconnect contributes its own; checkpoints/measurements excluded', () => {
  // RECONNECT NO LONGER COLLAPSES (2026-08-28). Its assets used to map onto ONE 'reconnect' key because the phase
  // was one Session, so two done assets deduped to a single reviewable entry. Each is its own Session now and
  // each is separately reviewable — which is the point of the split.
  const fc = forecast([
    phase('reconnect', [
      item('RCN-FDR', 'done'), // the Doors → r2
      item('RCN-DFT', 'done'), // the Drift Quiz → r3
      item('RCN-CHK', 'done', 'checkpoint'), // excluded — a gate, not a session
    ]),
    phase('rewire', [
      item('RWR-W1', 'done', 'session', '/rewire/{memberId}/w1'),
      item('RWR-W2', 'done', 'session', '/rewire/{memberId}/w2'),
      item('RWR-W3', 'up', 'session', '/rewire/{memberId}/w3'), // not done → not reviewable
    ]),
  ]);
  const rev = completedReviewSessions(fc);
  const keys = rev.map((r) => r.key);
  assert.deepEqual(keys, ['r2', 'r3', 'w1', 'w2'],
    "Reconnect's done Sessions each review separately; w3 not done; no measurement/checkpoint");
  // The label is the SESSION's now, not the phase's — 'Reconnect' was the label when the phase was one session.
  // 'Excavation' since 2026-08-29 (Jay: "I love the word Excavation relative to what we're doing"). R2 carries
  // Identity Excavation AND The Doors; it was titled after the second, so a member doing the excavation had
  // no way to know that is what it was. The Doors are untouched as a term — this is the Session's name.
  assert.equal(rev[0]!.label, 'Excavation', 'label from the redesign session-registry');
});

test('nothing done → empty (a fresh member has nothing to revisit)', () => {
  const fc = forecast([phase('reconnect', [item('RCN-EXC', 'up'), item('RCN-DOORS', 'current')])]);
  assert.deepEqual(completedReviewSessions(fc), []);
});
