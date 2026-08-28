// THE SHOW/HIDE TOGGLE SITS INSIDE ITS FIELD, VERTICALLY CENTRED.
//
// Jay, 2026-08-28: "Center the show/hide function vertically in the composer." In his screenshot the "Hide"
// button hangs below the bottom edge of the input it belongs inside.
//
// The cause was two `.pw-toggle` rules in this sheet. The first had the centring — `top: 50%` plus a
// translateY — and the second, further down and of equal specificity, won. It set `right` and nothing
// vertical, so the button fell to its static position and then took `margin-top: 1.5rem` from the global
// `button` rule on top of that.
//
// Which means it was wrong on BOTH password surfaces — the eye toggle in app/password-field.tsx as well as the
// Show/Hide in the onboarding gate — because they share the class and the losing rule was the one scoped to
// neither. One fact, two sites, and the site that got edited was the one that already worked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('.pw-toggle is defined exactly once', () => {
  // The count IS the guard. Two definitions is not a style problem — it is the mechanism by which a correct
  // rule silently stops applying, and no amount of getting the second one right prevents a third.
  const defs = [...CSS.matchAll(/^\.pw-toggle\s*\{/gm)];
  assert.equal(defs.length, 1, `${defs.length} .pw-toggle rules — the later one silently wins for every wrapper`);
});

test('it is centred in the field, and immune to the global button margin', () => {
  const rule = CSS.match(/^\.pw-toggle \{([\s\S]*?)\}/m)![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rule, /position:\s*absolute/, 'it sits inside the field, not after it');
  assert.match(rule, /top:\s*50%/, 'centred on the field');
  assert.match(rule, /translateY\(-50%\)/, 'and pulled back by its own half-height, or 50% is its TOP edge');

  // `button, .btn { margin-top: 1.5rem }` applies to this element. Without an explicit reset the toggle is
  // pushed a rem and a half down the page — which is most of what Jay was looking at.
  assert.match(rule, /margin:\s*0/, 'the global button margin must be reset here or the centring is undone');
});

test('both password wrappers still exist — this rule serves two surfaces, not one', () => {
  // If either of these disappears, the shared rule above becomes a single-surface rule and can safely be
  // scoped. Until then, changing it is changing both.
  assert.match(CSS, /\.pw-wrap \{/, 'the eye-toggle wrapper (app/password-field.tsx)');
  assert.match(CSS, /\.pw-field \{/, 'the Show/Hide wrapper (the onboarding gate)');
});
