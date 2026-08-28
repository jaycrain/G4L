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

test('there is one headline scale, not two', () => {
  const heads = [...CSS.matchAll(/\.onbwel-head \{([^}]*)\}|\.onbwel-d-head \{([^}]*)\}/g)]
    .map((m) => (m[1] ?? m[2] ?? '').match(/font-size:\s*([^;]+)/)?.[1]?.trim())
    .filter(Boolean);
  assert.ok(heads.length >= 1, 'no headline rule found');
  assert.equal(new Set(heads).size, 1, `two headline scales produce two block heights: ${heads.join(' vs ')}`);
});

test('the icon sits in one fixed-height box on every slide', () => {
  const art = CSS.match(/\.onbwel-art \{([^}]*)\}/)?.[1] ?? '';
  assert.match(art, /height:\s*var\(--onbwel-icon-h\)/, 'fixed height — her pick over a fixed box');
  assert.match(art, /object-fit:\s*contain/, 'variable width, so a 3:1 mark and a square one carry equal weight');
  assert.doesNotMatch(CSS, /\.onbwel-art-(rings|progress)\s*\{/, 'per-slide icon sizes are what "vary wildly" meant');
});

test('the CTA lands at the same y — a fixed copy zone above it', () => {
  assert.match(CSS, /--onbwel-copy-h:/, 'the content zone needs a declared height');
  const copy = CSS.match(/\.onbwel-copy \{([^}]*)\}/)?.[1] ?? '';
  // min-height, NOT height: a phone that genuinely overflows must grow and scroll rather than clip the copy.
  assert.match(copy, /min-height:\s*var\(--onbwel-copy-h\)/);
  assert.doesNotMatch(copy, /[^-]height:\s*var\(--onbwel-copy-h\)/, 'a hard height would clip on a narrow screen');
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

test('the slide-1-only furniture is out of the vertical flow', () => {
  // The log-in line exists only on slide 1. In flow, it made slide 1's centered block taller than the others'
  // and pushed its headline and button off the grid by 4 and 9 pixels.
  const signin = CSS.match(/\.onbwel-d-signin \{([^}]*)\}/)?.[1] ?? '';
  assert.match(signin, /position:\s*absolute/, 'in flow, it moves the shared grid');
  assert.match(signin, /var\(--onbwel-gutter\)/, 'and it still sits on the shared left edge');
});

test("Donna's progress mark is the PNG she sent, not the old partial ring", () => {
  assert.match(TSX, /progress: '\/brand\/onboarding\/progress\.png'/);
});
