import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReconnectCeremonyBeats } from '../lib/ceremony/reconnect-ceremony-beats.ts';
import { buildRewireCeremonyBeats } from '../lib/ceremony/rewire-ceremony-beats.ts';
import { buildRebuildCeremonyBeats } from '../lib/ceremony/rebuild-ceremony-beats.ts';
import { buildReclaimCeremonyBeats } from '../lib/ceremony/reclaim-ceremony-beats.ts';

// Redesign — the ceremony badge reveal (Decision WW). The earned milestone medal appears as a beat ONLY when the data
// carries a badge (set only under REDESIGN via earnedBadgeReveal); otherwise the ceremony is untouched (prod). This
// asserts the builder invariant for all four phase ceremonies.

const hasBadge = (beats: { reveal?: { kind: string; name?: string } }[]) => beats.filter((b) => b.reveal?.kind === 'badge');

test('Reconnect ceremony — badge beat appears with a badge, absent without', () => {
  const base = { idScore: 42, dimensions: null, grinta: null, keepers: [], doors: [] };
  const withBadge = buildReconnectCeremonyBeats({ ...base, badge: { name: 'You crossed the Threshold' } });
  const b = hasBadge(withBadge);
  assert.equal(b.length, 1);
  assert.equal(b[0]!.reveal!.name, 'You crossed the Threshold');
  assert.equal(hasBadge(buildReconnectCeremonyBeats({ ...base, badge: null })).length, 0);
});

test('Rewire / Rebuild / Reclaim ceremonies — badge beat gated on the badge', () => {
  const rw = { grinta: null, keepers: [] };
  assert.equal(hasBadge(buildRewireCeremonyBeats({ ...rw, badge: { name: 'You retrained the mind' } })).length, 1);
  assert.equal(hasBadge(buildRewireCeremonyBeats({ ...rw, badge: null })).length, 0);

  assert.equal(hasBadge(buildRebuildCeremonyBeats({ ...rw, badge: { name: 'You rebuilt the body' } })).length, 1);
  assert.equal(hasBadge(buildRebuildCeremonyBeats({ ...rw, badge: null })).length, 0);

  assert.equal(hasBadge(buildReclaimCeremonyBeats({ ...rw, badge: { name: 'You closed the loop' } })).length, 1);
  assert.equal(hasBadge(buildReclaimCeremonyBeats({ ...rw, badge: null })).length, 0);
});

test('the badge is the climax — it lands at/near the end of the sequence', () => {
  const beats = buildReconnectCeremonyBeats({ idScore: 42, dimensions: null, grinta: null, keepers: [], doors: [], badge: { name: 'You crossed the Threshold' } });
  const idx = beats.findIndex((b) => b.reveal?.kind === 'badge');
  assert.ok(idx >= beats.length - 2, 'badge beat is one of the last two beats (before the hand-off)');
});
