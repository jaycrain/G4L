// The model may converse. It may not announce the outcome of a gate the engine has not reached.
//
// The POSITIVE cases are Donna's verbatim turns from 2026-08-20 (transcript turns 19, 21, 23, 27). The NEGATIVE
// cases matter more: this beat's entire subject is her list and what she wants back, and a detector that silences
// the conversation would be a worse bug than the one it fixes. Talking ABOUT the list is free; declaring it made,
// stored, or finished is not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimsGateOutcome } from '../lib/agent/gate-claims.ts';

test('CLAIMS — the model declaring the list made, stored, or the session over (Donna, verbatim)', () => {
  const real = [
    "So here's what you want back:\n\n- Lose the 20 lbs you gained\n- Get your fitness back",
    "That's your Reclaim List. It lives on your dashboard now, and it's yours to change anytime.",
    "That's plenty for today. You showed up and told the truth about a hard two years.",
    "Your Reclaim List and everything you shared are on your dashboard whenever you want them.",
    "For today, yes — that's the whole of onboarding.",
    "Everything you shared today is saved to your account, so nothing you told me is lost.",
    'No rush. You come back when it’s time.',
  ];
  for (const t of real) assert.equal(claimsGateOutcome(t), true, `should be caught: ${t.slice(0, 60)}`);
});

test('CONVERSATION IS FREE — the beat is about her list, and must stay sayable', () => {
  // If any of these ever trip, the detector has started eating the draw-out it exists to protect.
  const fine = [
    'What else do you want back? Take your time.',
    'Peace and optimism at home — that belongs on the list as much as anything physical.',
    'Your Reclaim List is the thing we build everything else around. What would you put on it?',
    'Is there anything else, or does that feel like the shape of it?',
    'That one matters. When did you last have it?',
    "You said you want your fitness back — what did that look like when you had it?",
    'The list can change any time you want it to. What else is missing?',
    'Tell me about the weight — when did you first notice it?',
    '',
  ];
  for (const t of fine) assert.equal(claimsGateOutcome(t), false, `must NOT be caught: ${t.slice(0, 60)}`);
});

test('PROVISIONAL framings are not claims — they say the opposite', () => {
  // Reclaim's C1 opens with this while inviting her to change the list. Flagged as a close it would be worse than
  // a false alarm: the engine drops the model's prose on that path, so the reflection would vanish and she would
  // be handed the builder mid-thought. Found by tests/reclaim-walk.test.ts.
  assert.equal(claimsGateOutcome("Here's your list as it stands:\n\n• get my strength back"), false);
  assert.equal(claimsGateOutcome("Here's your list so far — anything missing?"), false);
  assert.equal(claimsGateOutcome("That's the list right now, and it can change."), false);

  // …and the real close still trips, hedge or no hedge elsewhere in the turn.
  assert.equal(claimsGateOutcome("That's your Reclaim List. It lives on your dashboard now."), true);
  assert.equal(claimsGateOutcome("Here's your list as it stands. That's plenty for today."), true);
});
