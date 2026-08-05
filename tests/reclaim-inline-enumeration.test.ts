// A member who arrives with a list in their head types the list — numbered, on one line — into a field that asked
// for one thing. Jennifer did exactly that (2026-08-05): her whole Reclaim List landed as ONE 500-character item,
// the three goals inside it were unreachable, and when she later re-typed two of them by hand nothing recognised
// them as the same wants. She had separated them herself. We threw the separation away.
//
// These cover the split (it fires on a real enumeration, and stays quiet on everything else) and the two seams it
// has to cross: the builder submission parser, and the shape gate's proposal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitInlineEnumeration, reconcileReclaimShapes } from '../lib/agent/reclaim-shape.ts';
import { parseReclaimListSubmission, isListBlock } from '../lib/agent/onboarding-staged.ts';

// Jennifer's shape: a sentence of context, then her goals numbered inline.
const JENNIFER =
  'I want to get back to feeling like myself before Dad got sick. My goals: 1. Back to lifting 3x a week ' +
  '2. Lose 8 lbs 3. Walk daily with Sarah';

test('splits a member-numbered list typed on one line', () => {
  const parts = splitInlineEnumeration(JENNIFER);
  assert.ok(parts, 'her three numbered goals are right there — this must not return null');
  assert.deepEqual(parts, [
    // Her lead-in is a real want and is kept — but the "My goals" label that introduces the list is not, and read
    // as an item of its own on the live walk.
    'I want to get back to feeling like myself before Dad got sick.',
    'Back to lifting 3x a week',
    'Lose 8 lbs',
    'Walk daily with Sarah',
  ]);
});

test('THE GOAL THAT WAS LOST IS REACHABLE', () => {
  // "Lose 8 lbs" was her goal 2. Under the old draw-out the member was asked to pick ONE want out of the paragraph,
  // so the two they didn't pick were dropped — this is the specific loss the split exists to prevent.
  assert.ok(splitInlineEnumeration(JENNIFER)!.includes('Lose 8 lbs'));
});

test('a bare label preamble is scaffolding, not a want', () => {
  const parts = splitInlineEnumeration('My goals: 1. Ride again 2. Sleep through the night');
  assert.deepEqual(parts, ['Ride again', 'Sleep through the night'], '"My goals" carries no want — do not store it');
});

test('one item that merely contains a number is NOT a list', () => {
  assert.equal(splitInlineEnumeration('Run a 5k in under 25:00'), null);
  assert.equal(splitInlineEnumeration('Be home for dinner 3. times a week'), null, 'a stray marker with no 1. ahead of it');
  assert.equal(splitInlineEnumeration('Lose 8 lbs'), null);
  assert.equal(splitInlineEnumeration(''), null);
});

test('the run must ascend from 1 — out-of-sequence markers do not make a list', () => {
  assert.equal(splitInlineEnumeration('I weigh 200 lbs. 4. is my lucky number'), null);
});

test('parseReclaimListSubmission — the seam the builder submits through', () => {
  // The builder sends "• "-prefixed lines. One of those lines holding an inline list must still arrive as items.
  const submitted = ['• Get back on the bike', `• ${JENNIFER}`].join('\n');
  const items = parseReclaimListSubmission(submitted);
  assert.ok(items.includes('Get back on the bike'), 'the ordinary entry survives untouched');
  assert.ok(items.includes('Lose 8 lbs'), 'the buried goal is now its own item');
  assert.ok(items.includes('Walk daily with Sarah'));
  assert.ok(!items.some((i) => i.length > 200), `no blob survives: ${JSON.stringify(items)}`);
});

test('a normal multi-line submission is unchanged', () => {
  const items = parseReclaimListSubmission('• Ride again\n• Lose 8 lbs\n• Sleep through the night');
  assert.deepEqual(items, ['Ride again', 'Lose 8 lbs', 'Sleep through the night']);
});

test('isListBlock sees the one-line list too', () => {
  assert.equal(isListBlock(JENNIFER), true, 'line-led markers were the only shape it recognised');
  assert.equal(isListBlock('- ride again\n- sleep better'), true, 'the old shape still holds');
  assert.equal(isListBlock('I want to ride again'), false);
});

test('the shape gate offers the SPLIT, not "pick one"', () => {
  // Reaching the gate with the blob still assembled (any path that bypasses the parser), the proposal must name
  // every want and offer to separate them — asking "which one do you most want back?" throws two of them away.
  const issue = reconcileReclaimShapes([JENNIFER, 'Ride again', 'Sleep through the night']);
  assert.equal(issue?.kind, 'multiwant');
  if (issue?.kind === 'multiwant') {
    const parts = splitInlineEnumeration(issue.item);
    assert.ok(parts && parts.length >= 3, 'the gate hands the engine a splittable item');
  }
});

test('DUPLICATES BECOME VISIBLE ONCE THE BLOB IS SPLIT', () => {
  // The real damage: because "Back to lifting 3x a week" was buried in prose, re-typing it in her own words looked
  // like a brand-new want — Jaccard against a 500-character blob is near zero, so overlap could never have caught
  // it. Split first, and the pair is finally comparable. (An EXACT re-type is a different path: appendReclaim's
  // dedup blocks it before the gate, which is why semanticOverlap skips exact matches.)
  const list = [...splitInlineEnumeration(JENNIFER)!, 'Get back to lifting 3 times a week'];
  const seen = new Set<string>();
  let issue = reconcileReclaimShapes(list, seen);
  // Walk past any earlier shape (the preamble reads as a want) to reach the overlap.
  for (let i = 0; i < 6 && issue && issue.kind !== 'overlap'; i++) {
    seen.add(
      issue.kind === 'overlap'
        ? `overlap:${[issue.keep, issue.drop].sort().join('::')}`
        : `${issue.kind}:${issue.item}`,
    );
    issue = reconcileReclaimShapes(list, seen);
  }
  assert.equal(issue?.kind, 'overlap', 'the duplicate is now catchable — it was invisible inside the blob');
});
