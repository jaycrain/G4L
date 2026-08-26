// A CEREMONY BEAT LONGER THAN THE VIEWPORT MUST STILL BE READABLE FROM ITS FIRST LINE.
//
// Jay, 2026-08-26, at the end of the whole program: "Legacy Letter needs padding." It was not the padding. The
// padding was there and unreachable.
//
// `.cer-overlay` is a flex container with `align-items: center`, and centring an OVERSIZED child gives it a
// negative offset — the browser pushes the top above the viewport and there is nothing to scroll. Every other
// ceremony beat is a sentence or two and fits, so this was invisible for months. The Legacy Letter is nine
// paragraphs the member wrote to themselves a year forward, revisited at the close of the whole program, and it
// is the single most emotionally loaded surface in the product. It rendered with its opening line cut off.
//
// The fix pairs `overflow-y: auto` on the overlay with `margin: auto` on the card: centred when it fits,
// scrollable WITH its padding intact when it does not. `align-items: flex-start` alone would have un-centred
// every short beat to fix the one long one.
//
// Asserted on the STYLESHEET rather than in a browser, because raising this beat needs a completed Reclaim
// ceremony and the rule is what regresses — someone tidying "redundant" overflow off an overlay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');

function block(selector: string): string {
  const i = css.indexOf(`\n${selector} {`);
  assert.notEqual(i, -1, `${selector} not found — was it renamed?`);
  return css.slice(i, css.indexOf('}', i));
}

test('the ceremony overlay can scroll a beat taller than the screen', () => {
  const overlay = block('.cer-overlay');
  assert.match(overlay, /overflow-y:\s*auto/, 'an oversized beat has no way to scroll to its own top');
});

test('and the card centres by MARGIN, so its padding survives the overflow', () => {
  const card = block('.cer-card');
  assert.match(card, /margin:\s*auto/, 'without margin:auto the overlay scrolls but the top padding is still lost');
  assert.match(card, /padding:\s*30px/, 'the card kept its padding');
});

test('short beats stay centred — the fix must not un-centre the other twenty', () => {
  // The tempting one-line fix is align-items: flex-start. It works for the letter and pins every other beat to
  // the top of the screen, which is a worse product for the ceremony's normal case.
  assert.match(block('.cer-overlay'), /align-items:\s*center/, 'ceremony beats are centred');
});

test('the letter body has room under its last line', () => {
  // "Keep going." is the closing line of a letter to yourself. It sat 2px off the end of the teal rule.
  const body = block('.cer-legacy-body');
  const pad = body.match(/padding:\s*([^;]+);/)?.[1] ?? '';
  const bottom = pad.trim().split(/\s+/)[2] ?? '';
  assert.ok(parseInt(bottom, 10) >= 10, `the letter's last line has ${bottom} beneath it`);
});
