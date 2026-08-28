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

// THE CTA MUST NEVER BE UNREACHABLE — the fault this file's sibling guard was written for, one layer along.
//
// Jay hit it on a phone AND a MacBook Air within a minute of each other (2026-08-28): "Start looking" greyed out
// behind the copyright line. Two causes, one root — the content exceeded the viewport, so the PAGE scrolled, and
// `body.onbwel-bleed .confidential-footer` is position:fixed at z-index 40 with a translucent white ground. It
// sits over whatever is at the bottom.
//
// The old slide-1 container had `max-height: 100dvh; overflow-y: auto` with a comment calling it load-bearing —
// "a hard clip once made the CTA physically unreachable" — and unifying the shell on 8/28 dropped it. This is the
// third time that behaviour has had to be re-learned, so it is asserted rather than commented.
test('the welcome shell scrolls itself, and reserves room for the fixed footer', () => {
  const shell = CSS.match(/^\.onbwel \{[^}]*\}/m)![0];
  assert.match(shell, /max-height:\s*100dvh/, 'one screen when it fits');
  assert.match(shell, /overflow-y:\s*auto/,
    'and scrolls when it cannot — a hard clip is what makes the CTA unreachable');

  const wrap = CSS.match(/\.onbwel-wrap \{[\s\S]*?\}/)![0];
  assert.match(wrap, /--onbwel-foot-clear/,
    'the bottom padding must reserve the fixed footer, or the CTA lands underneath it');

  const clear = Number(CSS.match(/--onbwel-foot-clear:\s*(\d+)px/)![1]);
  assert.ok(clear >= 44, `the footer is ~2 lines plus padding; ${clear}px is not enough clearance`);
});

test('the copy zone is sized to real content, not a round number', () => {
  // 300px was a guess and left 79px of dead air on the TALLEST slide — "the CTA is too low. Plenty of white space
  // to repurpose" (Jay). Measured: slide 4's body is 221px at desktop. The fixed-CTA promise Donna asked for
  // survives; the slack does not.
  const h = Number(CSS.match(/--onbwel-copy-h:\s*(\d+)px/)![1]);
  assert.ok(h >= 221, `must fit the tallest slide's content (221px); got ${h}px`);
  assert.ok(h <= 260, `${h}px reintroduces the dead space the measurement removed`);
});
