// W-12: accumulated gap chapters must be joined with a sentence boundary — a bare space ran sentences together
// ("gotten me there It went deeper"). joinGapChapters adds a period when the prior chapter lacks terminal punctuation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinGapChapters } from '../lib/agent/onboarding-staged.ts';

test('joinGapChapters · adds a period when the prior chapter has none', () => {
  assert.equal(joinGapChapters('gotten me there', 'It went deeper'), 'gotten me there. It went deeper');
});

test('joinGapChapters · keeps existing terminal punctuation (no double period)', () => {
  assert.equal(joinGapChapters('It hit hard.', 'Then work fell apart'), 'It hit hard. Then work fell apart');
  assert.equal(joinGapChapters('Really?', 'Yes'), 'Really? Yes');
});

test('joinGapChapters · degrades cleanly on empty inputs', () => {
  assert.equal(joinGapChapters('', 'first chapter'), 'first chapter');
  assert.equal(joinGapChapters('only chapter', ''), 'only chapter');
});
