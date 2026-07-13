import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_REGISTRY,
  CANVAS_FOR_TYPE,
  sessionById,
  sessionsForPhase,
  canvasSequence,
  allTypesUsed,
  PHASES,
  type SessionType,
} from '../lib/workspace/session-registry.ts';

// Redesign scaffold — the session-type registry is the crosswalk the workspace shell dispatches on. These lock the
// code-truth so a later "map vs restructure" edit can't silently drift from the engine.

const VALID: SessionType[] = ['A', 'B', 'C', 'D', 'E', 'F'];

test('registry · every session has valid ordered types + a canvas per segment', () => {
  assert.ok(SESSION_REGISTRY.length >= 13, 'all phases populated');
  for (const s of SESSION_REGISTRY) {
    assert.ok(s.id && s.label && s.segments.length > 0, `${s.id} well-formed`);
    for (const t of s.segments) assert.ok(VALID.includes(t), `${s.id}: ${t} is a valid type`);
    assert.equal(canvasSequence(s).length, s.segments.length, `${s.id}: one canvas per segment`);
  }
});

test('registry · every checkpoint is B→E (administered read → ceremony)', () => {
  for (const s of SESSION_REGISTRY.filter((x) => x.kind === 'checkpoint')) {
    assert.deepEqual(s.segments, ['B', 'E'], `${s.id} is B→E`);
  }
  // one checkpoint per non-Reconnect phase (Reconnect folds its checkpoint into the single arc)
  assert.equal(SESSION_REGISTRY.filter((x) => x.kind === 'checkpoint').length, 3);
});

test('registry · B1 is A+B (Jay 7/13 — draw-out why wraps the SDT instrument)', () => {
  assert.deepEqual(sessionById('b1')!.segments, ['A', 'B'], 'A first (conversation frames the measurement), then B');
});

test('registry · Type F (coach) is present in exactly the three coach sessions', () => {
  const coachSessions = SESSION_REGISTRY.filter((s) => s.segments.includes('F')).map((s) => s.id).sort();
  assert.deepEqual(coachSessions, ['b3', 'c1', 'c3'], 'coach mode = B3 pilot, C1 refine, C3 quality');
  assert.ok(allTypesUsed().includes('F'), 'F is a live type');
});

test('registry · all six types are exercised (the shell needs six canvas renderers)', () => {
  assert.deepEqual(allTypesUsed(), ['A', 'B', 'C', 'D', 'E', 'F']);
});

test('registry · canvas mapping is fixed per type', () => {
  assert.equal(CANVAS_FOR_TYPE.A, 'authored');
  assert.equal(CANVAS_FOR_TYPE.B, 'gauge');
  assert.equal(CANVAS_FOR_TYPE.C, 'log');
  assert.equal(CANVAS_FOR_TYPE.D, 'inferred');
  assert.equal(CANVAS_FOR_TYPE.E, 'reveal');
  assert.equal(CANVAS_FOR_TYPE.F, 'plan');
});

test('registry · Reconnect is one arc; the other phases are 3 sessions + a checkpoint', () => {
  assert.equal(sessionsForPhase('reconnect').length, 1, 'Reconnect = one continuous arc');
  for (const p of PHASES.filter((x) => x !== 'reconnect')) {
    const sessions = sessionsForPhase(p);
    assert.equal(sessions.filter((s) => s.kind === 'session').length, 3, `${p} has 3 sessions`);
    assert.equal(sessions.filter((s) => s.kind === 'checkpoint').length, 1, `${p} has 1 checkpoint`);
  }
});
