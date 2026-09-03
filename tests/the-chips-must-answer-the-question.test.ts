// THE BUTTONS MUST ANSWER THE QUESTION THAT IS ON SCREEN.
//
// Donna, 2026-09-02, four times across the Doors and the Fade: "I was asked a question and also offered buttons.
// I ignored the buttons, entered an answer in the field, and they went away." Her screenshot is the whole case —
// the Companion's turn ends with
//
//     When did you first feel it?
//
// and underneath it the engine's own ask, "Have I got that right?", with There's more / That's it / Not quite
// right. She was asked one question and handed the answers to a different one. Typing was the only sensible move
// available to her, and she did it three times in the Doors before it happened again in the Fade.
//
// IT IS THE STACKING BUG IN NEW CLOTHES — her own earlier words, "asking me a question and not allowing me to
// answer it." withQuestion already refuses to append the engine's probe when the model has asked something. The
// chips never learned the rule. That is the fifth instance this week of a rule that exists and runs at one site,
// and here the site it skipped was `depthReady`: `wrappedUp` guarded against advancing on "another probe" and the
// other two branches did not. [[one-fact-many-sites]]
//
// JAY'S CALL, 2026-09-02, on whether to drop the chips entirely: no. They exist because of Donna's OWN report of
// 8/27 ("didn't take yes for an answer"), and removing them returns the most vulnerable beat in R2 to classifying
// free-text assent — five patches of history and no ending. The chips are right; where they were attached was not.
//
// GRAMMAR, NOT MEANING — the fixtures below are the real beats the rule was approved against. The test is whether
// the three answers FIT the final question: a question carrying a wh-word cannot be answered by "That's it", and a
// polar ruling carries none. Never a judgement of what the prose MEANS — judging prose is what got stage-agreement
// reverted for reciting a member's protest back to her as a goal. [[stage-agreement-invariant]]
//
// It tested the question's OPENING WORD for about an hour. The gate found the shape that breaks — a wh-word behind
// an adverbial clause — the same evening, and the fixture is in the list below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsOnOpenQuestion, drawoutShouldReflect } from '../lib/agent/onboarding-staged.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';

// Verbatim from Donna's screenshot, 2026-09-02 3:57pm.
const HERS = 'A plan that would take you to and through retirement. You\'d already mapped it — the road was drawn. '
  + 'And instead of the promotion at the end of the effort, the layoff.\n\nWhen did you first feel it?';

test('THE FIVE BEATS — every question Donna met, ruled the way Jay approved', () => {
  const OPEN = [
    HERS,
    // THE ONE THE FIRST VERSION OF THIS RULE MISSED, verbatim from the gate the evening it shipped. The question
    // is wide open, does NOT end the paragraph (a declarative coda follows), and does NOT begin with the wh-word
    // (an adverbial clause comes first). Chips were attached to it exactly as before the fix.
    'So let me ask it straight. Beyond the hours and the logistics — what\'s the thing you\'ve lost that you miss '
      + 'the most? Not the biggest on paper. The one you feel when you let yourself feel it.',
    'What does recognizing these Doors change about how you see your own Fade?',
    'Tell me what that day was actually like.', // an imperative ask — open for the same reason
  ];
  const RULING = [
    'Have I got that right — or is it not quite?',
    'Does that name it — or is it different?',
    'Is that the one worth chasing — or not quite it yet?',
    // The long real one from the gate: a ruling with a clause in the middle, still auxiliary-first.
    'Is that the real cut — that it\'s a loss you\'re not allowed to call a loss — or is that not quite it?',
  ];
  for (const t of OPEN) assert.equal(endsOnOpenQuestion(t), true, `chips would be offered under: "${t.slice(-60)}"`);
  for (const t of RULING) assert.equal(endsOnOpenQuestion(t), false, `chips would be withheld from a ruling: "${t}"`);
});

test('a declarative reflection is not an open question — the chips are the only ask, which is right', () => {
  assert.equal(endsOnOpenQuestion('Same hands, all outflow. The carrying never changed; what came back did.'), false);
  assert.equal(endsOnOpenQuestion(''), false);
});

test('it reads the LAST bubble, because that is what sits above the buttons', () => {
  // A turn is split into bubbles by BEAT_SEP. An earlier bubble's open question is not what she is answering.
  const turn = `What was that like?${BEAT_SEP}Have I got that right — or is it not quite?`;
  assert.equal(endsOnOpenQuestion(turn), false, 'an earlier bubble must not suppress chips that fit the last one');

  const inverted = `That is the shape of it.${BEAT_SEP}When did you first feel it?`;
  assert.equal(endsOnOpenQuestion(inverted), true);
});

test('a long coda after the ruling does not flip it — the paragraph is the unit, not the last N characters', () => {
  // The exact shape that broke withQuestion's char-window heuristic on two of Jay's walks.
  const t = 'Have I got that right, or is it not quite? Take your time with it — there is no rush on this one.';
  assert.equal(endsOnOpenQuestion(t), false, 'ends on a statement, so our ask is the only question standing');
});

// ── THE ADVANCE ITSELF ───────────────────────────────────────────────────────────────────────────────────────
test('the draw-out does not advance while the model is still asking — even when it flagged itself ready', () => {
  // depthReady true, depth past the floor: this advanced before, and produced Donna's screenshot.
  assert.equal(drawoutShouldReflect(HERS, true, 3, 2, 5), false,
    'advanced onto a confirm while the Companion had an open question outstanding');

  // The same turn, wrapped up declaratively, still advances — the beat must not stall.
  assert.equal(drawoutShouldReflect('The carrying never changed; what came back did. Same hands, all outflow.', true, 3, 2, 5), true);
});

test('a ruling question still advances — this is the beat the chips were built for', () => {
  assert.equal(drawoutShouldReflect('Have I got that right — or is it not quite?', true, 3, 2, 5), true);
});

test('THE CAP STILL WINS, so a model that keeps asking cannot loop the member', () => {
  // The anti-loop ceiling is load-bearing and must outrank this. At the cap we advance anyway, and reflectDoor
  // strips the stranded question so the chips are never left answering the wrong thing.
  assert.equal(drawoutShouldReflect(HERS, false, 5, 2, 5), true, 'the cap must still fire on an open question');
});

test('the member saying move on still outranks everything', () => {
  // The Independence Guarantee: she sets the depth and can stop any time. An open question from the model must
  // never trap her in a beat she has asked to leave — Donna's window that kept asking for another Tuesday.
  assert.equal(drawoutShouldReflect(HERS, false, 1, 2, 5, true), true);
});
