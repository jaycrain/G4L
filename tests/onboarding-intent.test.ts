import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  correctsReflection,
  hasGenuineLoss,
  isAcceptanceFade,
  isForwardAmbition,
  memberClosingReclaim,
  memberDeflecting,
  resolveGapConfirm,
  shouldCaptureStagedGap,
  shouldCaptureStagedReclaim,
  type GapConfirmIntent,
} from '../lib/agent/onboarding-intent.ts';

// ============================================================================================================
// THE INTENT CORPUS — the single documented table of "what a member utterance MEANS".
//
// This is the one place to add a phrasing when a new persona says something the engine mis-reads. Add the case
// here (it fails), widen the matching regex in onboarding-intent.ts (it passes), and every stage that composes
// the primitive inherits the fix — no hunting through the engine for the right branch. Cases are drawn from the
// real walk transcripts + the replay fixtures.
// ============================================================================================================

// --- resolveGapConfirm: the gap reflect-confirm ("…or is there more to it?") --------------------------------
// done = advance to reclaim · dispute = reopen the beat · addition = append + draw out.
const GAP_CONFIRM: [string, GapConfirmIntent][] = [
  // DONE — a plain "no more" answer must never loop the beat (Jay: "won't take yes for an answer").
  ["That's it", 'done'],
  ['Nope', 'done'],
  ['No', 'done'],
  ['No more', 'done'],
  ["That's more or less it for now", 'done'],
  ['Yeah, that about sums it up', 'done'],
  ['I just did', 'done'],
  ['yes', 'done'],
  ["yes, you've got it", 'done'],
  ['exactly', 'done'],
  ['that lands', 'done'],
  ["that's the whole of it", 'done'],
  // DISPUTE — explicit wrongness, no new content → reopen.
  ["No, that's not quite right", 'dispute'],
  ["that's wrong", 'dispute'],
  ['you got it wrong', 'dispute'],
  ["that's not how it went", 'dispute'],
  // ADDITION — substantive new fade material → keep drawing out.
  ['Actually there was also my divorce that year — it wrecked me', 'addition'],
  ['and my dad got sick around the same time', 'addition'],
  ['there was work too, it piled on and crowded everything out', 'addition'],
];
test('intent · resolveGapConfirm — done / dispute / addition across the walk corpus', () => {
  for (const [msg, expected] of GAP_CONFIRM) {
    assert.equal(resolveGapConfirm(msg), expected, `"${msg}" → ${expected}`);
  }
});

// --- correctsReflection: identity / reclaim confirm --------------------------------------------------------
const CORRECTS: [string, boolean][] = [
  ['no, that’s not it', true],
  ['not quite — more the Builder', true],
  ['actually, the Writer', true],
  ['yes, that’s her', false],
  ['yeah no, that’s her', false], // colloquial yes — the affirmation guard
  ['perfect', false],
];
test('intent · correctsReflection — a real correction, not an affirmation', () => {
  for (const [msg, expected] of CORRECTS) assert.equal(correctsReflection(msg), expected, `"${msg}"`);
});

// --- memberClosingReclaim: the member is done adding wants -------------------------------------------------
const CLOSES: [string, boolean][] = [
  ["that's the list", true],
  ["that's it", true],
  ["I'm good", true],
  ['those are the real ones', true],
  ['Pretty solid start', true], // soft close / acknowledgement (Jay's walk — was captured as a want)
  ['that about sums it up', true],
  ['good enough', true],
  ["let's move on", true],
  ['Ride my bike more', false], // a real want, not a close
  ['see my friends again', false],
];
test('intent · memberClosingReclaim — closes vs genuine wants', () => {
  for (const [msg, expected] of CLOSES) assert.equal(memberClosingReclaim(msg), expected, `"${msg}"`);
});

// --- capture-worthiness -----------------------------------------------------------------------------------
// The ENGINE captures a reclaim want when it's offered AND not a close: !memberClosingReclaim && shouldCapture.
// Test that composition (a close like "that's my list" is filtered by memberClosingReclaim, not by the primitive).
const capturesReclaim = (m: string): boolean => !memberClosingReclaim(m) && shouldCaptureStagedReclaim(m);
const RECLAIM_CAPTURE: [string, boolean][] = [
  ['Ride my bike more', true],
  ['I want to see my friends again', true],
  ["that's my list", false], // a close, not a want (filtered by memberClosingReclaim)
  ['I don’t know', false], // uncertainty
  ['yes', false], // affirmation
  ['Pretty solid start', false], // soft close (never a want)
];
test('intent · reclaim capture (offered && not a close) — wants captured, closes/affirms/uncertainty rejected', () => {
  for (const [msg, expected] of RECLAIM_CAPTURE) assert.equal(capturesReclaim(msg), expected, `"${msg}"`);
});

// --- fade & scope: real Fade vs forward ambition vs Acceptance --------------------------------------------
test('intent · fade & scope classification', () => {
  // Genuine loss wins even alongside "no crisis".
  assert.equal(hasGenuineLoss('my dad got sick and I became his caregiver'), true);
  assert.equal(hasGenuineLoss('nothing went wrong, no loss or drift'), false);
  // Forward ambition (out of scope — declined), not a fade.
  assert.equal(isForwardAmbition('nothing went wrong, I just want to level up and scale'), true);
  assert.equal(isForwardAmbition('I lost myself caring for my parents'), false); // a real loss is never ambition
  // Acceptance (resignation to age-decline) IS a real Fade (routes to The Acceptance Door).
  assert.equal(isAcceptanceFade('this is just who I am now at my age, I’ve made my peace with it'), true);
});

// --- deflection -------------------------------------------------------------------------------------------
test('intent · memberDeflecting — refusals and wraps', () => {
  assert.equal(memberDeflecting("I'm not answering that again"), true);
  assert.equal(memberDeflecting("let's move on"), true);
  assert.equal(memberDeflecting('I was a competitive swimmer'), false);
});

// --- backstop: gap capture (untagged real-fade narrative) -------------------------------------------------
test('intent · shouldCaptureStagedGap — real fade captured, ambition/wrap rejected', () => {
  assert.equal(
    shouldCaptureStagedGap('It opened slowly — my dad got sick and I became his caregiver and lost my own life in it'),
    true,
  );
  assert.equal(shouldCaptureStagedGap('Knee. Then divorce.'), true); // terse but names Doors
  assert.equal(shouldCaptureStagedGap('I just want to pressure-test my SaaS idea and scale faster'), false);
  assert.equal(shouldCaptureStagedGap('yes'), false);
});
