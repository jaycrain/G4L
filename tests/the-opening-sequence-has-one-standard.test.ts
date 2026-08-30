// THE OPENING SEQUENCE HAS ONE SPACING STANDARD, AND IT IS LOCKED.
//
// Donna, 2026-08-30, on the five opening screens: "Align buttons on ALL screens to match final placement here"
// and "Remove outline from outside of button" — the second time she has asked for the ring (2026-08-22, item 6).
// Jay: "establish the standard formatting across viewports and lock it in."
//
// The buttons drifted because five screens each carried their own margins, so "align them all" meant editing five
// places and hoping. The fix is three tokens on .onbwel that every screen reads. This test fails if a screen
// starts setting its own again — which is the only way they can come apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const opening = css.slice(css.indexOf('.onbwel {'), css.indexOf('/* The keeper OFFER'));

test('the three spacing tokens exist and are declared once', () => {
  for (const t of ['--onbwel-gap-copy', '--onbwel-gap-inner', '--onbwel-gap-cta']) {
    assert.equal((css.match(new RegExp(`${t}\\s*:`, 'g')) ?? []).length, 1, `${t} is declared exactly once`);
  }
});

test('the button and the blocks above it read the tokens, never a hand-set margin', () => {
  assert.match(css, /\.onbwel-cta \{ margin-top: var\(--onbwel-gap-cta\)/, 'the button spacing is the token');
  assert.match(css, /\.onbwel-quotes \{[^}]*margin: var\(--onbwel-gap-copy\)/, 'the bubbles use the token');
  assert.match(css, /\.onbwel-rs \{[^}]*margin: var\(--onbwel-gap-copy\)/, 'the phase row uses the token');
  // The regression: a screen re-introducing its own px margin above the button.
  assert.ok(!/\.onbwel-cta \{ margin-top: \d+px/.test(css), 'no hand-set margin on the CTA');
});

test('the focus ring is kept but made to contrast — not deleted', () => {
  // Removing it outright is an accessibility failure; leaving it teal-on-teal is why she read it as a stray
  // outline. Contrast is the third way out, and this pins it so neither mistake returns.
  assert.match(css, /\.onbwel-cta:focus-visible \{ outline: 2px solid #fff/, 'a white ring on the filled button');
  assert.match(css, /button:focus-visible/, 'the app-wide focus affordance still exists');
});

test('the line Donna asked us to cut is gone', () => {
  const welcome = readFileSync(new URL('../app/onboarding/welcome.tsx', import.meta.url), 'utf8');
  assert.ok(!/building towards 100/.test(welcome), '"building towards 100" removed from the progress screen');
});

test("screen one's sunrise is halved VISUALLY, without moving its button", () => {
  // Both of her asks at once. Shrinking the box halved the reserved space too, so slide 1's button rose 45px above
  // the other four — exactly half the icon height, and exactly what she reported: "the opening Wake Up one where
  // button appears to be in a different placement than on subsequent ones." A transform does not affect layout, so
  // the image is half size and the space it holds is unchanged.
  assert.match(css, /\.onbwel-first \.onbwel-art \{[\s\S]*?transform: scale\(0\.5\)/, 'scaled, not resized');
  assert.ok(!/\.onbwel-first \.onbwel-art \{[^}]*height: calc\(/.test(css), 'the box height is NOT reduced');
  assert.ok(!/^\.onbwel-art \{[^}]*height: calc\(/m.test(css), 'the shared icon box is untouched for the other four');
});

test('the CTA position comes from the measured zone, not a lift', () => {
  // The lift was the wrong mechanism and is deleted. It moved the button by a fixed number of pixels while the
  // problem scaled with WINDOW HEIGHT — 20px of gap at 1280x800, 220px at 600x900, same CSS. Two rounds of tuning
  // it were two rounds of answering the wrong question, which is worth leaving written down.
  assert.ok(!/--onbwel-cta-lift/.test(css), 'the lift is gone, not merely set to zero');
  assert.match(css, /--onbwel-copy-h: 262px/, 'the wide band');
  assert.match(css, /--onbwel-copy-h: 292px/, 'the middle band');
  assert.match(css, /--onbwel-copy-h: 372px/, 'the phone band');
  // Each band edge is where the CHECK says the copy stops wrapping longer, not where it seemed reasonable: the
  // first attempt guessed 560 and the fit check caught 286px of content in a 262px box at 561.
  assert.match(css, /max-width: 575px\) \{ :root \{ --onbwel-copy-h: 292px/, 'middle band edge');
  assert.match(css, /max-width: 480px\) \{ :root \{ --onbwel-copy-h: 372px/, 'phone band edge');
});
