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

// W-33: the STAGED backstop-append path (onboarding-staged.ts) joined chapters with a bare space, bypassing this
// helper — so a progressive revealer's gap ran together ("consumed me It also…", "as well It kept…"). It now routes
// through joinGapChapters like the confirm-append path. This asserts the founder's exact re-walk shape is boundaried.
test('joinGapChapters · handles the founder re-walk shape (no run-on across appended chapters)', () => {
  const gap = joinGapChapters('Work consumed me', 'It also caused stress in my marriage');
  assert.equal(gap, 'Work consumed me. It also caused stress in my marriage');
  assert.ok(!/me It/.test(gap), 'no bare-space run-on');
});
