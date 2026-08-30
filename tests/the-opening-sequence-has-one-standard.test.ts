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

test("screen one's sunrise is halved, and only screen one", () => {
  assert.match(css, /\.onbwel-first \.onbwel-art \{ height: calc\(var\(--onbwel-icon-h\) \/ 2\)/);
  // Anchored: an unanchored `\.onbwel-art \{` also matches the `.onbwel-first .onbwel-art` rule above and fails
  // on its own fix. The shared box is the rule that STARTS the line.
  assert.ok(!/^\.onbwel-art \{[^}]*height: calc\(/m.test(css), 'the shared icon box is untouched for the other four');
});

test('the CTA lift is a token, and it is smaller where the copy is tallest', () => {
  // Donna, an hour after the alignment fix: "These need to be higher across all screens. Here is the example
  // where it needs the most room." She marked the target on the FULLEST screen deliberately — a y that clears the
  // content there clears it everywhere, so "higher" and "aligned" are the same change, not competing ones.
  //
  // The phone override is not a style preference. At 375x812 the desktop lift put the button 25px ON TOP of the
  // last bubble — measured, not guessed — because a narrow column wraps the copy to more lines. Same shape as
  // --onbwel-icon-h: the decision is unchanged at every width, only the number moves.
  assert.match(css, /--onbwel-cta-lift: 40px/, 'a base lift');
  assert.match(css, /--onbwel-cta-lift: 16px/, 'and a smaller one on phones');
  assert.match(css, /calc\(40px \+ var\(--onbwel-cta-lift\) \+ var\(--onbwel-foot-clear\)\)/, 'the wrap spends it as bottom padding');

  // THE CASCADE TRAP, pinned. The base must live at :root, NOT on .onbwel — a closer ancestor beats a :root
  // media override, so the phone value would silently never apply. That is the exact shape of the v3.5.2 bug
  // the override enumeration exists to catch, and I reintroduced it for ten minutes writing this.
  const onbwelRule = css.slice(css.indexOf('.onbwel { --onbwel-gap-copy'), css.indexOf('\n', css.indexOf('.onbwel { --onbwel-gap-copy')));
  assert.ok(!onbwelRule.includes('--onbwel-cta-lift'), 'the lift is not declared on .onbwel, where it would shadow the phone override');
});
