import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProcessMetaOrAssent } from '../lib/agent/onboarding-staged.ts';

// W-42: the reclaim SHAPE GATE. Scott's cold walk committed his exit line "that's the end can i continue later?" as a
// Reclaim item. This locks: session-meta / assent / agent-questions are REJECTED; real life-wants (including
// behavior-change ones with an object) are KEPT. False-rejecting a real want is the dangerous failure — those cases
// are asserted explicitly.

test('shape gate · REJECTS session-meta / exit lines', () => {
  for (const junk of [
    "that's the end can i continue later?",
    'can I continue later?',
    'can we stop here',
    "that's the end",
    "that's it for now",
    "I'm done for now",
    'stop here',
    'pause for now',
    'finish this later',
    'take a break',
    'how long is this?',
    'how many more?',
    "what's next?",
    'are we done?',
    'not right now',
  ]) {
    assert.equal(isProcessMetaOrAssent(junk), true, `should reject: "${junk}"`);
  }
});

test('shape gate · REJECTS bare assent / dissent', () => {
  for (const junk of ['ok', 'okay', 'yes', 'yeah', 'no', 'nope', 'sure', 'fine', 'done', 'idk', "i don't know", 'nothing else', "that's it", 'thanks']) {
    assert.equal(isProcessMetaOrAssent(junk), true, `should reject: "${junk}"`);
  }
});

test('shape gate · KEEPS real life-wants — including behavior-change with an object (the dangerous false-reject)', () => {
  for (const want of [
    'get back on my bike, 2-3 rides a week',
    'lose 100 lbs to start with',
    'get off all meds',
    'stop drinking', // "stop" + object — a real want, NOT a session-exit
    'quit smoking', // "quit" + object — a real want
    'stop eating so much sugar',
    'start riding gravel',
    'my health and fitness',
    'reconnect with old friends',
    'waking up with a clear sense that I’m building a life I’m excited about',
    'running', // a bare one-word want is fine (the model sharpens it later)
    'more time outdoors',
    'sign up for a race as motivation',
  ]) {
    assert.equal(isProcessMetaOrAssent(want), false, `should KEEP: "${want}"`);
  }
});

test('shape gate · a tentative want phrased with "?" is spared (starts with a noun, not a question word)', () => {
  assert.equal(isProcessMetaOrAssent('riding again?'), false);
  assert.equal(isProcessMetaOrAssent('my creative work?'), false);
});
