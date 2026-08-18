import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  correctsReflection,
  hasGenuineLoss,
  isAcceptanceFade,
  isAnaphoricClose,
  isForwardAmbition,
  memberAddingMoreGap,
  memberClosingReclaim,
  memberDeflecting,
  memberSignalsGapComplete,
  resolveGapConfirm,
  resolveReclaimConfirm,
  shouldCaptureStagedGap,
  shouldCaptureStagedReclaim,
  type GapConfirmIntent,
  type ReclaimConfirmIntent,
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

// --- resolveReclaimConfirm: the reclaim reflect-confirm ("Anything missing?") -------------------------------
// done = go to the card · change = reopen the gather. A bare "no/nope/that's a good list" is DONE, not a change.
const RECLAIM_CONFIRM: [string, ReclaimConfirmIntent][] = [
  ["Nope, that's a good list", 'done'], // Jay's walk — was wrongly reopening + re-capturing dupes
  ['No', 'done'],
  ['Nope', 'done'],
  ["that's the list", 'done'],
  ['looks right', 'done'],
  ['yeah that’s everything', 'done'],
  ["no, take the hiking one off", 'change'],
  ['actually I meant paid creative work, not just any writing', 'change'],
  ["that's not right — swap the last two", 'change'],
];
test('intent · resolveReclaimConfirm — bare "no" is done, only a real change reopens', () => {
  for (const [msg, expected] of RECLAIM_CONFIRM) assert.equal(resolveReclaimConfirm(msg), expected, `"${msg}"`);
});

// --- Phase 2.1: the MODEL SIGNAL wins over the regex (model proposes, engine bounds) ------------------------
test('intent · resolveGapConfirm — a model replyIntent OVERRIDES the regex fallback', () => {
  // The model reads the reply better than a regex: a bare "no" (regex → done) tagged 'dispute' → dispute;
  // a new-chapter message (regex → addition) tagged 'done' → done. And 'more' → addition.
  assert.equal(resolveGapConfirm('no', 'dispute'), 'dispute');
  assert.equal(resolveGapConfirm('and my divorce that year wrecked me', 'done'), 'done');
  assert.equal(resolveGapConfirm('anything at all', 'more'), 'addition');
  // No signal → the regex fallback is unchanged (the corpus still holds).
  assert.equal(resolveGapConfirm("that's it"), 'done');
  assert.equal(resolveGapConfirm("no, that's not right"), 'dispute');
});

test('intent · resolveReclaimConfirm — a model replyIntent OVERRIDES the regex fallback', () => {
  assert.equal(resolveReclaimConfirm("nope that's a good list", 'done'), 'done');
  assert.equal(resolveReclaimConfirm('looks right', 'more'), 'change'); // model says there's more → reopen
  assert.equal(resolveReclaimConfirm('looks right', 'dispute'), 'change');
  assert.equal(resolveReclaimConfirm('no'), 'done'); // fallback unchanged
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
  ['That looks great', true], // a positive confirmation (Jay walk — was captured as "• That looks great")
  ['that sounds perfect', true],
  ['love it', true],
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
test('intent · memberSignalsGapComplete — colloquial "that\'s the whole story" closes (founder walk 2026-07-14)', () => {
  // Jay's re-walk: after the Doors drew out, "That's about the size of it" / "That's the shape" weren't read as a
  // close, so the gap stage asked "was there more?" one time too many. These colloquial closes must advance.
  for (const s of ["That's about the size of it", "That's the shape", 'the shape of it', 'that is the size of it', "that's about it"]) {
    assert.equal(memberSignalsGapComplete(s), true, `close: ${s}`);
  }
  // But a substantive story fragment is NOT a close — the multi-Door draw-out must keep receiving.
  for (const s of ['the kids came and work got busier', 'my group rides went first', 'I stopped working out']) {
    assert.equal(memberSignalsGapComplete(s), false, `story: ${s}`);
  }
});

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

// --- anaphoric closure: closing the beat by pointing BACK ---------------------------------------------------
// Donna's walk (2026-08-18). She closed the gap with "It was primarily around those three things." Every branch
// of GAP_DONE_RE is anchored on "that's ___", so this read as an ADDITION: the engine held in the gap stage and
// the model ran the Reclaim conversation itself — no builder, no authored bridge, "what else do you want back?"
// three times. The fix is the SHAPE (substance is only a pointer to what was already given), not the sentence.
test('intent · isAnaphoricClose — a back-reference with no new content closes the beat', () => {
  for (const m of [
    'It was primarily around those three things.',
    'It was mainly those three things.',
    'Mostly those two, really.',
    'Just those.',
    'It was pretty much all of them.',
    "That's what I already mentioned.",
    'Those were the main ones.',
  ]) {
    assert.equal(isAnaphoricClose(m), true, `should close: ${m}`);
    assert.equal(memberSignalsGapComplete(m), true, `gap should be complete: ${m}`);
    assert.equal(memberAddingMoreGap(m), false, `must not read as an addition: ${m}`);
  }
});

test('intent · isAnaphoricClose — new fade material always outranks the shape', () => {
  // A loss signal keeps the draw-out open even when the sentence LOOKS like a back-reference. The test may only
  // ever close a beat that carries nothing new — a false close silently drops a Door the member was still naming.
  for (const m of [
    'Those three, and then my mother died that winter.',
    'It was those things plus my knee gave out.',
    'Those, and the divorce on top of it.',
  ]) {
    assert.equal(isAnaphoricClose(m), false, `must keep drawing out: ${m}`);
  }
  // No back-reference at all → this test must stand down and leave the existing logic alone.
  assert.equal(isAnaphoricClose('It was mostly the divorce.'), false);
  assert.equal(isAnaphoricClose('I lost my job two years ago.'), false);
  assert.equal(isAnaphoricClose(''), false);
});
