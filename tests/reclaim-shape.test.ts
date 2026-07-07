import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMultiWantParagraph, isLifeVision, semanticOverlap } from '../lib/agent/reclaim-shape.ts';

// Decision II — the Reclaim Capture Discipline shape detectors. The fixture set is DONNA'S EXACT walk inputs (the
// messy real capture that motivated the decision), plus the discrete wants that must NOT trip a detector.

// ── Donna's actual Reclaim List from the walk ──
const DONNA_LIST = [
  'My fitness',
  'Start with losing about 35 lbs',
  'Lose about 35 lbs',
  '2-3 times a week to start with',
  'Buy some new clothes',
  'Hang out with friends on weekends',
];

test('multi-want paragraph — Donna\'s "regular income…" splits into several wants; discrete wants do not', () => {
  // The overlapping/verbose item from her walk — several wants crammed together.
  assert.equal(isMultiWantParagraph('Regular income that covers at least our baseline needs. Freelance, creative projects and funding for my role in G4L.'), true);
  // Discrete wants must NOT trip it (draw-out is for shape, not length).
  for (const item of ['My fitness', 'Lose about 35 lbs', 'Buy some new clothes', 'Hang out with friends on weekends']) {
    assert.equal(isMultiWantParagraph(item), false, `discrete want stays single: ${item}`);
  }
});

test('life-vision — Donna\'s "I\'ll be 60…" vision is caught; concrete wants are not', () => {
  assert.equal(
    isLifeVision("I'll be 60 in exactly 2 months. I want to spend the rest of my days peacefully, in gratitude and feeling like I can be myself in every place I go and exist."),
    true,
  );
  for (const item of ['Lose about 35 lbs', 'Buy some new clothes', 'My fitness', 'Hang out with friends on weekends']) {
    assert.equal(isLifeVision(item), false, `concrete want is not a vision: ${item}`);
  }
});

test('semantic overlap — the two "lose 35 lbs" items are the same want; distinct wants are not', () => {
  // The core Decision II gap: fragment-dedup misses same-meaning overlaps.
  assert.equal(semanticOverlap('Start with losing about 35 lbs', DONNA_LIST), 'Lose about 35 lbs');
  assert.equal(semanticOverlap('Lose about 35 lbs', ['My fitness', 'Start with losing about 35 lbs']), 'Start with losing about 35 lbs');
  // Distinct wants must NOT be proposed for merge.
  assert.equal(semanticOverlap('Buy some new clothes', DONNA_LIST), null);
  assert.equal(semanticOverlap('Hang out with friends on weekends', ['My fitness', 'Lose about 35 lbs']), null);
  assert.equal(semanticOverlap('My fitness', ['Lose about 35 lbs', 'Buy some new clothes']), null);
});
