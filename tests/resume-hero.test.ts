import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeroState, type HeroSignals } from '../lib/dashboard/resume-hero.ts';

// Redesign scaffold — the resume-hero priority machine. Exactly one state, deterministic, most-actionable first.
const base: HeroSignals = { hasStarted: false };

test('hero · fresh member → fresh', () => {
  assert.equal(resolveHeroState(base).kind, 'fresh');
  // hasStarted but no next → still fresh-ish (nothing to point at)
  assert.equal(resolveHeroState({ hasStarted: true }).kind, 'fresh');
});

test('hero · a lit next step → next-step', () => {
  const st = resolveHeroState({ hasStarted: true, nextSession: { id: 'w2', label: 'Visualization Workshop' } });
  assert.equal(st.kind, 'next-step');
  assert.equal(st.kind === 'next-step' && st.session.id, 'w2');
});

test('hero · an active practice week → mid-week-practice', () => {
  const st = resolveHeroState({ hasStarted: true, nextSession: { id: 'w3', label: 'x' }, activePractice: { kind: 'b3_pilot', label: 'your pilot', day: 3, total: 7 } });
  assert.equal(st.kind, 'mid-week-practice');
});

test('hero · a ready checkpoint outranks practice + next-step', () => {
  const st = resolveHeroState({
    hasStarted: true,
    nextSession: { id: 'x', label: 'x' },
    activePractice: { kind: 'b2_noticing', label: 'x', day: 2, total: 7 },
    checkpointReady: { phase: 'rewire', label: 'Rewire Checkpoint' },
  });
  assert.equal(st.kind, 'checkpoint-ready');
});

test('hero · just-finished outranks checkpoint/practice and carries the next step', () => {
  const st = resolveHeroState({
    hasStarted: true,
    justFinishedSession: { id: 'w1', label: 'Disinformation Audit' },
    checkpointReady: { phase: 'rewire', label: 'Rewire Checkpoint' },
    nextSession: { id: 'w2', label: 'Visualization Workshop' },
  });
  assert.equal(st.kind, 'just-finished');
  assert.equal(st.kind === 'just-finished' && st.next?.id, 'w2');
});

test('hero · an in-progress session wins over everything (finish what you started)', () => {
  const st = resolveHeroState({
    hasStarted: true,
    inProgressSession: { id: 'c1', label: 'Readiness Assessment' },
    justFinishedSession: { id: 'w1', label: 'x' },
    checkpointReady: { phase: 'reclaim', label: 'x' },
    activePractice: { kind: 'c3_quality', label: 'x', day: 1, total: 7 },
  });
  assert.equal(st.kind, 'resume');
  assert.equal(st.kind === 'resume' && st.session.id, 'c1');
});
