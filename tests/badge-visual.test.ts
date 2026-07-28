import { test } from 'node:test';
import assert from 'node:assert/strict';

// The Decision WW styling pass: badges color by PHASE (the ring palette), not category, so the shelf reads as a
// map of the journey. This proves the phase mapping, the two Journey/bullseye overrides, and that every badge's
// placeholder glyph is a real, distinct-within-phase icon key (so Scott can swap art by id without collisions).
process.env.REDESIGN = 'staged'; // expose the 16-milestone REDESIGN_BADGES from the registry

const { listBadges, badgePhase, badgeTileBackground, PHASE_BADGE_COLOR } = await import(
  '../lib/curriculum/registry.ts'
);
const { BADGE_GLYPH_KEYS } = await import('../lib/curriculum/badge-glyph-keys.ts');

const EXPECTED_PHASE: Record<string, string> = {
  'named-yourself': 'reconnect',
  'starting-line': 'reconnect',
  'reconnect-milestone': 'reconnect',
  'turned-voice': 'rewire',
  'built-picture': 'rewire',
  'caught-real-time': 'rewire',
  'rewire-milestone': 'rewire',
  'found-why': 'rebuild',
  'honest-read': 'rebuild',
  'week-noticing': 'rebuild',
  'rebuild-milestone': 'rebuild',
  'goal-reclaimed': 'journey', // "kept a want" — cross-cutting
  'widened-world': 'reclaim',
  'quality-days': 'reclaim',
  'wrote-story': 'reclaim',
  'reclaim-capstone': 'journey', // "closed the loop" — cross-cutting
};

test('the redesign set is the full 16', () => {
  assert.equal(listBadges().length, 16);
});

test('every badge maps to its expected phase (Journey overrides included)', () => {
  for (const b of listBadges()) {
    assert.equal(badgePhase(b), EXPECTED_PHASE[b.id], `${b.id} phase`);
  }
});

test('the group counts match the handoff: 3 orange / 4 olive / 4 teal / 3 navy / 2 bullseye', () => {
  const tally: Record<string, number> = {};
  for (const b of listBadges()) tally[badgePhase(b)] = (tally[badgePhase(b)] ?? 0) + 1;
  assert.deepEqual(tally, { reconnect: 3, rewire: 4, rebuild: 4, reclaim: 3, journey: 2 });
});

test('tile background is the phase color, or white for the "Your Comeback" (Journey) badges', () => {
  for (const b of listBadges()) {
    const bg = badgeTileBackground(b);
    if (badgePhase(b) === 'journey') assert.equal(bg, '#ffffff');
    else assert.equal(bg, PHASE_BADGE_COLOR[badgePhase(b) as keyof typeof PHASE_BADGE_COLOR]);
  }
});

test('every badge icon is a real glyph key (Scott can swap art by id)', () => {
  const keys = new Set(BADGE_GLYPH_KEYS as readonly string[]);
  for (const b of listBadges()) assert.ok(keys.has(b.icon), `${b.id} icon "${b.icon}" is a known glyph`);
});

test('icons are distinct WITHIN each phase (no two collide on the same-colored tile)', () => {
  const seen: Record<string, Set<string>> = {};
  for (const b of listBadges()) {
    const p = badgePhase(b);
    (seen[p] ??= new Set());
    assert.ok(!seen[p].has(b.icon), `duplicate glyph "${b.icon}" within phase ${p}`);
    seen[p].add(b.icon);
  }
});
