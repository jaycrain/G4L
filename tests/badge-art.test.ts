import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listBadges, getBadge, badgeTileBackground } from '../lib/curriculum/registry.ts';

// The ceremony reveal used to draw a hardcoded "◉" for every badge, so the moment meant to feel earned looked the
// same for all of them while the panel two taps away showed distinct art (Jay, 2026-08-11: "All the badges look the
// same in the mini-ceremony. Not like the actual in the panel."). The reveal now shares BadgeStamp — which only
// works while every badge HAS art to draw. These assert the conditions that fix depends on.
process.env.REDESIGN ??= 'staged'; // the badge set that actually ships

test('every badge has its own glyph — no two reveal identically', () => {
  const badges = listBadges();
  const icons = badges.map((b) => b.icon);
  assert.equal(new Set(icons).size, icons.length, `duplicate icons: ${icons.join(', ')}`);
});

test('every badge icon resolves to real art, so none falls back to the default', () => {
  // Read the glyph map as source: it is JSX, so it cannot be imported by the node test runner.
  const src = readFileSync('lib/curriculum/badge-glyphs.tsx', 'utf8');
  const defined = new Set([...src.matchAll(/^\s{2}([a-z][a-zA-Z0-9_]*):/gm)].map((m) => m[1]!));
  const missing = listBadges().filter((b) => !defined.has(b.icon));
  assert.deepEqual(missing.map((b) => `${b.id}:${b.icon}`), [], 'these would silently render the fallback glyph');
});

test('every badge id resolves — an unresolved id renders the generic medal', () => {
  const bad = listBadges().filter((b) => !getBadge(b.id));
  assert.deepEqual(bad.map((b) => b.id), []);
});

test('the ceremony badges carry distinct tiles as well as distinct glyphs', () => {
  const ceremony = ['reconnect-milestone', 'rewire-milestone', 'rebuild-milestone', 'reclaim-capstone']
    .map((id) => getBadge(id)).filter(Boolean);
  assert.equal(ceremony.length, 4, 'all four phase ceremony badges must exist');
  const tiles = ceremony.map((b) => badgeTileBackground(b!));
  assert.equal(new Set(tiles).size, tiles.length, `phase ceremonies share a tile colour: ${tiles.join(', ')}`);
});

// The root cause was THREE independent badge renderings that drifted apart. session-ceremony carried a private glyph
// map with four entries for sixteen badges, so twelve silently drew the flag. One renderer, or this comes back.
test('no surface keeps its own badge glyph or colour map', () => {
  for (const f of ['app/session/[memberId]/[sessionId]/session-ceremony.tsx', 'app/dashboard/badge-reveal.tsx']) {
    const src = readFileSync(f, 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/const GLYPH\s*[:=]/.test(code), `${f} defines a private glyph map — use BadgeStamp`);
    assert.ok(/BadgeStamp/.test(code), `${f} must render the shared BadgeStamp`);
  }
});
