import assert from 'node:assert/strict';
import { test } from 'node:test';
import { driftOpen } from '../lib/agent/reconnect.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

// ============================================================================================================
// W-37 + W-36 (stateless-arcs / honor-the-member) — the Reconnect DRIFT beat must RECALL the member's own Reclaim
// List and deepen from it, never re-collect cold, and never invent a loss category ("the deep friendships").
// ============================================================================================================

const OLD_INVENTED = /deep friendships|morning rides|trapped in your head/i; // the hardcoded examples that must be gone

test('drift · RECALLS the member’s own Reclaim List and deepens (never re-collects cold)', () => {
  const c: Collected = { identityNoun: 'Rider', reclaimList: ['ride again', 'see friends', 'feel strong'] };
  const open = driftOpen(c);
  assert.match(open, /ride again/, 'serves their own want back');
  assert.match(open, /see friends/, 'serves their own want back');
  assert.match(open, /feel strong/, 'serves their own want back');
  assert.match(open, /you named|you want back/i, 'frames it as recall, not a fresh ask');
  assert.match(open, /which do you feel the distance from most/i, 'deepens (prioritize), does not re-collect a new list');
  assert.doesNotMatch(open, OLD_INVENTED, 'W-36: no invented/fabricated loss categories');
});

test('drift · two items still recall (a and b), no invention', () => {
  const open = driftOpen({ reclaimList: ['coach again', 'sleep well'] });
  assert.match(open, /coach again and sleep well/, 'joins two items in their words');
  assert.doesNotMatch(open, OLD_INVENTED);
});

test('drift · GRACEFUL DEGRADE (no Reclaim List) — still never invents a specific loss (W-36)', () => {
  const open = driftOpen({ identityNoun: 'Rider', reclaimList: [] });
  assert.doesNotMatch(open, OLD_INVENTED, 'no fabricated losses even with nothing to recall');
  assert.match(open, /what has the Fade quietly cost you|the ones you actually feel/i, 'a grounded take-stock in their own words');
  // and a single-item list degrades the same way (can't "recall + deepen" a one-item list meaningfully)
  assert.doesNotMatch(driftOpen({ reclaimList: ['just one'] }), OLD_INVENTED);
});
