import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, parseReclaimListSubmission } from '../lib/agent/onboarding-staged.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// The Reclaim List is captured with a STRUCTURED builder, not extracted from conversation (Jay, 2026-07-29 — after
// conversational extraction proved ~30% lossy across walks). Capture is 100% reliable by construction: the member's
// exact entries ARE the list. These fixtures lock that — the submission is stored verbatim and the machine advances.

test('parseReclaimListSubmission — a bulleted/numbered block splits into the member\'s exact items', () => {
  assert.deepEqual(parseReclaimListSubmission('• Run a 5k\n• Sleep well\n• See my friends'), ['Run a 5k', 'Sleep well', 'See my friends']);
  assert.deepEqual(parseReclaimListSubmission('1. Ride again\n2. Coach a friend'), ['Ride again', 'Coach a friend']);
  assert.deepEqual(parseReclaimListSubmission('Just one thing'), ['Just one thing']);
  assert.deepEqual(parseReclaimListSubmission('   '), []);
});

test('structured reclaim — the submission is stored VERBATIM and advances to the Grinta baseline', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The years quietly took it, one reasonable choice at a time.' },
  };
  const t = applyStagedTurn(atReclaim, [], '• Join a softball team\n• Lose 30 lbs\n• Sleep through the night', { text: '' });
  assert.deepEqual(
    t.state.collected.reclaimList,
    ['Join a softball team', 'Lose 30 lbs', 'Sleep through the night'],
    'the member’s exact entries — nothing paraphrased, nothing dropped',
  );
  assert.equal(t.state.stage, 'grinta', 'the builder submission hands straight into the Grinta baseline');
});

test('structured reclaim — items volunteered earlier are kept; the submission adds to them, deduped', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a cyclist', identityNoun: 'Cyclist', gap: 'It faded.', reclaimList: ['Ride again'] },
  };
  const t = applyStagedTurn(atReclaim, [], '• Ride again\n• Lose 20 lbs', { text: '' });
  assert.deepEqual(t.state.collected.reclaimList, ['Ride again', 'Lose 20 lbs'], 'the pre-existing want is not duplicated');
});
