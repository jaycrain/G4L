import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendTimeline, loggedActivity, isTrackableGoal, type Activity } from '../lib/movement/movement.ts';

// Redesign scaffold — the provenance blend (D-08). Synced + Companion-logged into one timeline; a synced record
// supersedes a logged placeholder for the same session; newest first.

const ride = (id: string, at: string, prov: 'synced' | 'logged', km?: number): Activity => ({
  id,
  source: prov === 'synced' ? 'strava' : 'companion',
  provenance: prov,
  kind: 'ride',
  occurredAt: at,
  ...(km != null ? { metrics: { distanceKm: km } } : {}),
});

test('blend · merges + sorts newest-first, tags provenance', () => {
  const out = blendTimeline(
    [ride('s1', '2026-07-12T08:00:00Z', 'synced', 40)],
    [loggedActivity({ id: 'l1', kind: 'walk', occurredAt: '2026-07-13T18:00:00Z' })],
  );
  assert.equal(out.length, 2);
  assert.equal(out[0]!.id, 'l1', 'newest first');
  assert.equal(out[0]!.provenance, 'logged');
  assert.equal(out[1]!.provenance, 'synced');
});

test('blend · a synced ride supersedes the logged placeholder for the same session', () => {
  const out = blendTimeline(
    [ride('s1', '2026-07-13T08:20:00Z', 'synced', 42)], // Strava synced ~20 min after the member logged it
    [ride('l1', '2026-07-13T08:00:00Z', 'logged')],
  );
  assert.equal(out.length, 1, 'deduped to one');
  assert.equal(out[0]!.provenance, 'synced', 'kept the synced one (real metrics)');
  assert.equal(out[0]!.metrics?.distanceKm, 42);
});

test('blend · distinct sessions (different kind or outside the window) are both kept', () => {
  const out = blendTimeline(
    [ride('s1', '2026-07-13T08:00:00Z', 'synced', 42)],
    [
      loggedActivity({ id: 'l1', kind: 'run', occurredAt: '2026-07-13T08:10:00Z' }), // different kind → kept
      loggedActivity({ id: 'l2', kind: 'ride', occurredAt: '2026-07-13T20:00:00Z' }), // same kind, >90min later → kept
    ],
  );
  assert.equal(out.length, 3);
});

test('D-07 · a goal is trackable only if it maps to a metric', () => {
  assert.equal(isTrackableGoal('distanceKm'), true);
  assert.equal(isTrackableGoal(null), false);
  assert.equal(isTrackableGoal(undefined), false);
});
