import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanerReclaimText } from '../lib/agent/onboarding-staged.ts';

// W-09: when two overlapping wants merge, keep the CLEANER phrasing — not whichever was captured first. The bug:
// keep/drop were assigned by list position, so the model's "Theme — concrete" composition survived over the plain
// concrete want just because it came earlier ("Fitness back — riding up to Brainard Lake" beat "Riding up to
// Brainard Lake"). cleanerReclaimText prefers the text WITHOUT a leading "Theme —" preamble.

test('cleanerReclaimText · drops the "Theme —" preamble in favor of the plain want (either order)', () => {
  const adorned = 'Fitness back — riding up to Brainard Lake';
  const plain = 'Riding up to Brainard Lake';
  assert.equal(cleanerReclaimText(adorned, plain), plain, 'adorned first → keep the plain one');
  assert.equal(cleanerReclaimText(plain, adorned), plain, 'plain first → still keep the plain one');
});

test('cleanerReclaimText · a tie (neither adorned) keeps the earlier item — prior conservative default', () => {
  assert.equal(
    cleanerReclaimText('Get strong again', 'Get strong'),
    'Get strong again',
    'neither has a theme preamble → keep `a` (the earlier)',
  );
});

test('cleanerReclaimText · a tie (both adorned) keeps the earlier item', () => {
  const a = 'Fitness back — riding up to Brainard Lake';
  const b = 'Health back — climbing again';
  assert.equal(cleanerReclaimText(a, b), a, 'both adorned → keep `a`');
});

test('cleanerReclaimText · a hyphenated want is NOT mistaken for a theme preamble', () => {
  // A real hyphenated/compound want (no spaced em-dash) must not read as adorned.
  const a = 'Long-distance cycling shape';
  const b = 'Cycling shape';
  assert.equal(cleanerReclaimText(a, b), a, 'hyphen ≠ " — " preamble; tie keeps the earlier');
});
