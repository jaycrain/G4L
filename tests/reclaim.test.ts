import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReclaimList,
  validateDoors,
  validateReconnectOutput,
  RECLAIM_LIST_MIN,
  RECLAIM_LIST_FLOOR,
} from '../lib/member/reclaim.ts';
import { DOOR_SLUGS, matchDoors, correctDoors } from '../lib/doors.ts';

const five = ['a', 'b', 'c', 'd', 'e'];

test('reclaim list finalize floor is >=1 (Gate-1 decision); >=3 stays the soft aim', () => {
  assert.equal(RECLAIM_LIST_MIN, 3); // the AIM (drives the agent's nudge), not the hard finalize floor
  assert.equal(RECLAIM_LIST_FLOOR, 1); // hard floor — card carries any shortfall below the aim
  assert.equal(validateReclaimList(['a', 'b', 'c']).ok, true);
  assert.equal(validateReclaimList(['a', 'b']).ok, true); // sub-aim now finalizes (card carries the shortfall)
  assert.equal(validateReclaimList(['a']).ok, true); // at the floor
  assert.equal(validateReclaimList([]).ok, false); // below the floor — no real want given
  assert.equal(validateReclaimList(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']).ok, true); // no max
  assert.equal(validateReclaimList(['a', '  ']).ok, false); // empty item rejected
});

test('canonical doors validate; unknown do not; empty is valid (null routing, Taxonomy Spec §1)', () => {
  assert.equal(DOOR_SLUGS.length, 11); // 8 original + Full House + Grind + Load-Bearer (Jun 2026 taxonomy)
  assert.equal(validateDoors(['full_house']).ok, true);
  assert.equal(validateDoors(['grind']).ok, true);
  assert.equal(validateDoors(['load_bearer']).ok, true);
  assert.equal(validateDoors(['vanishing']).ok, true);
  assert.equal(validateDoors(['vanishing', 'body']).ok, true); // multi-Door
  assert.equal(validateDoors([]).ok, true); // null routing is valid — a real Fade can map to no Door
  assert.equal(validateDoors(['the_career']).ok, false); // stale MA v1.1 name
  assert.equal(validateDoors('vanishing').ok, false); // must be an array
});

test('matchDoors maps free text to one or more Doors in canonical order', () => {
  assert.deepEqual(matchDoors('the empty nest'), ['empty_nest']);
  assert.deepEqual(matchDoors('aging parents and the marriage'), ['aging_parents', 'marriage']);
  assert.deepEqual(matchDoors('5'), ['body']); // a bare numeric pick still works (back-compat)
  assert.deepEqual(matchDoors('1 and 3'), ['career_cliff', 'empty_nest']); // an explicit numeric pick still maps
  // ...but an incidental number in PROSE must NOT be read as a Door pick. Joanne run 4: her workout
  // frequency "3 walks / 3 workouts" wrongly tagged Door #3 (The Empty Nest) when scanned for doors.
  assert.equal(matchDoors('do 3 Apple Fitness workouts a week and at least 3 walks').includes('empty_nest'), false);
  assert.equal(matchDoors("I'd like to lose 30 lbs").length, 0);
  // The Full House maps from plain family-formation language, not just its title.
  assert.deepEqual(matchDoors('when I got married then had kids'), ['full_house']);
  assert.deepEqual(matchDoors('the full house'), ['full_house']);
  assert.deepEqual(matchDoors('nothing recognizable here'), []);
  // Caregiving-for-a-parent in plain words — the Door missed in testing (Joanne's 95-yo mom).
  assert.ok(matchDoors('taking care of my mother took over').includes('aging_parents'));
  assert.ok(matchDoors('caring for my 95 year old mom').includes('aging_parents'));
  assert.equal(matchDoors('more energy for my mom and my granddaughter').includes('aging_parents'), false); // a passing mention doesn't trip it
  // Joanne's full story surfaces BOTH doors, in canonical order. Work that GREW over her is now The
  // Grind (not Career Cliff = the role that ENDED — Taxonomy Spec §4 direction split), alongside the
  // parent-care Door.
  assert.deepEqual(matchDoors('bigger job, more responsibility, crazy hours — and caring for my 95 year old mom took over'), ['aging_parents', 'grind']);
  // Gate-2 Door-recall lift (rita's missed Doors): natural phrasing the aliases now catch.
  assert.ok(matchDoors('I got a layoff after twelve years').includes('career_cliff')); // "layoff" (was only "laid off")
  assert.ok(matchDoors('I was the sole breadwinner and he never stepped up').includes('load_bearer'));
  assert.ok(matchDoors('then my father went into a coma twice').includes('aging_parents'));
  assert.ok(matchDoors('around the same time my mother got sick').includes('aging_parents'));
  // rita's whole multi-Door story surfaces all three (canonical order).
  assert.deepEqual(
    matchDoors('a layoff right before my promotion, I was the sole breadwinner and he didn’t step up, and my father went into a coma'),
    ['career_cliff', 'aging_parents', 'load_bearer'],
  );
  // Guard: the new parent-health aliases stay parent-anchored — a passing "my father's birthday" must NOT tag.
  assert.equal(matchDoors('I want more time for my father birthday party').includes('aging_parents'), false);
  // rita's DISTINCT dual load: parent-care AND a financial/spousal load ("husband didnt step up, savings gone")
  // — both Doors must survive the precedence rule even without the literal word "breadwinner".
  assert.deepEqual(
    matchDoors('my husband didn’t step up, the savings are gone and the house is at risk, and my mother is declining so I’m her caretaker'),
    ['aging_parents', 'load_bearer'],
  );
});

test('correctDoors fixes the marriage/young-kids mis-tag (Full House, not Empty Nest / Aging Parents)', () => {
  // Scott's story: married, then kids, wife's struggles became his to carry — the model wrongly tagged
  // aging_parents + empty_nest. Neither has any signal here, so both are corrected to The Full House.
  const narrative = 'When I got married. Then we had kids and she suffered and the responsibility fell on me. New job, alimony, gained weight.';
  assert.deepEqual(correctDoors(['aging_parents', 'empty_nest'], narrative), ['full_house']);
  // It keeps legitimately-signaled Doors alongside, and adds Full House.
  assert.deepEqual(correctDoors(['body'], narrative), ['body', 'full_house']);
  // It does NOT touch a genuine Empty Nest / Aging Parents story (their own signal is present).
  assert.deepEqual(correctDoors(['empty_nest'], 'the kids grew up and moved out, the house went quiet'), ['empty_nest']);
  assert.deepEqual(correctDoors(['aging_parents'], 'I became the one caring for my aging mother'), ['aging_parents']);
  // No Full House signal → leaves the model's doors alone.
  assert.deepEqual(correctDoors(['career_cliff'], 'my role was eliminated in a restructure'), ['career_cliff']);
});

test('full Reconnect output validates the contract together', () => {
  assert.equal(
    validateReconnectOutput({ reclaimList: five, doors: ['vanishing', 'body'], baselineIdScore: 42.5 }).ok,
    true,
  );
  // Empty doors is NOT an error (null routing valid); the two real failures are list (empty → below the
  // >=1 floor) + score. (A 2-item list now validates — sub-aim finalizes, card carries the shortfall.)
  const bad = validateReconnectOutput({ reclaimList: [], doors: [], baselineIdScore: 130 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 2); // list (empty) + score (out of range)
  // An UNKNOWN door slug is still rejected even though empty is allowed.
  assert.equal(validateReconnectOutput({ reclaimList: five, doors: ['not_a_door'], baselineIdScore: 42 }).ok, false);
});
