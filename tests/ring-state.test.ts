import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRingState } from '../lib/workspace/ring-state.ts';
import type { Forecast, ForecastPhase, ForecastItem } from '../lib/curriculum/view.ts';

// Redesign Layer 1 (D-03): the ring merges Journey into the hero. deriveRingState is pure — it reads the forecast the
// dashboard already computes and reports per-phase fill. Completed phases solid, the active phase fractional, ahead
// empty; always center-out (reconnect first).

function item(id: string, state: ForecastItem['state'], kind: ForecastItem['kind'] = 'session'): ForecastItem {
  return { id, title: id, kind, summary: '', state, openable: true };
}
function phase(name: string, status: ForecastPhase['status'], items: ForecastItem[]): ForecastPhase {
  return { phase: name, label: name, status, items };
}
function forecast(phases: ForecastPhase[]): Forecast {
  return { phases, current: null, daily: [] };
}

test('fresh member — reconnect is current with 0 fill, the rest ahead at 0; order is center-out', () => {
  const rings = deriveRingState(
    forecast([
      phase('reconnect', "You're here", [item('doors', 'current'), item('idq', 'up'), item('rc-cp', 'up', 'checkpoint')]),
      phase('rewire', 'Ahead', [item('w1', 'up')]),
      phase('rebuild', 'Ahead', [item('b1', 'up')]),
      phase('reclaim', 'Ahead', [item('c1', 'up')]),
    ]),
  );
  assert.deepEqual(rings.map((r) => r.phase), ['reconnect', 'rewire', 'rebuild', 'reclaim'], 'center-out order');
  assert.equal(rings[0]!.state, 'current');
  assert.equal(rings[0]!.fill, 0, 'nothing done yet → empty active ring');
  assert.equal(rings[1]!.state, 'ahead');
  assert.equal(rings[3]!.fill, 0);
});

test('active phase fills by its share of done items (thirds)', () => {
  const rings = deriveRingState(
    forecast([
      phase('reconnect', "You're here", [
        item('doors', 'done'),
        item('idq', 'done'),
        item('vision', 'up'),
        item('rc-cp', 'up', 'checkpoint'),
      ]),
      phase('rewire', 'Ahead', [item('w1', 'up')]),
      phase('rebuild', 'Ahead', [item('b1', 'up')]),
      phase('reclaim', 'Ahead', [item('c1', 'up')]),
    ]),
  );
  assert.equal(rings[0]!.done, 2);
  assert.equal(rings[0]!.total, 3, 'counts the 3 SESSIONS, not the checkpoint (the member thinks "3 sessions then a Checkpoint")');
  assert.ok(Math.abs(rings[0]!.fill - 2 / 3) < 1e-9, '2 of 3 sessions done → two-thirds-filled active ring');
});

test('completed phases read solid (1), later current phase fractional', () => {
  const rings = deriveRingState(
    forecast([
      phase('reconnect', 'Complete', [item('doors', 'done'), item('rc-cp', 'done', 'checkpoint')]),
      phase('rewire', "You're here", [item('w1', 'done'), item('w2', 'up'), item('w3', 'up'), item('rw-cp', 'up', 'checkpoint')]),
      phase('rebuild', 'Ahead', [item('b1', 'up')]),
      phase('reclaim', 'Ahead', [item('c1', 'up')]),
    ]),
  );
  assert.equal(rings[0]!.state, 'done');
  assert.equal(rings[0]!.fill, 1, 'a crossed phase reads solid');
  assert.equal(rings[1]!.state, 'current');
  assert.ok(Math.abs(rings[1]!.fill - 1 / 3) < 1e-9, '1 of 3 sessions done in the active phase');
});

test('all four complete — every ring solid (the Cycle boundary; Cycle 2 re-run is a later pass)', () => {
  const rings = deriveRingState(
    forecast(
      ['reconnect', 'rewire', 'rebuild', 'reclaim'].map((p) => phase(p, 'Complete', [item(`${p}-x`, 'done')])),
    ),
  );
  assert.ok(rings.every((r) => r.state === 'done' && r.fill === 1));
});

test('a lockedPhase renders "locked" (dim, empty), not the bright "current" — the Loop gate', () => {
  const rings = deriveRingState(
    forecast([
      phase('reconnect', 'Complete', [item('a', 'done')]),
      phase('rewire', 'Complete', [item('b', 'done')]),
      phase('rebuild', 'Complete', [item('c', 'done')]),
      phase('reclaim', "You're here", [item('c1', 'up'), item('c2', 'up'), item('c3', 'up')]),
    ]),
    'reclaim',
  );
  const rc = rings.find((r) => r.phase === 'reclaim')!;
  assert.equal(rc.state, 'locked', 'the gated active phase reads locked, not current');
  assert.equal(rc.fill, 0);
});
