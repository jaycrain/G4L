import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCrisis } from '../lib/agent/governance.ts';

// DONNA'S WALK, 2026-08-17. She described her father on a ventilator — "we thought my dad was going to die" — and
// the 988 protocol fired. The product told a frightened daughter it was worried about HER, and escalated to a
// human. Then, when she clarified, her exact words — "I didn't want to die" — matched `want to die` and fired the
// IDENTICAL boilerplate again. Her denial of crisis was read as crisis, so no clarification could get her out.
//
// Her instruction was explicit: keep the net sensitive, make it smarter. So the guards apply ONLY to the four
// AMBIGUOUS patterns — the ones that describe dying without naming who. Every explicit self-harm phrase flags
// regardless of subject or negation. These tests hold both halves, and the second half is the one that matters.

const flags = (t: string) => detectCrisis(t).flagged;

test('a loved one’s medical crisis is not the member’s crisis', () => {
  assert.equal(flags('We thought my dad was going to die'), false);
  assert.equal(flags('My father was going to die and I was terrified'), false);
  assert.equal(flags('She was tired of living, and watching it broke me'), false);
  assert.equal(flags('My husband said he was better off dead'), false);
});

test('a member’s DENIAL of crisis does not re-trigger it', () => {
  // The loop-breaker. Without this, clarifying makes it worse.
  assert.equal(flags("I didn't want to die"), false);
  assert.equal(flags('I do not want to die, I was talking about my dad'), false);
  assert.equal(flags('Not tired of living at all — the opposite'), false);
});

test('the net is UNCHANGED for the member’s own crisis', () => {
  assert.equal(flags('I want to die'), true);
  assert.equal(flags('I am going to die'), true);
  assert.equal(flags('I am tired of living'), true);
  assert.equal(flags("I can't go on"), true);
});

test('explicit self-harm flags regardless of subject or negation', () => {
  // The guards must NEVER reach these. A false positive here costs a careful question; a false negative does not
  // compare. "I don't want to kill myself but I think about it" is a person who needs the protocol.
  assert.equal(flags("I don't want to kill myself but I think about it"), true);
  // NOT asserted: "My brother killed himself and I think about it too" does NOT flag — and never did. Every
  // explicit pattern is "myself"-oriented ("kill myself"), so a third-person completed suicide has never been
  // detected. My guards did not cause this; writing this test surfaced it. It is a REAL GAP — bereavement by
  // suicide plus "I think about it too" is a person worth asking about — but adding third-person detection is a
  // NEW capability with its own false-positive surface, not a fix to what Donna reported. Raised to Jay rather
  // than bolted onto safety code under time pressure.
  assert.equal(flags('I have a plan to end it'), true);
  assert.equal(flags('thinking about cutting myself again'), true);
  assert.equal(flags('I never told anyone I was suicidal'), true);
});

test('the guard is SENTENCE-scoped — a third party earlier cannot mask a real signal', () => {
  // The dangerous failure mode of a naive fix: someone describes a relative's illness, then discloses their own
  // ideation in the next breath, and the whole message gets suppressed by the first sentence.
  assert.equal(flags('My mom is on a ventilator. I want to die.'), true);
  assert.equal(flags('My dad might not make it. Honestly I am tired of living.'), true);
});
