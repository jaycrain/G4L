import assert from 'node:assert/strict';
import { test } from 'node:test';
import { w1Context, rewireOpening } from '../lib/agent/rewire.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// W-40 (stateless-arcs) — the Rewire W1 "true line" must be SEEDED from the member's own prior honest lines
// (their first-person gap + Reclaim List), not introduced cold. Deterministic surfaces: W1 now CARRIES the prior
// captures (rewireOpening) and SURFACES them with a seed instruction (w1Context). The model's actual quoting is
// fuzzy → covered by the persona live-run before deploy.
// ============================================================================================================

const c: Collected = {
  identityNoun: 'Rider',
  gap: 'It didn’t pull me off the bike — my wife got laid off and I put everyone else first.',
  reclaimList: ['ride again', 'feel strong'],
};

test('w1Context · surfaces the member’s own prior honest lines + a seed instruction', () => {
  const ctx = w1Context(c);
  assert.match(ctx, /MEMBER CONTEXT/, 'gives the model what it already knows');
  assert.match(ctx, /my wife got laid off/, 'serves their first-person gap back');
  assert.match(ctx, /ride again/, 'serves their Reclaim List back');
  assert.match(ctx, /seed the true-line work from these/i, 'instructs seeding, not a cold intro');
});

test('w1Context · graceful degrade — nothing to recall → empty (no fabricated context)', () => {
  assert.equal(w1Context({}), '');
  assert.equal(w1Context({ reclaimList: [] }), '');
});

test('rewireOpening · W1 now carries the committed captures (was empty {} before W-40)', () => {
  const turn = rewireOpening(c);
  assert.equal(turn.state.collected.gap, c.gap, 'gap is threaded into W1 state');
  assert.deepEqual(turn.state.collected.reclaimList, c.reclaimList, 'Reclaim List is threaded into W1 state');
  assert.equal(turn.state.stage, 'domains', 'still opens on the first domain');
});

test('rewireOpening · degrades to empty collected when there are no captures (no crash, no invention)', () => {
  assert.deepEqual(rewireOpening().state.collected, {});
  assert.deepEqual(rewireOpening(null).state.collected, {});
});
