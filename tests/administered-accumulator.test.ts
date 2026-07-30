import { test } from 'node:test';
import assert from 'node:assert/strict';
import { administeredStage, type Beat } from '../lib/agent/onboarding-staged.ts';

// CAT-32 — Reconnect's 24-item IDQ and its 6-item grit Checkpoint share ONE administeredResponses accumulator,
// and the between-instrument reset sat in a distant stage-confirm branch. One bypassed branch and the first six
// IDQ ANSWERS get scored and written as the member's grit — silently, into a frozen data contract they see on
// their dashboard. Wrong numbers about someone's own resilience are worse than no numbers.

function beat(responses: number[]): Beat {
  return {
    administeredResponses: [...responses],
    memberMessage: '4',
    scratch: {},
    collected: {},
    stage: 'checkpoint',
    reply: '',
  } as unknown as Beat;
}

const checkpoint = administeredStage({
  id: 'checkpoint' as never,
  itemCount: 6,
  resetOnEntry: true,
  opener: () => 'open',
  deliverItem: () => 'item',
  reprompt: () => 're-ask',
  onComplete: () => {},
});

test('an instrument with resetOnEntry DROPS a previous instrument’s answers instead of scoring them', () => {
  const b = beat(new Array(24).fill(3)); // the IDQ's 24 responses, reset missed
  checkpoint.administer!(b);
  assert.deepEqual(b.administeredResponses, [4], 'only this instrument’s own first answer survives');
});

test('it never discards its OWN in-progress answers (a resume mid-instrument must be safe)', () => {
  const b = beat([5, 4, 5]); // three of this instrument's six, member resuming
  checkpoint.administer!(b);
  assert.deepEqual(b.administeredResponses, [5, 4, 5, 4], 'appends, never wipes a legitimate partial run');
});

test('without resetOnEntry the accumulator is untouched — single-instrument arcs are unaffected', () => {
  const plain = administeredStage({
    id: 'grinta' as never,
    itemCount: 6,
    opener: () => 'open',
    deliverItem: () => 'item',
    reprompt: () => 're-ask',
    onComplete: () => {},
  });
  const b = beat([1, 2, 3, 4, 5, 5, 5]);
  plain.administer!(b);
  assert.equal(b.administeredResponses.length, 8, 'opt-in only — no behaviour change where it is not asked for');
});
