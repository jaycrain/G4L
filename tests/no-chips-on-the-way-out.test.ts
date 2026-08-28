// A MEMBER LEAVING IS NOT ASKED TO RULE ON THE WAY OUT.
//
// Donna, 2026-08-27: "It did an amazing job of having an understanding conversation with me. But it did follow on
// with the rote buttons to click at the end which were out of context as I had just said I would step away."
//
// The Companion's reply was right — she praised it in the same sentence. What followed it was a decision to make.
// We had no signal for LEAVING: memberDeflecting covers closing THIS beat ("we're done here", "moving on") and
// none of it covers someone saying they will come back later.
//
// The guard suppresses the chips and nothing else — it never advances a stage, stores anything, or ends a
// Session. So the failure direction is safe: a false positive costs a tap she could still have made by typing,
// and a false negative is what she already saw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberSteppingAway, memberDeflecting } from '../lib/agent/onboarding-intent.ts';

test('the ways a person actually says they are going', () => {
  for (const m of [
    "I'm going to step away for a bit",
    'I need to go',
    'I have to run',
    "I'll come back to this later",
    'Let me pick this up tomorrow',
    "That's enough for now",
    'Can we talk tomorrow?',
    'Goodnight',
    "I'm calling it a night",
    "I'll be back",
    'Stepping away',
  ]) assert.ok(memberSteppingAway(m), `should read as leaving: "${m}"`);
});

test('it does not fire on someone who is still in the conversation', () => {
  for (const m of [
    'I go running most mornings',                       // "go" as the member's own content
    'That was the year I had to leave my job',          // "leave" inside their story
    'It cost me a lot',
    "That's the whole of it",                           // finishing a BEAT, not leaving
    'There is more',
    'My dad needed me back home',                       // "back" in their story
    'I want to get back to riding',                     // the Reclaim List's whole vocabulary
    'Work ran later and later',
  ]) assert.ok(!memberSteppingAway(m), `should NOT read as leaving: "${m}"`);
});

// The two signals are different things and both need to exist. Closing a beat keeps you in the Session; leaving
// does not. Conflating them would have made the guard suppress chips on every ordinary "that's it".
test('leaving and closing-a-beat stay distinct', () => {
  assert.ok(memberDeflecting("that's all"), 'closing a beat is still deflecting');
  assert.ok(!memberSteppingAway('that\'s all'), 'but closing a beat is not leaving');
  assert.ok(memberSteppingAway("I'll pick it up tomorrow"), 'and leaving is not deflecting-only');
});

test("the Reclaim List's own words never read as an exit", () => {
  // "what you want BACK" is the product's core phrase — a leaving-detector that fires on it would suppress chips
  // through the entire reclaim beat.
  for (const m of ['I want my fitness back', 'Getting back on the bike', 'I want that part of me back'])
    assert.ok(!memberSteppingAway(m), `"${m}" is a want, not an exit`);
});
