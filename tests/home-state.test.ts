import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveHomeState, type HomeInputs } from '../lib/dashboard/home-state.ts';

const base: HomeInputs = {
  firstName: 'Joanne Marsh',
  phase: 'rewire',
  phaseLabel: 'Rewire',
  hero: { kind: 'fresh' },
  ctaHref: '/workspace/m1/w1',
  openOutreach: null,
  milestone: null,
  hourLocal: 9,
};

test('quiet is the light default — no CTA, no nag', () => {
  const s = resolveHomeState(base);
  assert.equal(s.kind, 'quiet');
  assert.equal(s.cta, null);
  assert.equal(s.tense, 'practice'); // rewire
});

test('checkpoint-ready → checkpoint state with the action pill', () => {
  const s = resolveHomeState({ ...base, hero: { kind: 'checkpoint-ready', checkpoint: { phase: 'rewire', label: 'The Rewire Checkpoint' } } });
  assert.equal(s.kind, 'checkpoint');
  assert.deepEqual(s.cta, { label: 'Begin the Checkpoint →', href: '/workspace/m1/w1' });
  assert.match(s.kicker!, /Checkpoint ready/);
});

test('resume → resume state with "Finish the session"', () => {
  const s = resolveHomeState({ ...base, hero: { kind: 'resume', session: { id: 'W1', label: 'The Disinformation Audit' } } });
  assert.equal(s.kind, 'resume');
  assert.match(s.cta!.label, /Finish the session/);
  assert.match(s.seed!, /kept/);
});

test('mid-week-practice → practice state with "Log today"', () => {
  const s = resolveHomeState({ ...base, hero: { kind: 'mid-week-practice', practice: { kind: 'b3_pilot', label: 'the pilot', day: 4, total: 7 } } });
  assert.equal(s.kind, 'practice');
  assert.match(s.cta!.label, /Log today/);
});

test('a ready outreach nudge seeds the reflective states (no pill; the open question is the open hand)', () => {
  const morning = resolveHomeState({ ...base, openOutreach: { trigger: 'morning_presence', message: 'You mentioned Tuesdays feel heavy — what’s here today?' } });
  assert.equal(morning.kind, 'morning');
  assert.equal(morning.cta, null);
  assert.equal(morning.seed, 'You mentioned Tuesdays feel heavy — what’s here today?');
  assert.match(morning.headline, /Good morning, Joanne\./); // firstName + hour

  assert.equal(resolveHomeState({ ...base, openOutreach: { trigger: 'pattern', message: 'x' } }).kind, 'noticed');
  assert.equal(resolveHomeState({ ...base, openOutreach: { trigger: 're_engagement', message: 'x' } }).kind, 'reengage');
});

test('milestone outranks everything and carries the badge + shelf pill', () => {
  const s = resolveHomeState({
    ...base,
    hero: { kind: 'checkpoint-ready', checkpoint: { phase: 'rewire', label: 'x' } }, // present but outranked
    openOutreach: { trigger: 'morning_presence', message: 'x' },
    milestone: { badgeName: 'True Line', href: '/badges/m1', badgeId: 'voice_turned' },
  });
  assert.equal(s.kind, 'milestone');
  assert.equal(s.badge, true);
  assert.deepEqual(s.cta, { label: 'See your badges →', href: '/badges/m1' });
  // one-shot: the badge_id rides through as the dismiss key so the FIRST engagement retires the celebration.
  assert.equal(s.dismissKey, 'voice_turned');
});

test('hero action states outrank a reflective nudge (a concrete next thing wins)', () => {
  const s = resolveHomeState({ ...base, hero: { kind: 'resume', session: { id: 'W1', label: 'x' } }, openOutreach: { trigger: 'morning_presence', message: 'x' } });
  assert.equal(s.kind, 'resume');
});

test('tense follows the phase; greeting follows the hour', () => {
  assert.equal(resolveHomeState({ ...base, phase: 'reconnect' }).tense, 'present');
  assert.equal(resolveHomeState({ ...base, phase: 'reclaim' }).tense, 'reclaim');
  const pm = resolveHomeState({ ...base, hourLocal: 15, openOutreach: { trigger: 'morning_presence', message: 'x' } });
  assert.match(pm.headline, /Good afternoon/);
  const eve = resolveHomeState({ ...base, hourLocal: 20, openOutreach: { trigger: 'morning_presence', message: 'x' } });
  assert.match(eve.headline, /Good evening/);
});
