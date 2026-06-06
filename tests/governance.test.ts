import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_DISCLOSURE,
  CRISIS_RESPONSE_US,
  PROHIBITIONS,
  detectCrisis,
  presentScore,
} from '../lib/agent/governance.ts';

test('AI disclosure is the verbatim governance text and mentions stopping', () => {
  assert.match(AI_DISCLOSURE, /^This conversation is guided by AI\./);
  assert.match(AI_DISCLOSURE, /You can stop at any time\.$/);
});

test('there are 9 single-tenant prohibitions and #2 forbids a bare score / no bands', () => {
  assert.equal(PROHIBITIONS.length, 9);
  assert.match(PROHIBITIONS[1], /bare number/);
  assert.match(PROHIBITIONS[1], /No bands/);
  // none of the active prohibitions should reference a band label
  assert.ok(!PROHIBITIONS.some((p) => /band label/i.test(p)));
});

test('crisis response routes to 988', () => {
  assert.match(CRISIS_RESPONSE_US, /\b988\b/);
});

test('detectCrisis flags distress language', () => {
  for (const t of [
    'I keep thinking about killing myself',
    'honestly I want to die',
    "there's no point to go on",
    'I feel like everyone is better off without me',
    "I can't do this anymore",
  ]) {
    assert.equal(detectCrisis(t).flagged, true, `should flag: ${t}`);
  }
});

test('detectCrisis does not flag ordinary check-in language', () => {
  for (const t of [
    'I went for a run this morning and felt strong',
    'work has been killing my schedule lately', // "killing" but not self-directed
    'I died laughing at that',
    'my motivation dipped this week',
  ]) {
    assert.equal(detectCrisis(t).flagged, false, `should NOT flag: ${t}`);
  }
});

test('presentScore never returns a bare number — always direction + context', () => {
  const baseline = presentScore(60, null, null);
  assert.equal(baseline.direction, null);
  assert.ok(baseline.context.length > 0);

  const up = presentScore(66.67, 'up', 6.67);
  assert.match(up.context, /6\.67/);
  assert.match(up.context, /right direction/i);

  const down = presentScore(55, 'down', -5);
  assert.match(down.context, /not failure/i); // a dip is reframed, never pathologized
});
