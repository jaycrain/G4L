import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReconnectCeremonyBeats, RECONNECT_CEREMONY_COPY } from '../lib/ceremony/reconnect-ceremony-beats.ts';

// §2f — the Reconnect Ceremony content. Reveals ID Score radar + Playbook + Doors + Rewire-lit; DEFERS Grinta.

test('§2f ceremony · reveals the score radar, the Playbook keepers, the Doors, and the Rewire-lit Journey', () => {
  const beats = buildReconnectCeremonyBeats({
    idScore: 62, dimensions: { physical: 18, self: 20, social: 16, outlook: 22 },
    keepers: ['the drift took it quietly', 'the ride before the house wakes'], doors: ['The Grind', 'The Body'],
  });
  const kinds = beats.map((b) => b.reveal?.kind).filter(Boolean);
  assert.deepEqual(kinds, ['score', 'playbook', 'doors', 'journey_rewire'], 'the four reveals, in order');
  const score = beats.find((b) => b.reveal?.kind === 'score')!.reveal as { idScore: number };
  assert.equal(score.idScore, 62, 'the baseline ID Score rides the radar reveal');
  const doors = beats.find((b) => b.reveal?.kind === 'doors')!.reveal as { doors: string[] };
  assert.deepEqual(doors.doors, ['The Grind', 'The Body'], 'the Door(s) as they stand (post-revision)');
});

test('§2f ceremony · GRINTA/HARDINESS is DEFERRED — never named in the ceremony copy (Jay: do not bake it in)', () => {
  // Every spoken line + the whole assembled beat list is scanned; §2e measure is not captured and the naming is
  // unsettled (Jay + Greg), so the culminating ceremony must not reveal or name it.
  const allCopy = Object.values(RECONNECT_CEREMONY_COPY).join(' \n ');
  assert.doesNotMatch(allCopy, /grinta|hardiness/i, 'no Grinta/Hardiness in the copy');
  const beats = buildReconnectCeremonyBeats({ idScore: 60, dimensions: null, keepers: ['x'], doors: ['The Grind'] });
  assert.doesNotMatch(beats.map((b) => b.text).join(' '), /grinta|hardiness/i, 'nor in any assembled beat');
  assert.equal(beats.some((b) => (b.reveal?.kind as string) === 'grinta'), false, 'no grinta reveal kind');
});

test('§2f ceremony · graceful — no keepers → no empty Playbook frame; no Door → honor the story instead', () => {
  const beats = buildReconnectCeremonyBeats({ idScore: null, dimensions: null, keepers: [], doors: [] });
  assert.equal(beats.some((b) => b.reveal?.kind === 'playbook'), false, 'no playbook reveal when nothing was kept');
  assert.equal(beats.some((b) => b.reveal?.kind === 'doors'), false, 'no doors reveal when none tagged (null Door is valid)');
  assert.match(beats.map((b) => b.text).join(' '), /fills from here/, 'the softer empty-Playbook line');
  assert.match(beats.map((b) => b.text).join(' '), /no label needed/, 'the no-Door honor line');
});

test('§2f ceremony · the Journey beat lights REWIRE (Reconnect done → next), not Reconnect', () => {
  const beats = buildReconnectCeremonyBeats({ idScore: 60, dimensions: null, keepers: ['x'], doors: ['The Grind'] });
  const journey = beats.find((b) => b.reveal?.kind === 'journey_rewire')!;
  assert.match(journey.text, /Reconnect is behind you|Rewire/i, 'Reconnect complete; Rewire lit');
});
