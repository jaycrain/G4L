import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMultiWantParagraph, isLifeVision, isIdentityStatement, semanticOverlap, reconcileReclaimShapes } from '../lib/agent/reclaim-shape.ts';

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

test('identity — an "I\'m a/the <noun>" statement is a WHO, not a want (Donna walk)', () => {
  for (const id of [
    "I'm a director and creative producer", // Donna's exact list item
    'I am the caretaker for everyone',
    "I'm a runner at heart",
  ]) {
    assert.equal(isIdentityStatement(id), true, `identity statement: ${id}`);
  }
  // Real wants that OPEN with "I'm/I am" but aren't identity declarations must NOT be caught.
  for (const want of [
    "I'm getting back on my bike", // verb, not "a/an/the"
    "I'm a bit tired of sitting around", // adverbial "a bit", not an identity noun
    'I want to give back and help other people.',
    'Lose about 35 lbs',
    'Buy some new clothes',
  ]) {
    assert.equal(isIdentityStatement(want), false, `not an identity: ${want}`);
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

  // Explorer walk: same-intent SYNONYMS ("drop"/"lose") are the same want even though the words differ.
  assert.equal(semanticOverlap('Lose 40 lbs', ['Drop 40 lbs']), 'Drop 40 lbs');
  assert.equal(semanticOverlap('Shed 40 pounds', ['Lose 40 lbs']), 'Lose 40 lbs');
  // …but a different "cut" want must NOT false-merge into weight loss (the 0.6 threshold still guards).
  assert.equal(semanticOverlap('Cut back on alcohol', ['Lose 40 lbs']), null);
});

test('reconcile — finds Donna\'s overlap first, then reports clean once resolved', () => {
  // The whole 6-item list: the first issue is the "lose 35 lbs" overlap (no vision in this list).
  const issue = reconcileReclaimShapes(DONNA_LIST);
  assert.equal(issue?.kind, 'overlap');
  if (issue?.kind === 'overlap') {
    assert.equal(issue.keep, 'Start with losing about 35 lbs');
    assert.equal(issue.drop, 'Lose about 35 lbs');
  }
  // Drop the overlapping item → the list reconciles clean (nothing else to address).
  const resolved = DONNA_LIST.filter((x) => x !== 'Lose about 35 lbs');
  assert.equal(reconcileReclaimShapes(resolved), null);
});

test('reconcile — a vision in the list is addressed BEFORE an overlap (route-out wins)', () => {
  const withVision = ['Lose about 35 lbs', 'Start with losing about 35 lbs', "I'll be 60 in a month; I want to spend the rest of my days at peace and be myself everywhere I go"];
  const issue = reconcileReclaimShapes(withVision);
  assert.equal(issue?.kind, 'vision', 'the vision is pulled out first, even though an overlap also exists');
});

test('reconcile — an identity statement is addressed FIRST (it is not a want at all)', () => {
  const list = ['Creative outlet, do more films', "I'm a director and creative producer", 'Autonomy'];
  const issue = reconcileReclaimShapes(list);
  assert.equal(issue?.kind, 'identity');
  if (issue?.kind === 'identity') assert.equal(issue.item, "I'm a director and creative producer");
});
