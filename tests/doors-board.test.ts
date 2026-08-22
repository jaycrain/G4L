// The Doors board — coverage, order, and the register.
//
// The register tests are not pedantry. Greg's recognition copy was smoothed once already: every hard stop in his
// seven cards became a comma, em-dash or semicolon, in a document that described itself as keeping his copy. The
// smoothing is a natural instinct toward flow and it will happen again the next time someone edits this file with
// good intentions. These fail loudly when it does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, isDoorSlug, matchDoors, type DoorSlug } from '../lib/doors.ts';
import {
  BOARD_ORDER,
  DOOR_RECOGNITION,
  BOARD_HEADER,
  boardCards,
  doorRecognition,
} from '../lib/content/doors-board.ts';

test('every Door has recognition copy — none reaches the board blank', () => {
  for (const d of DOORS) {
    const r = doorRecognition(d.slug as DoorSlug);
    assert.ok(r, `${d.slug} has no recognition copy — it would render as an empty card`);
    assert.ok(r!.recognition.length > 120, `${d.slug} copy is too thin to recognise yourself in`);
  }
});

test('the board shows every Door exactly once, in prevalence order', () => {
  assert.equal(BOARD_ORDER.length, DOORS.length, 'board order and the taxonomy have diverged');
  assert.equal(new Set(BOARD_ORDER).size, BOARD_ORDER.length, 'a Door appears twice');
  for (const s of BOARD_ORDER) assert.ok(isDoorSlug(s), `${s} is on the board but is not a Door`);
  assert.equal(boardCards().length, DOORS.length);
  // The near-universal Doors lead; the Grind sits last. Jay ruled KEEP the Grind — only its position moved.
  assert.equal(BOARD_ORDER[0], 'body', 'the most prevalent Door must lead');
  // Autopilot sits last — the prevalence research does not contain it at all, so last is the honest position for
  // the one card the ranking cannot speak to, and it leaves the evidenced order above it undisturbed.
  assert.equal(BOARD_ORDER[BOARD_ORDER.length - 1], 'autopilot');
  assert.equal(BOARD_ORDER[BOARD_ORDER.length - 2], 'grind');
});

test('Autopilot IS a Door, and is the one Door the matcher can never infer', () => {
  // REVERSED 2026-08-22. This test used to assert the opposite, on Doors-board ruling #9 — that Autopilot was a
  // stance in a taxonomy of events and so could not be a Door. Greg's R2 Gated Asset V4 says otherwise in his own
  // words: he names the Autopilot Door three times and puts it in the required minimum ("at minimum Relationship,
  // Social, Autopilot"), rated for relevance like every other Door.
  //
  // The REAL risk in that ruling was never the taxonomy — it was that a new slug means a new MATCHER target, and
  // a matcher is what misread Donna on Acceptance. So the invariant worth keeping is not "it is not a Door" but
  // "nothing can infer it". That is what this now asserts.
  assert.equal(isDoorSlug('autopilot'), true);
  assert.equal(isDoorSlug('acceptance'), false, 'the retired slug must stay retired');
  assert.ok(DOOR_RECOGNITION.some((d) => (d.slug as string) === 'autopilot'), 'it needs recognition copy to render');

  // The word itself, our own product copy, and a member describing exactly the pattern — none of them may tag it.
  for (const msg of [
    "I've been on autopilot for years",
    'the campaign, running on autopilot',
    'Autopilot',
    'work, eat, sleep, repeat — I stopped paying attention',
  ]) {
    assert.ok(!matchDoors(msg).includes('autopilot' as never), `matchDoors inferred Autopilot from "${msg}"`);
  }
});

test("REGISTER — Greg's hard stops survive; they are the mechanism, not punctuation", () => {
  const vanishing = doorRecognition('vanishing')!.recognition;
  // Three separate griefs. As a comma list they are inventory.
  assert.ok(vanishing.includes('Moved away. Got busy. Stopped calling.'), 'the Vanishing staccato was smoothed');

  const body = doorRecognition('body')!.recognition;
  assert.ok(body.includes("You didn't quit your sport. Your body quit it for you."), 'the Body turn was smoothed');
  // "physical self" drops the one word the product is built on, on the Door where the body IS the identity.
  assert.ok(body.includes('physical identity'), 'physical identity must not become physical self');

  const parents = doorRecognition('aging_parents')!.recognition;
  assert.ok(parents.includes('There was no time for you. No space for you.'), 'the Caregiver stops were smoothed');

  const nest = doorRecognition('empty_nest')!.recognition;
  // "filled" softens the Door until it is no longer a Fade.
  assert.ok(nest.includes('consumed every morning'), 'consumed must not become filled');
});

test('REGISTER — the copy is not uniformly staccato either', () => {
  // Cowork's refinement: the hammer lands because of contrast. Greg himself uses comma lists for enumeration.
  assert.ok(doorRecognition('grind')!.recognition.includes('The startup, the promotion, the demanding role.'));
  assert.ok(doorRecognition('load_bearer')!.recognition.includes('The bills, the logistics, the call'));
});

test('no prevalence claim survives in the Autopilot copy', () => {
  // Cut by Jay 2026-08-18 and it still holds now that it is a Door: the research does not contain Autopilot at
  // all — absent, not ranked low — because it operationalizes each Door as a measurable life EVENT. The Body
  // ranks first. Greg's copy is otherwise unchanged, moved verbatim out of the retired QUIET_DRIFT_CARD.
  const autopilot = doorRecognition('autopilot')!.recognition;
  assert.ok(!/most common/i.test(autopilot), 'the unranked prevalence claim came back');
  // ...but the universalization it was doing must not be lost with it.
  assert.ok(/nobody talks about/i.test(autopilot));
});

test('the header invites multiple Doors — the evidenced design, not a convenience', () => {
  assert.match(BOARD_HEADER, /most people walk through several/i);
  assert.match(BOARD_HEADER, /no hierarchy/i);
});
