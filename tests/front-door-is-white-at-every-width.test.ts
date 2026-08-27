// THE FRONT DOOR IS WHITE ON A PHONE TOO.
//
// Donna's Slide 1 redesign (v3.4.53) turned the opening hero white and recoloured its headline, body and sub-lead
// to NAVY for a white ground. It changed `.onbwel-d-hero` at the top level. A second copy of that background lived
// inside `@media (max-width: 1000px)` and nothing touched it — so every phone kept the old photo-and-dark-scrim
// hero with navy copy over it, close to unreadable, on the first screen a prospect ever sees. Found 2026-08-27 by
// looking at it in a browser at 375px; four days live and reviewed only on a desktop.
//
// The rule this pins: the hero's colour is decided ONCE. A media query may change padding and alignment; the day
// one reintroduces a background there, this fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** Every declaration block whose selector list mentions the given class. */
function blocksFor(selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(^|[,{}])\\s*([^{}]*${selector.replace('.', '\\.')}[^{}]*)\\{([^}]*)\\}`, 'g');
  for (const m of CSS.matchAll(re)) out.push(m[3]!);
  return out;
}

test('no .onbwel-d-hero rule paints a photo or a scrim — anywhere in the sheet', () => {
  const blocks = blocksFor('.onbwel-d-hero');
  assert.ok(blocks.length >= 2, 'expected a base rule and at least one responsive override to check');
  for (const b of blocks) {
    assert.doesNotMatch(b, /onboarding-hero\.jpg/, 'the front door must not paint the photo hero');
    assert.doesNotMatch(b, /linear-gradient|radial-gradient/, 'no scrim: the copy on this screen is navy on white');
  }
});

test('the hero declares white exactly once, at the top level', () => {
  const whites = blocksFor('.onbwel-d-hero').filter((b) => /background:\s*var\(--white\)/.test(b));
  assert.equal(whites.length, 1, 'one owner for the colour — a second copy is how this broke');
});

// The login hero is a DIFFERENT surface and deliberately still uses the photo. Asserted so a future sweep of
// "remove the photo hero" does not take it out by accident.
test('the login hero keeps its photo — it is not the same surface', () => {
  assert.match(CSS, /\.auth-hero\s*\{[^}]*onboarding-hero\.jpg/s);
});
