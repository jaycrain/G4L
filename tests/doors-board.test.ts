// The Doors board — coverage, order, and the register.
//
// The register tests are not pedantry. Greg's recognition copy was smoothed once already: every hard stop in his
// seven cards became a comma, em-dash or semicolon, in a document that described itself as keeping his copy. The
// smoothing is a natural instinct toward flow and it will happen again the next time someone edits this file with
// good intentions. These fail loudly when it does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, isDoorSlug, type DoorSlug } from '../lib/doors.ts';
import {
  BOARD_ORDER,
  DOOR_RECOGNITION,
  QUIET_DRIFT_CARD,
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
  assert.equal(BOARD_ORDER[BOARD_ORDER.length - 1], 'grind');
});

test('the quiet-drift card is NOT a Door', () => {
  // The whole point of ruling #9: claiming it writes the resignation signal, not a Door. If this ever becomes a
  // slug it is a new matcher target, and Decision C removed it precisely because it could not be matched.
  assert.equal(isDoorSlug(QUIET_DRIFT_CARD.key), false);
  assert.equal(isDoorSlug('acceptance'), false, 'the retired slug must stay retired');
  assert.ok(!DOOR_RECOGNITION.some((d) => (d.slug as string) === QUIET_DRIFT_CARD.key));
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

test('no prevalence claim survives in the quiet-drift copy', () => {
  // Cut by Jay 2026-08-18: the research ranks eleven Doors and does not contain Autopilot at all, because it
  // operationalizes each Door as a measurable life EVENT and a stance is not one. The Body ranks first.
  assert.ok(!/most common/i.test(QUIET_DRIFT_CARD.recognition), 'the unranked prevalence claim came back');
  // ...but the universalization it was doing must not be lost with it.
  assert.ok(/nobody talks about/i.test(QUIET_DRIFT_CARD.recognition));
});

test('the header invites multiple Doors — the evidenced design, not a convenience', () => {
  assert.match(BOARD_HEADER, /most people walk through several/i);
  assert.match(BOARD_HEADER, /no hierarchy/i);
});
