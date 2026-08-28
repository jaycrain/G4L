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
const WRAP = CSS.match(/\.onbwel-wrap \{[\s\S]*?\}/)![0];

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

  // The base number inside the calc — the reserve is `calc(<base> + env(safe-area-inset-bottom))` now.
  const clear = Number(CSS.match(/--onbwel-foot-clear:\s*calc\((\d+)px/)![1]);
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

// A LAYOUT VARIABLE OVERRIDDEN IN A MEDIA QUERY MUST BE FOUND WHEN THE BASE ONE CHANGES.
//
// v3.5.2 "fixed" the oversized copy zone by changing :root — and mobile kept the old 380px, because a
// `@media (max-width: 1000px)` block overrode it. The result read correctly in a desktop browser AND on an iPad
// (both above the breakpoint) and wrongly on a phone, which is precisely the report that came back: "looks good
// in browser, on iPad, but not on the phone."
//
// Every override of an --onbwel-* variable is enumerated here. The point is not the numbers; it is that changing
// the base value forces a decision about each override rather than silently missing it.
test('every --onbwel- variable override is accounted for', () => {
  const overrides = [...CSS.matchAll(/--onbwel-([a-z-]+):\s*([^;]+);/g)].map((m) => `${m[1]}=${m[2].trim()}`);
  // gutter, measure, icon-h, copy-h, foot-clear at :root — plus copy-h once for mobile. A NEW entry here means
  // somebody added an override; read it and decide, do not just bump the count.
  assert.deepEqual(
    overrides,
    ['gutter=8vw', 'measure=640px', 'icon-h=90px', 'copy-h=232px',
     'foot-clear=calc(52px + env(safe-area-inset-bottom, 0px))',
     'copy-h=316px', 'icon-h=45px'],
    'an unexpected --onbwel- override — check whether the value it shadows was just changed without it',
  );
});

// The art is HALVED on mobile while the copy zone GROWS — the two mobile overrides move in opposite directions
// and both are correct. A narrow column wraps text to more lines (so the zone needs more room) and makes a
// fixed-height mark loom (so it needs less). Pinned together because "make it all smaller on mobile" is the
// plausible-sounding change that would break one of them.
test('the art is half height on mobile, while the copy zone is taller', () => {
  const icons = [...CSS.matchAll(/--onbwel-icon-h:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.equal(icons.length, 2, 'a base height and a mobile override');
  assert.equal(icons[1], Math.round(icons[0]! / 2), 'mobile is half the base — Jay, 2026-08-28');
});

test('the mobile copy zone is TALLER than desktop, because the copy wraps to more lines', () => {
  const all = [...CSS.matchAll(/--onbwel-copy-h:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.equal(all.length, 2, 'one base value and one mobile override');
  const [base, mobile] = all;
  // Measured at 393px: slide 4's body is 304px there against 221px at desktop. A mobile value SMALLER than the
  // base would mean somebody copied the desktop number across without re-measuring.
  assert.ok(mobile! > base!, `mobile (${mobile}px) must exceed desktop (${base}px) — narrow columns wrap taller`);
  assert.ok(mobile! >= 304, `must fit the tallest mobile slide (304px); got ${mobile}px`);
});

// THE LOG-IN LINE IS NOT DECORATION — "/" lands on this screen, so it is the only way through for someone who
// already has an account. It was pinned to the viewport edge at `bottom: clamp(20px, 4vh, 40px)`, which clears a
// one-line footer and is entirely swallowed by a wrapped one: at 393px the copyright runs to three lines and the
// fixed bar is 50px tall, so the whole line sat behind it.
//
// The same bug as the CTA, in the element directly beneath it. I reserved room for the button and left this one
// measured from the viewport instead — which is why both are keyed to the same variable now rather than to two
// hand-picked offsets that can drift apart.
test('the log-in line clears the footer by being IN THE FLOW, under the CTA', () => {
  // IT NO LONGER MEASURES ITSELF AGAINST ANYTHING. Three versions of this element were pinned a chosen distance
  // from the bottom of the viewport — `clamp(20px, 4vh, 40px)`, then the footer reserve, then the reserve plus
  // 18px — and each one cleared the footer and then collided with something else, because an element at a fixed
  // offset from the bottom will eventually meet an in-flow element that ended up there too. The last version
  // landed ON TOP OF THE BUTTON on a desktop.
  //
  // In flow it inherits .onbwel-wrap's padding-bottom, which already carries the footer reserve for the CTA —
  // so the clearance is the same fact, computed once, for both elements. There is no offset left to drift.
  const rule = CSS.match(/\.onbwel-d-signin \{[\s\S]*?\}/)![0].replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rule, /position:\s*absolute|bottom:/,
    'pinned to the bottom, it will collide with whatever the flow put there');
  assert.match(WRAP, /padding:[^;]*var\(--onbwel-foot-clear\)/,
    'and the reserve it now relies on must still be on the wrap that contains it');
});

// THE FOOTER RESERVE MUST KNOW ABOUT THE NOTCH.
//
// `body.onbwel-bleed .confidential-footer` pads its bottom with `calc(5px + env(safe-area-inset-bottom))` — so on
// a home-indicator iPhone the bar is ~34px taller than anywhere else. env() resolves to 0 in a headless browser,
// which is why six viewports all reported the log-in line clearing and Jay's actual phone still had it hidden.
// Every measurement I could take was blind to the one thing that mattered.
//
// The reserve includes the inset now. This is the only guard in the file that protects against a condition the
// test runner cannot reproduce, which is precisely why it is written as a rule about the CSS rather than a
// measurement of a render.
test('the footer reserve includes the safe-area inset the footer itself pads by', () => {
  const decl = CSS.match(/--onbwel-foot-clear:\s*([^;]+);/)![1];
  assert.match(decl, /env\(safe-area-inset-bottom/,
    'the bar grows by the inset, so the reserve must too — or the notch eats whatever sits above it');
});

// THE PHONE PROPORTIONS ARE KEYED TO THE COLUMN, NOT TO THE CHAT-TRACK BREAKPOINT.
//
// --onbwel-copy-h and --onbwel-icon-h lived in `@media (max-width: 1000px)` — the breakpoint that decides which
// CHAT SURFACE renders, which has nothing to do with how text wraps. The content column is capped at
// --onbwel-measure (640px), so above roughly 740px the copy wraps exactly as it does on a desktop.
//
// The cost of using the wrong one: an iPad on phone proportions. Measured at 820px the tallest slide's body is
// 221px — identical to desktop — against a zone sized 316px for a 393px phone. 95px of dead air, which is Jay's
// "it barely fits".
//
// The sibling guard above enumerates the VALUES and passed straight through this, because the values were right
// and the query was wrong. That is why this asserts the breakpoint.
test('phone-only proportions live below the column breakpoint, not the track breakpoint', () => {
  const block = CSS.match(/@media \(max-width: 740px\) \{[\s\S]*?\n\}/)![0];
  assert.match(block, /--onbwel-copy-h/, 'the copy zone is a wrapping concern');
  assert.match(block, /--onbwel-icon-h/, 'and so is a fixed-height mark in a narrow column');

  // And they must NOT also be set at the track breakpoint, which would shadow this one for 740–1000px.
  //
  // BOUNDED TO EACH BLOCK. The first version of this used `@media \(max-width: 1000px\)[\s\S]*?--onbwel-copy-h`,
  // which is non-greedy but not block-aware: it ran happily across a dozen unrelated rules to find the variable
  // in the 740px query below, and reported a violation that did not exist. A regex that can cross a closing
  // brace is not asking the question it looks like it is asking.
  for (const m of CSS.matchAll(/@media \(max-width: 1000px\) \{/g)) {
    const body = CSS.slice(m.index!, CSS.indexOf('\n}', m.index!));
    assert.doesNotMatch(body, /--onbwel-(copy-h|icon-h)/,
      'a second home for these puts tablets back on phone proportions');
  }
});

test('the phone overrides are positioned AFTER the :root they shadow', () => {
  // A media query does not outrank a later rule of the same specificity — position still decides. The first
  // attempt placed this block 1,300 lines above :root, so the defaults won and the phone silently kept desktop
  // proportions while every test still passed.
  assert.ok(
    CSS.indexOf('@media (max-width: 740px)') > CSS.indexOf('--onbwel-copy-h: 232px'),
    'the override must come after the default, or it does nothing',
  );
});
