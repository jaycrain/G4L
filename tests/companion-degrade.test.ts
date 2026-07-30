import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextBlock, type CheckinContext } from '../lib/agent/checkin.ts';

// CAT-38 — the Companion is the cornerstone, and a degraded context used to be INVISIBLE to it. If any
// supplementary read threw (a prod-drifted table, a transient error), buildContext fell back to `minimal`,
// dropping the member's story, Playbook, IDQ detail and Grinta — while the system prompt hard-forbids denying
// that we remember them. So the agent was instructed to be omniscient over a gutted record: confabulate, or go
// vague. Neither is acceptable from the surface whose whole job is being trustworthy about what it knows.

const base: CheckinContext = {
  displayName: 'Donna',
  identityNoun: 'Runner',
  doorDisplayNames: ['The Grind'],
  idScore: null,
  direction: null,
  currentFocus: null,
  lastCompletedAsset: null,
  reclaimList: ['Run a 5k'],
};

test('a degraded context SAYS so, and licenses honesty instead of invention', () => {
  const block = contextBlock({ ...base, degraded: true });
  assert.match(block, /CONTEXT IS INCOMPLETE RIGHT NOW/);
  assert.match(block, /Do NOT invent specifics you cannot see/);
  assert.match(block, /ask them\s+to remind you|remind you/, 'it is given a truthful way out');
});

test('the degrade notice never licenses denying memory — the rule that protects trust still holds', () => {
  const block = contextBlock({ ...base, degraded: true });
  assert.match(block, /NEVER say you do not remember them/);
  assert.match(block, /durable record is intact/);
});

test('the caveat comes BEFORE the facts, so the model reads it in context', () => {
  const block = contextBlock({ ...base, degraded: true, today: 'Thursday, July 30, 2026' });
  assert.ok(
    block.indexOf('CONTEXT IS INCOMPLETE') < block.indexOf('Today is'),
    'a caveat after the data is a caveat the model may not weigh',
  );
});

test('a healthy context carries NO caveat — this must never leak into the normal voice', () => {
  const block = contextBlock({ ...base, today: 'Thursday, July 30, 2026' });
  assert.doesNotMatch(block, /CONTEXT IS INCOMPLETE/);
  assert.doesNotMatch(block, /Do NOT invent specifics/);
});
