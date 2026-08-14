import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildThresholdBeats, THRESHOLD_RESOLVE_LABEL, type ThresholdData } from '../lib/ceremony/threshold-beats.ts';

const base: ThresholdData = {
  identityNoun: 'Athlete',
  doors: ['The Career Cliff', 'The Body'],
  reclaimItems: ['Ride the Creek path', 'Sunday dinners again', 'Sleep through the night', 'Coach again', 'Play guitar'],
  idScore: 34,
  dimensions: { physical: 12, self: 22, social: 18, outlook: 20 },
  seeds: ['I’ve been a supporting character in my own life.', 'Run the Creek path without walking.'],
  firstMoveTitle: 'The Seven Minutes',
};

test('builds the seven-beat Threshold with the uncovered reveal carrying the member’s data', () => {
  const beats = buildThresholdBeats(base);
  assert.equal(beats.length, 7);
  assert.equal(beats[0]!.text, 'Stop for a second.');

  const uncovered = beats[2]!.reveal;
  assert.equal(uncovered?.kind, 'uncovered');
  if (uncovered?.kind === 'uncovered') {
    assert.equal(uncovered.identity, 'Athlete');
    assert.deepEqual(uncovered.doors, ['The Career Cliff', 'The Body']);
    // THE ITEMS, NOT A COUNT (Cowork + Jay, 2026-08-14) — the card leads with what they are taking back.
    assert.equal(uncovered.reclaimItems.length, 5);
    assert.ok(uncovered.reclaimItems.every((s) => s.trim().length > 0), 'every item carries the member’s own words');
    assert.equal(uncovered.idScore, 34);
    assert.equal(uncovered.dimensions?.physical, 12); // the dimensions ride along for the cluster read
  }

  // Donna's Reconnect edits: the Playbook beat now runs 5th (no reveal), the Journey reveal 6th; the last beat is the
  // resolve (clip-in) beat — which no longer appends the per-member first move.
  assert.equal(beats[4]!.reveal, undefined); // 5th = the Playbook beat (plain, no reveal)
  assert.equal(beats[5]!.reveal?.kind, 'journey'); // 6th = the 4Rs reveal
  // 7th = the hand-off, identified by POSITION and by carrying no data reveal — not by containing the word
  // "clip". The word moved to the button when the metaphor's explanation moved upstream (2026-08-14).
  assert.equal(beats.length, 7);
  assert.equal(beats[6]!.reveal, undefined, 'the hand-off is the step through — it reveals nothing new');
});

test('seeds beat reveals up to 3 lines when present', () => {
  const beats = buildThresholdBeats({ ...base, seeds: ['a', 'b', 'c', 'd'] });
  const seedBeat = beats[3]!;
  assert.equal(seedBeat.reveal?.kind, 'seeds');
  if (seedBeat.reveal?.kind === 'seeds') assert.equal(seedBeat.reveal.seeds.length, 3); // capped at 3
});

test('seedless member: beat 4 softens to no reveal (no empty Playbook frame)', () => {
  const beats = buildThresholdBeats({ ...base, seeds: [] });
  assert.equal(beats[3]!.reveal, undefined);
  assert.match(beats[3]!.text, /fills as you go/);
});

test('no first-move title: beat 7 uses the generic line, still the clip-in beat', () => {
  const beats = buildThresholdBeats({ ...base, firstMoveTitle: null });
  assert.equal(beats.length, 7);
  assert.doesNotMatch(beats[6]!.text, /small one —/); // generic line has no "— {firstMove}" tail (the gloss em-dash is fine)
  // THE BEAT NO LONGER TEACHES THE WORD (Cowork + Jay, 2026-08-14). It used to assert /clip/i, which passed only
  // because the beat carried the bike-pedal gloss. "Clip in" is now defined once upstream on the language screen
  // and the threshold just hands forward — so what must hold here is that the metaphor is NOT re-explained at the
  // moment of commitment, while the word still lives on the button the member presses.
  assert.doesNotMatch(beats[6]!.text, /bike|pedal|cycl/i, 'the metaphor is taught upstream, never at the threshold');
  assert.match(THRESHOLD_RESOLVE_LABEL, /clip in/i, 'the word still lives on the button they press');
});
