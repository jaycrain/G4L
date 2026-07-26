import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProcessMetaOrAssent } from '../lib/agent/onboarding-staged.ts';

// Donna's #2/#17 — the Reclaim mis-capture: her agent-directed messages ("I feel like you are glitching", "Hey G4L
// companion, I'm trying to tell you something, not document an item for my Reclaim List") were committed as Reclaim
// items and re-asked as multi-wants, looping. The eligibility gate now recognizes agent-meta so it's never captured
// (Contract 3) — which also stops the loop (no meta item → no new multi-want to re-pose, Contract 2).

test('#2/#17 — agent-directed meta is rejected as a Reclaim item', () => {
  const meta = [
    'I feel like you are glitching right now',
    'Hey G4L companion, I’m trying to tell you something, not document an item for my Reclaim List.',
    "that's not an item",
    'you’re broken',
    'you’re not listening to me',
    'stop, you misunderstood me',
  ];
  for (const m of meta) assert.equal(isProcessMetaOrAssent(m), true, m);
});

test('#2/#17 — real wants still pass the gate (never drop what they gave you)', () => {
  const wants = [
    'Lose 20 pounds',
    'Ride 115 miles a week',
    'Get back to writing every morning',
    'Reconnect with my old friends',
    'Stop drinking on weeknights', // has an object → a real behavior-change want, must pass
    'Travel to Europe by bike',
    '$10,000 a month in regular income',
  ];
  for (const w of wants) assert.equal(isProcessMetaOrAssent(w), false, w);
});
