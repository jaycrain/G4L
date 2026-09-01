// AN ASK IS AN ASK, WITH OR WITHOUT A QUESTION MARK.
//
// Donna's walk, 2026-09-01. Both ask-detectors in the onboarding engine tested for '?' and nothing else, so an
// imperative ask was invisible to them and the engine appended its own question on top. Four times across three
// screenshots — including inside the turn where the Companion apologised for doing it:
//
//   COMPANION | You're right. That's on me — I stacked a second question on top before you'd had a chance to
//             | answer the first. So just the one: tell me what these two years have been like since the job
//             | ended.
//             | That helps me understand. Did anything else pile on around then — or do we have the heart of it?
//   MEMBER    | Fucker
//
// and later, after she asked "Why are you rushing me through this?":
//
//   COMPANION | You're right. I keep nudging you forward like there's somewhere to be. There isn't.
//             | Take all the time you want. I'm here.
//             | Have I got that right the way it happened — or is there more?
//
// The model's own words were fine every time. The engine put the second question there.
//
// THE HALF THESE TESTS GUARD HARDEST IS THE FALSE POSITIVE. Suppressing our question on a turn where the model
// did NOT ask leaves the member with nothing to answer, which is worse than being asked twice — and the old
// seatbelt for it (a correction card she could bounce off) is confirm-only now. So the "does not fire" cases
// below are the load-bearing ones; the detector is a short explicit list, clause-initial, and for the append
// decision only counts when the turn ENDS on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsOnImperativeAsk, withQuestion, receiptOnly } from '../lib/agent/onboarding-staged.ts';

const PROBE = 'ENGINE_PROBE?';

// ── it fires on the real ones ─────────────────────────────────────────────────────────────────────────────────
const HER_TURNS = [
  'So just the one: tell me what these two years have been like since the job ended.',
  "I'm listening. Tell me the rest.",
  "Go on. I'm here for it.",
  "I'm here. Tell me.",
  'Tell me the rest of it.',
  "Take all the time you want. I'm here. Tell me how it went.",
];

test('the asks Donna was actually stacked on are recognised', () => {
  for (const t of HER_TURNS) {
    assert.equal(endsOnImperativeAsk(t), true, `should read as an ask: "${t}"`);
  }
});

test('and our question is no longer appended to them', () => {
  for (const t of HER_TURNS) {
    assert.equal(withQuestion(t, PROBE), t, `stacked a second question onto: "${t}"`);
  }
});

// ── it does NOT fire where a member would be left with nothing ────────────────────────────────────────────────
const NOT_ASKS = [
  // Reported speech and past tense — the shapes most likely to trip a naive "tell me" match.
  "You didn't tell me it had been that long.",
  'He would tell me everything, back then.',
  'What she said tells me you already knew.',
  'That must have been hard to sit with.',
  'So the whole thing compounded. The job and the standing, the money, your dad nearly dying.',
  'It came from someone certain, who they trusted to tell them the truth.',
];

test('a reflection that only MENTIONS telling is not an ask', () => {
  for (const t of NOT_ASKS) {
    assert.equal(endsOnImperativeAsk(t), false, `false positive — would strand the member: "${t}"`);
  }
});

test('and our question is still appended to a reflection that never asks', () => {
  // The load-bearing case. If this breaks, members get turns with nothing to answer.
  for (const t of NOT_ASKS) {
    assert.equal(withQuestion(t, PROBE), `${t}\n\n${PROBE}`, `dropped our only question after: "${t}"`);
  }
});

test('an ask quoted mid-reflection does not count — only the turn ENDING on one', () => {
  const quoted = 'Every morning she would say: tell me about your day. That stopped when the job went.';
  assert.equal(endsOnImperativeAsk(quoted), false);
  assert.equal(withQuestion(quoted, PROBE), `${quoted}\n\n${PROBE}`, 'the member must still get a question');
});

// ── receiptOnly cuts the ask so the scripted opener is the only one ────────────────────────────────────────────
test('receiptOnly strips a trailing imperative ask but keeps the reflection', () => {
  const t = 'So it was two losses at once. The role where people turned to you, and the ground under you.\n\nTell me the rest.';
  const out = receiptOnly(t);
  assert.ok(out.includes('two losses at once'), 'the reflection survives');
  assert.ok(!/tell me the rest/i.test(out), 'the ask comes off, because the caller is about to ask its own');
});

test('receiptOnly leaves a pure reflection completely alone', () => {
  const t = 'That is a lot to be hit with at once — the job, the money, and then your dad.';
  assert.equal(receiptOnly(t), t);
});
