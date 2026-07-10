import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireW3Opening, w3Context, REWIRE_W3_SYSTEM } from '../lib/agent/rewire.ts';

// W-23 — the arc serves the member's OWN prior-session words back, verbatim, at the right beat. W3 (the False Start
// Protocol) pulls the W1 true line + the W2 image forward. The invariant: those exact strings reach the model context
// unparaphrased, and the system prompt forbids generalizing them ("the picture you built") — hearing your own words at
// the moment of a slip is the north star ("remember, so the knowing compounds") doing real work.

const TRUE_LINE = 'I am still an athlete, even on the days I do not move.';
const IMAGE = 'Standing at the trailhead at dawn, pack on, the valley opening below me — unhurried, strong.';

test('W3 carries the member’s prior keepers into collected verbatim (the callback seam)', () => {
  const t = rewireW3Opening({ trueLines: [TRUE_LINE], image: IMAGE, reclaimList: [], identityNoun: 'the Athlete' });
  assert.deepEqual(t.state.collected.w3TrueLines, [TRUE_LINE], 'the W1 true line is carried, exact');
  assert.equal(t.state.collected.w3Image, IMAGE, 'the W2 image is carried, exact');
});

test('W3 context injects the true line + image VERBATIM (not paraphrased)', () => {
  const ctx = w3Context({ identityNoun: 'the Athlete', w3TrueLines: [TRUE_LINE], w3Image: IMAGE });
  assert.ok(ctx.includes(TRUE_LINE), 'the exact true line reaches the model context');
  assert.ok(ctx.includes(IMAGE), 'the exact image reaches the model context');
  assert.match(ctx, /reach for these at the Reframe/i, 'the true line is tagged to the Reframe beat');
  assert.match(ctx, /point them here at the Restart/i, 'the image is tagged to the Restart beat');
});

test('W3 context degrades gracefully when a tool is missing (no empty quotes)', () => {
  const ctx = w3Context({ identityNoun: 'the Athlete' }); // no keepers loaded
  assert.ok(!ctx.includes('“”') && !ctx.includes('Reframe'), 'no dangling true-line line when there is none');
});

test('W3 system prompt forbids paraphrasing the recalled tools (the founder’s "generic serve" fix)', () => {
  assert.match(REWIRE_W3_SYSTEM, /QUOTE THEIR EXACT WORDS/i, 'the prompt demands verbatim recall');
  assert.match(REWIRE_W3_SYSTEM, /never paraphrase or generalize/i, 'explicitly bans the generic serve');
});
