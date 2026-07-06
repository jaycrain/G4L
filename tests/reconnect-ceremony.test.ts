import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReconnectCeremonyBeats } from '../lib/ceremony/reconnect-ceremony-beats.ts';

// §2f — the Reconnect Ceremony content. Reveals ID Score radar + the Grinta movement (§2e) + Playbook + Doors + Rewire-lit.

test('§2f ceremony · reveals the score radar, the Grinta movement, the Playbook keepers, the Doors, and the Rewire-lit Journey', () => {
  const beats = buildReconnectCeremonyBeats({
    idScore: 62, dimensions: { physical: 18, self: 20, social: 16, outlook: 22 },
    grinta: { composite: 3.33, changePct: 11, direction: 'up', reconnect: 4.33, reconnectChangePct: 33 },
    keepers: ['the drift took it quietly', 'the ride before the house wakes'], doors: ['The Grind', 'The Body'],
  });
  const kinds = beats.map((b) => b.reveal?.kind).filter(Boolean);
  assert.deepEqual(kinds, ['score', 'grinta', 'playbook', 'doors', 'journey_rewire'], 'the five reveals, in order');
  const score = beats.find((b) => b.reveal?.kind === 'score')!.reveal as { idScore: number };
  assert.equal(score.idScore, 62, 'the baseline ID Score rides the radar reveal');
  const grintaBeat = beats.find((b) => b.reveal?.kind === 'grinta')!;
  assert.equal(grintaBeat.text, 'You just did the work in Reconnect — and your Grinta, your grit, went up because of it.', 'Jay’s verbatim reveal line');
  const grinta = grintaBeat.reveal as { composite: number; changePct: number; reconnect: number; reconnectChangePct: number };
  assert.equal(grinta.composite, 3.33);
  assert.equal(grinta.changePct, 11, 'the Index delta (headline) rides the reveal');
  assert.equal(grinta.reconnect, 4.33, 'Reconnect (the driver) stepped up');
  assert.equal(grinta.reconnectChangePct, 33, 'Reconnect carries its OWN, bigger delta — the driver of the Index move');
  const doors = beats.find((b) => b.reveal?.kind === 'doors')!.reveal as { doors: string[] };
  assert.deepEqual(doors.doors, ['The Grind', 'The Body'], 'the Door(s) as they stand (post-revision)');
});

test('§2f ceremony · the Grinta reveal appears ONLY when a Checkpoint captured it (null → no beat, no empty frame)', () => {
  const withGrinta = buildReconnectCeremonyBeats({ idScore: 60, dimensions: null, grinta: { composite: 3.4, changePct: 8, direction: 'up', reconnect: 4, reconnectChangePct: 20 }, keepers: ['x'], doors: ['The Grind'] });
  assert.ok(withGrinta.some((b) => b.reveal?.kind === 'grinta'), 'revealed when the movement exists');
  assert.match(withGrinta.map((b) => b.text).join(' '), /Grinta/, 'and named in the copy (no longer deferred)');
  const noGrinta = buildReconnectCeremonyBeats({ idScore: 60, dimensions: null, grinta: null, keepers: ['x'], doors: ['The Grind'] });
  assert.equal(noGrinta.some((b) => b.reveal?.kind === 'grinta'), false, 'no Grinta beat when the Checkpoint never ran');
  assert.doesNotMatch(noGrinta.map((b) => b.text).join(' '), /Grinta/, 'and never named when absent');
});

test('§2f ceremony · graceful — no keepers → no empty Playbook frame; no Door → honor the story instead', () => {
  const beats = buildReconnectCeremonyBeats({ idScore: null, dimensions: null, grinta: null, keepers: [], doors: [] });
  assert.equal(beats.some((b) => b.reveal?.kind === 'playbook'), false, 'no playbook reveal when nothing was kept');
  assert.equal(beats.some((b) => b.reveal?.kind === 'doors'), false, 'no doors reveal when none tagged (null Door is valid)');
  assert.match(beats.map((b) => b.text).join(' '), /fills from here/, 'the softer empty-Playbook line');
  assert.match(beats.map((b) => b.text).join(' '), /no label needed/, 'the no-Door honor line');
});

test('§2f ceremony · the Journey beat lights REWIRE (Reconnect done → next), not Reconnect', () => {
  const beats = buildReconnectCeremonyBeats({ idScore: 60, dimensions: null, grinta: null, keepers: ['x'], doors: ['The Grind'] });
  const journey = beats.find((b) => b.reveal?.kind === 'journey_rewire')!;
  assert.match(journey.text, /Reconnect is behind you|Rewire/i, 'Reconnect complete; Rewire lit');
});
