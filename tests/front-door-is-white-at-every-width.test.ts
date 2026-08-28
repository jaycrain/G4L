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

// RETIRED WITH THE VARIABLE IT GUARDED. This asserted that --onbwel-copy-h was an odd, measured number rather
// than a round guess — a good rule for a value that had to equal the tallest slide's real height. The value no
// longer exists: the zone flexes and the button anchors, so there is nothing left to measure and nothing left to
// round. The invariant that replaced it is 'the copy zone flexes and the wrap anchors' below.
//
// The one surviving number of this kind is the footer reserve, which is checked by its own test further down.

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
  // --onbwel-copy-h IS GONE. It was a hand-measured height for the tallest slide, one per breakpoint, and it was
  // wrong at every breakpoint it ever had; the copy zone flexes now and the button is anchored to the bottom
  // instead. What remains is the icon box, which is a genuine per-size design choice, in four bands:
  //   90px base · 45px phone · 72px laptop (801–900 tall) · 24px short phone · 56px short laptop (≤800 tall)
  // A NEW entry here means somebody added an override; read it and decide, do not just bump the count.
  assert.deepEqual(
    overrides,
    ['gutter=8vw', 'measure=640px', 'icon-h=90px',
     'foot-clear=calc(52px + env(safe-area-inset-bottom, 0px))',
     'icon-h=45px', 'icon-h=72px', 'icon-h=24px', 'icon-h=56px'],
    'an unexpected --onbwel- override — check whether the value it shadows was just changed without it',
  );
});

// The art is HALVED on mobile while the copy zone GROWS — the two mobile overrides move in opposite directions
// and both are correct. A narrow column wraps text to more lines (so the zone needs more room) and makes a
// fixed-height mark loom (so it needs less). Pinned together because "make it all smaller on mobile" is the
// plausible-sounding change that would break one of them.
test('the art is half height on mobile, and smaller again when the screen is short', () => {
  const icons = [...CSS.matchAll(/--onbwel-icon-h:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.equal(icons.length, 5, 'base, phone, laptop band, short phone, short laptop');
  const [base, phone] = icons;
  // A narrow column makes a fixed-height mark loom — 90px reads fine against a wide column and dominates a
  // 393px one. This halving is Jay's, 2026-08-28.
  assert.equal(phone, Math.round(base! / 2), 'the phone override is half the base');
  // Every other band exists to buy vertical room on a screen too short to hold the tallest slide, so each one
  // must be SMALLER than the size it shadows. A band that grew the icon would be spending the height it was
  // added to save.
  for (const v of icons.slice(2)) assert.ok(v < base!, `a short-screen band must not exceed the base (${v}px)`);
});

// THE BUTTON'S POSITION IS A PROPERTY OF THE VIEWPORT, NOT OF THE COPY.
//
// This replaces "the mobile copy zone is TALLER than desktop", which policed the two hand-measured heights that
// used to hold the button still. Both were wrong in the end — slide 4 needed 243px against desktop's 232 and
// 326px against the phone's 316 — so on every device four screens agreed and the fifth sat 5px off, art and
// headline drifting up as the button drifted down, because the block was centred and its height moved with it.
//
// Anchored, there is no number to get wrong: the top group sits at the top, the button sits at the bottom, and
// the copy zone is whatever is left. Measured across all five slides after the change: 507 at 375x667, 630 at
// 393x852, 710 at 430x932, 802 at 768x1024, 958 at 820x1180, 1144 at 1024x1366, 530 at 1280x720, 610 at
// 1440x820, 690 at 1440x900 — one value per viewport, five slides each.
test('the copy zone flexes and the wrap anchors — nothing measures the tallest slide any more', () => {
  // COMMENTS STRIPPED. The rule that replaced it explains what it replaced BY NAME, and the first version of
   // this assertion failed on that explanation — the second time in this file a guard has punished writing the
   // reason down. Assert against declarations, never against prose.
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /--onbwel-copy-h/,
    'a fixed copy height is the mechanism that moved the button; it does not come back');

  const copy = CSS.match(/\.onbwel-copy \{([^}]*)\}/)?.[1] ?? '';
  assert.match(copy, /flex:\s*1 0 auto/,
    'grow into the slack, never shrink below the copy — shrinking clips the last lines instead of scrolling');

  const wrap = CSS.match(/\.onbwel-wrap \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(wrap, /flex-direction:\s*column/, 'the wrap is the column the anchoring depends on');
  assert.match(wrap, /min-height:\s*100dvh/, 'and it must fill the screen, or there is no slack to absorb');

  // Slides 2–5 nest everything inside .onbwel-heart, so the column has to pass through it or only slide 1
  // anchors — which would be the same bug, visible on four screens out of five.
  const heart = CSS.match(/\.onbwel-heart \{([^}]*)\}/)?.[1] ?? '';
  assert.match(heart, /flex:\s*1 1 auto/, '.onbwel-heart must carry the column into slides 2-5');
  assert.match(heart, /min-height:\s*0/, 'so a screen too short hands its overflow to the shell scroll');
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
  assert.match(block, /--onbwel-icon-h/, 'a fixed-height mark in a narrow column is a wrapping concern');

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
