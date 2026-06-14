import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facetFromAnswers } from '../lib/agent/session-guide.ts';
import { getSession } from '../lib/curriculum/registry.ts';

test('facetFromAnswers pulls the reclaimed identity from the facet-contributing step', () => {
  const steps = getSession('RCN-EXC')!.steps!;
  const answers = { '1': 'Racing at dawn', '2': 'the racer', '3': 'I was the engine', '4': '  the Elite Cyclist  ' };
  assert.equal(facetFromAnswers(steps, answers), 'the Elite Cyclist'); // trimmed, from step 4 (contributes: facet)
});

test('facetFromAnswers returns null until the naming step is answered', () => {
  const steps = getSession('RCN-EXC')!.steps!;
  assert.equal(facetFromAnswers(steps, { '1': 'something', '2': 'more' }), null);
  assert.equal(facetFromAnswers(steps, { '4': '   ' }), null); // blank doesn't count
});

test('facetFromAnswers returns null when no step contributes a facet', () => {
  const fakeSteps = [{ n: 1, title: 't', prompt: 'p', input_type: 'writing' as const, companion_frame: 'f', probe: 'pr', contributes: 'none' as const }];
  assert.equal(facetFromAnswers(fakeSteps, { '1': 'x' }), null);
});
