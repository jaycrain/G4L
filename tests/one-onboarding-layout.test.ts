// ONE LAYOUT FOR THE FIVE INTRO SCREENS (Donna's alignment spec, 2026-08-27).
//
// Slide 1 was one component and slides 2–5 were another. They had different left margins (8vw vs centered),
// different container padding, and different headline size clamps — so content "jumped left/right when swiping
// through", by ~246px horizontally at 1280 and a few pixels vertically. Her instruction was explicit: build ONE
// shared layout component and have every slide use it, not nudge them into visual agreement.
//
// A geometry test would be the ideal guard, but it needs a browser and the intro sits in front of a sign-up gate.
// So this pins the STRUCTURE instead — the specific things that, when they diverged, produced the misalignment.
// Every assertion here is something that was actually wrong on 2026-08-27.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const TSX = readFileSync(new URL('../app/onboarding/welcome.tsx', import.meta.url), 'utf8');

test('every slide renders through the same shell', () => {
  // Slide 1 used .onbwel-d-hero / .onbwel-d-heart; the beats used .onbwel / .onbwel-wrap.
  assert.match(TSX, /className="onbwel onbwel-first"/, 'slide 1 must use the shared container');
  assert.equal(
    (TSX.match(/className="onbwel-wrap"/g) ?? []).length, 2,
    'both components should render the shared wrap — slide 1 and the beats',
  );
  assert.doesNotMatch(TSX, /onbwel-d-hero|onbwel-d-heart/, 'the slide-1-only container is retired');
});

test('the left margin has ONE definition and every slide reads it', () => {
  assert.match(CSS, /--onbwel-gutter:/, 'the gutter must be a variable, not repeated per component');
  // The wrap must not be centered — `margin: 0 auto` is precisely what pushed slides 2–5 right of slide 1.
  const wrap = CSS.match(/\.onbwel-wrap \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(wrap.length, '.onbwel-wrap not found');
  assert.doesNotMatch(wrap, /margin:\s*0 auto/, 'centering the wrap is the original misalignment');
  assert.match(wrap, /var\(--onbwel-gutter\)/, 'the wrap must start at the shared gutter');
});

test('there is one headline scale per screen size — never one per slide', () => {
  // WHAT THIS GUARDS IS SLIDE 1, not responsiveness. Slide 1 used to be its own container with its own headline
  // scale (.onbwel-d-head), which is why its block measured differently from slides 2-5 and sat a few pixels
  // off the shared grid. Two scales at the SAME width is the bug.
  //
  // A step-down inside a media query is a different thing entirely and is allowed: the short-phone band drops
  // the headline to 32px to buy the vertical room that keeps all five buttons on the same line at 375x667.
  // The first version of this test could not tell those apart and failed on the responsive step, which would
  // have argued for deleting a fix that was working.
  const topLevel = CSS.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const heads = [...topLevel.matchAll(/\.onbwel-head \{([^}]*)\}|\.onbwel-d-head \{([^}]*)\}/g)]
    .map((m) => (m[1] ?? m[2] ?? '').match(/font-size:\s*([^;]+)/)?.[1]?.trim())
    .filter(Boolean);
  assert.ok(heads.length >= 1, 'no headline rule found');
  assert.equal(new Set(heads).size, 1, `two headline scales produce two block heights: ${heads.join(' vs ')}`);
  assert.doesNotMatch(CSS, /\.onbwel-d-head \{/, 'a slide-1-only headline scale is the original misalignment');
});

test('the icon sits in one fixed-height box on every slide', () => {
  const art = CSS.match(/\.onbwel-art \{([^}]*)\}/)?.[1] ?? '';
  assert.match(art, /height:\s*var\(--onbwel-icon-h\)/, 'fixed height — her pick over a fixed box');
  assert.match(art, /object-fit:\s*contain/, 'variable width, so a 3:1 mark and a square one carry equal weight');
  assert.doesNotMatch(CSS, /\.onbwel-art-(rings|progress)\s*\{/, 'per-slide icon sizes are what "vary wildly" meant');
});

test('the CTA lands at the same y — floated on a MEASURED zone, with three guards on the measurement', () => {
  // REVERSED AGAIN, 2026-08-30, and the history matters because this test recorded exactly why the measured zone
  // failed the first time: "that zone had to equal the tallest slide's height at every breakpoint, it never did,
  // and the slide that exceeded it moved the whole centred block."
  //
  // Every clause of that is now addressed:
  //   1. IT NEVER DID EQUAL THE TALLEST SLIDE — because nobody checked. scripts/check-welcome-fit.mjs renders all
  //      five slides at the worst width in each band and fails on overflow. It caught a wrong band edge on its
  //      first run (286px of content in a 262px box at 561), before that edge ever shipped.
  //   2. THE SLIDE THAT EXCEEDED IT MOVED THE BLOCK — it cannot now: the zone scrolls internally.
  //   3. THE CENTRED BLOCK — is gone. The column is top-anchored, so nothing above the button moves.
  //
  // And what sent us back: anchoring needs no measurement, but it ties the button to the WINDOW rather than the
  // content — 20px of gap at 1280x800 and 220px at 600x900 on identical CSS. Donna reported that three times.
  const copy = CSS.match(/\.onbwel-copy \{([^}]*)\}/)?.[1] ?? '';
  assert.match(copy, /height:\s*var\(--onbwel-copy-h\)/, 'one shared, measured height');
  assert.match(copy, /flex:\s*0 0 auto/, 'it must not absorb slack, or the button returns to the bottom');
  assert.match(copy, /overflow-y:\s*auto/, 'guard 2 — an over-long slide scrolls instead of moving the button');
  assert.match(CSS, /check-welcome-fit\.mjs/, 'guard 1 — the CSS names the check that keeps the number honest');

  const shell = CSS.match(/\.onbwel \{([^}]*)\}/)?.[1] ?? '';
  assert.match(shell, /overflow-y:\s*auto/, 'a screen too short must scroll rather than clip');
  const wrap = CSS.match(/\.onbwel-wrap \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.doesNotMatch(wrap, /justify-content:\s*center/, 'guard 3 — centring is what turned overflow into movement');
});

test('slide 1 shows no dots but reserves their space', () => {
  // Donna: "No dots on first slide." Reserving the height is what keeps that a design choice rather than a
  // 38px offset that knocks slide 1's headline off the shared grid.
  assert.match(TSX, /onbwel-dots-spacer/, 'slide 1 must reserve the dots height');
  const spacer = CSS.match(/\.onbwel-dots-spacer \{([^}]*)\}/)?.[1] ?? '';
  // The height to match is the DOT's — .onbwel-dots is a flex row and sets none of its own.
  const dots = CSS.match(/\.onbwel-dot \{([^}]*)\}/)?.[1] ?? '';
  const dotsRow = CSS.match(/\.onbwel-dots \{([^}]*)\}/)?.[1] ?? '';
  const h = (b: string) => b.match(/height:\s*([\d]+px)/)?.[1];
  const mb = (b: string) => b.match(/margin-bottom:\s*([\d]+px)/)?.[1];
  assert.equal(h(spacer), h(dots), 'the spacer must be exactly as tall as the dots it stands in for');
  assert.equal(mb(spacer), mb(dotsRow), 'and carry the same margin');
});

test('the log-in line and the spacer that stands in for it are the same box', () => {
  // The log-in line exists only on slide 1, so in flow it makes slide 1's centered block taller than the others
  // and pushes its headline and button off the shared grid.
  //
  // THE OLD ANSWER WAS TO TAKE IT OUT OF FLOW, and that is what this test used to assert. It bought three
  // collisions — behind a one-line footer, behind a wrapped one, and finally on top of the button — because an
  // element pinned a fixed distance from the bottom cannot know where the flow put the CTA.
  //
  // The answer now is the same one the dots already use: keep it in flow and reserve its height on the slides
  // that do not show it. That is what these two rules have to agree about, forever.
  const signin = CSS.match(/\.onbwel-d-signin \{([^}]*)\}/)?.[1] ?? '';
  const spacer = CSS.match(/\.onbwel-signin-spacer \{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(signin, /position:\s*absolute/, 'out of flow, it collides with what the flow put there');

  const px = (b: string, prop: string) => b.match(new RegExp(prop + ':\\s*(-?[\\d.]+px)'))?.[1];
  // .onbwel-d-signin's `margin: 14px 0 0` and the spacer's `margin-top: 14px` are the same top margin written
  // two ways, so compare the resolved value rather than the shorthand.
  const signinTop = px(signin, 'margin-top') ?? signin.match(/margin:\s*([\d.]+px)/)?.[1];
  assert.equal(px(spacer, 'margin-top'), signinTop, 'the spacer must carry the same top margin');
  assert.equal(px(spacer, 'height'), '21px',
    "and stand exactly as tall as one line of the log-in text — if that rule's font-size or line-height " +
    'changes, this number is what has to change with it');
});

test("Donna's progress mark is the PNG she sent, not the old partial ring", () => {
  assert.match(TSX, /progress: '\/brand\/onboarding\/progress\.png'/);
});
