import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildThresholdBeats, type ThresholdData } from '../lib/ceremony/threshold-beats.ts';

const base: ThresholdData = {
  identityNoun: 'Athlete',
  doors: ['The Career Cliff', 'The Body'],
  winCount: 5,
  idScore: 34,
  dimensions: { physical: 12, self: 22, social: 18, outlook: 20 },
  seeds: ['I’ve been a supporting character in my own life.', 'Run the Creek path without walking.'],
  firstMoveTitle: 'The Seven Minutes',
};

test('builds the seven-beat Threshold with the uncovered reveal carrying the member’s data (v2.0: NO ID Score)', () => {
  const beats = buildThresholdBeats(base);
  assert.equal(beats.length, 7);
  assert.equal(beats[0]!.text, 'Stop for a second and take a moment to reflect.');

  const uncovered = beats[2]!.reveal;
  assert.equal(uncovered?.kind, 'uncovered');
  if (uncovered?.kind === 'uncovered') {
    assert.equal(uncovered.identity, 'Athlete');
    assert.deepEqual(uncovered.doors, ['The Career Cliff', 'The Body']);
    assert.equal(uncovered.winCount, 5);
    // v2.0 (§7): the ID Score is NOT revealed at the Threshold — it's earned later in Reconnect. Forced null
    // even when the data carries one, so no score chip and no "distance runs widest" read can fire here.
    assert.equal(uncovered.idScore, null);
    assert.equal(uncovered.dimensions, null);
  }

  // Beat 5 is the Journey reveal; the last beat carries the first move + is the resolve (clip-in) beat.
  assert.equal(beats[4]!.reveal?.kind, 'journey');
  assert.match(beats[6]!.text, /Seven Minutes/);
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
  assert.doesNotMatch(beats[6]!.text, /small one —/); // generic line has no "— {firstMove}" tail
  assert.match(beats[6]!.text, /clip/i);
});
