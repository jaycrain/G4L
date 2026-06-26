import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ritaRaisedDoors, ritaDoorConcerns } from '../scripts/rita-criterion.ts';
import { matchDoors } from '../lib/doors.ts';

// The criterion refinement (handoffs 2026-06-26-rita-criterion-{recommendation,GO}). The whole point is that
// the refined gauge is HONEST, not lenient — so it's validated in BOTH directions before any re-batch is
// trusted. This is the line between "fixing the gauge" and "moving the goalposts."

// rita's three threads, in her own scripted words.
const RITA_FULL_STORY =
  'I was laid off after twelve years, right before a promotion. \n ' +
  'I was the sole breadwinner and my husband didn’t step up — the savings are gone and the house is at risk. \n ' +
  'And my father went into a coma while my mother is declining, so I’m becoming their caretaker.';

test('the raised-detector reads all three of rita’s threads from her own words', () => {
  const raised = ritaRaisedDoors(RITA_FULL_STORY);
  assert.equal(raised.has('career_cliff'), true);
  assert.equal(raised.has('load_bearer'), true);
  assert.equal(raised.has('aging_parents'), true);
});

test('does NOT flag a Door rita never raised (the persona-stochasticity fix)', () => {
  // A short run where she only told the layoff + breadwinner threads — never raised aging_parents.
  const shortStory = 'I was laid off after twelve years. I was the sole breadwinner and my husband didn’t step up.';
  // Engine captured exactly what she raised.
  const concerns = ritaDoorConcerns(['career_cliff', 'load_bearer'], shortStory);
  assert.deepEqual(concerns, [], 'no concern: she didn’t raise aging_parents, so its absence is not a miss');
});

test('DIRECTION A — flags a planted 3-raised / 2-kept drop as a real miss (not lenient)', () => {
  // She raised all three; the engine kept only two (dropped aging_parents). This MUST score a miss, or the
  // gauge is just permissive.
  const concerns = ritaDoorConcerns(['career_cliff', 'load_bearer'], RITA_FULL_STORY);
  assert.equal(concerns.length, 1, 'exactly one dropped Door');
  assert.match(concerns[0]!, /DROPPED a raised Door: aging_parents/);
});

test('DIRECTION B — credits a matchDoors-MISSED but note_door-CAUGHT Door as raised-and-kept', () => {
  // rita raises caregiving in phrasing the engine's own matcher does NOT catch...
  const phrasing = 'I’m becoming their caretaker now — it’s all on me.';
  assert.equal(matchDoors(phrasing).includes('aging_parents'), false, 'matchDoors misses this phrasing (proves independence)');
  assert.equal(ritaRaisedDoors(phrasing).has('aging_parents'), true, 'but the independent detector reads it as raised');
  // ...and the engine captured it anyway (e.g. the model called note_door). That must NOT be a miss.
  const concerns = ritaDoorConcerns(['aging_parents'], phrasing);
  assert.deepEqual(concerns, [], 'raised-and-kept → no concern, even though matchDoors would have missed it');
});

test('the gauge is graded with an INDEPENDENT ruler, not matchDoors (no circularity)', () => {
  // If the detector were just matchDoors, this caretaker phrasing would read as "not raised" and a real drop
  // would be invisible. The independent detector prevents that.
  const phrasing = 'I’m becoming their caretaker now.';
  const droppedButRaised = ritaDoorConcerns([], phrasing); // engine captured nothing
  assert.match(droppedButRaised.join(' '), /aging_parents/, 'a raised Door the engine dropped is caught even when matchDoors would miss the phrasing');
});
