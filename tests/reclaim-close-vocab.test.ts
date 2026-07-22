import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberClosingReclaim } from '../lib/agent/onboarding-intent.ts';
import { consolidateReclaim } from '../lib/member/reclaim.ts';

// THE SHARED CLOSE-VOCABULARY CONTRACT (W-08). Two detectors serve the Reclaim List's close-signal, for different
// jobs, and they MUST agree on what counts as a close — or a phrase slips one and is caught by the other, which is
// exactly how "Those are the highlights" got re-asked at capture AND persisted as a want on the summary card:
//   • memberClosingReclaim (onboarding-intent) — UNANCHORED intent detection: is this member turn CLOSING the list?
//     Drives the gather's advance (no bare re-ask) AND the backstop guard (`!memberClosingReclaim` → never captured).
//   • consolidateReclaim's drop (reclaim.ts) — ANCHORED whole-item match: if a close phrase DID land as an item,
//     drop it at the card / commit so it never persists.
// This corpus is the single source of truth. A phrase added to one detector but not the other fails here in CI.
const CLOSE_CORPUS = [
  'Those are the highlights',
  'those are the highlights',
  'the highlights',
  'those are the big ones',
  'those are the real ones',
  'those are the main ones',
  "that's it",
  "that's about it",
  "that's the list",
  'good enough',
  'perfect',
  'that looks great',
  // Colloquial no-answers to "anything missing?" — a close, not new material (Jay's mobile walk: "Don't think so"
  // fell through, got captured as a want AND re-asked the beat).
  "Don't think so",
  "don't think so",
  "I don't think so",
  'not that I can think of',
];

// NON-closes — real wants (or fragments of them) that share words with close phrases but must NEVER be read as a
// close (would strand the member or drop a real want). The guard against over-matching the corpus above.
const NON_CLOSE_WANTS = [
  'get my confidence back',
  'ride up to Brainard Lake again',
  'be the main provider without losing myself',
  'lose 25 more lbs',
  'launch Grinta For Life with Greg',
];

test('close-vocab · every canonical close phrase is recognized by BOTH detectors (capture + consolidation)', () => {
  for (const phrase of CLOSE_CORPUS) {
    assert.equal(
      memberClosingReclaim(phrase),
      true,
      `capture-side memberClosingReclaim must treat "${phrase}" as a close (else it re-asks / captures it)`,
    );
    // As a SOLE captured item, consolidation must drop it (nothing real to keep) → empty list.
    assert.deepEqual(
      consolidateReclaim([phrase]).items,
      [],
      `consolidation must drop "${phrase}" as a whole-item close (else it persists onto the card / commit)`,
    );
  }
});

test('close-vocab · a real want that trails a close phrase survives; only the close item drops', () => {
  // The exact W-08 shape: a genuine list + the stray close phrase captured as a final item.
  const list = ['Fitness back — riding up to Brainard Lake', 'Losing 25 more lbs', 'Those are the highlights'];
  assert.deepEqual(
    consolidateReclaim(list).items,
    ['Fitness back — riding up to Brainard Lake', 'Losing 25 more lbs'],
    'the two real wants are kept; "Those are the highlights" is dropped',
  );
});

test('close-vocab · real wants are NOT mistaken for closes by either detector', () => {
  for (const want of NON_CLOSE_WANTS) {
    assert.equal(memberClosingReclaim(want), false, `"${want}" is a real want, not a close`);
    assert.deepEqual(consolidateReclaim([want]).items, [want], `"${want}" must be kept, never dropped`);
  }
});
