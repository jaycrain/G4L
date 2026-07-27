import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroView } from '../lib/dashboard/hero-copy.ts';

// Redesign Layer 2 (D-02): heroView turns a resolved HeroState into member-facing hero text. Pure — asserts each state
// produces the right shape, uses the member's real position, and never fabricates beyond what the state carries.

const ctx = { phaseLabel: 'Rewire', phaseOrdinal: 2, sessionPosition: 'Session 2 of 3' };

test('resume — names the session, offers to pick up where you left off', () => {
  const v = heroView({ kind: 'resume', session: { id: 'w2', label: 'Visualization Workshop' } }, ctx);
  assert.equal(v.title, 'Visualization Workshop');
  assert.match(v.eyebrow, /Phase 2 · Rewire · Session 2 of 3/);
  assert.equal(v.ctaLabel, 'Resume this Session');
});

test('just-finished — congratulates, NAMES the next session', () => {
  const v = heroView(
    { kind: 'just-finished', session: { id: 'w1', label: 'the Disinformation Audit' }, next: { id: 'w2', label: 'Visualization Workshop', isCheckpoint: false } },
    ctx,
  );
  assert.match(v.title, /Nice work — the Disinformation Audit/);
  assert.match(v.copy, /Visualization Workshop is next/);
  assert.equal(v.ctaLabel, 'Start the next Session');
});

test('just-finished — after the LAST session, names + routes to the Checkpoint (no dead end)', () => {
  const v = heroView(
    { kind: 'just-finished', session: { id: 'w3', label: 'The False Start Protocol' }, next: { id: 'rewire', label: 'The Rewire Checkpoint', isCheckpoint: true } },
    ctx,
  );
  assert.match(v.copy, /Next up: The Rewire Checkpoint/);
  assert.equal(v.ctaLabel, 'Take the Checkpoint');
});

test('just-finished with no next — no fabricated next step', () => {
  const v = heroView({ kind: 'just-finished', session: { id: 'c4', label: 'the Transition' }, next: null }, ctx);
  assert.doesNotMatch(v.copy, /next Session|Next up/);
  assert.equal(v.ctaLabel, 'Back to your path');
});

test('checkpoint-ready — the Grinta-moves framing, phase-named', () => {
  const v = heroView({ kind: 'checkpoint-ready', checkpoint: { phase: 'rewire', label: 'Rewire Checkpoint' } }, ctx);
  assert.match(v.title, /You did it/);
  assert.match(v.eyebrow, /Checkpoint ready/);
  assert.match(v.copy, /walked the whole phase/); // Donna edit: celebratory + phase framing
  assert.equal(v.ctaLabel, 'Take the Checkpoint');
});

// Donna's hand-off + checkpoint copy is REWIRE-ONLY (Jay: "Rewire is different"). Every other phase keeps the generic
// copy — these guard that split so it can't silently regress.
const rebuildCtx = { phaseLabel: 'Rebuild', phaseOrdinal: 3, sessionPosition: 'Session 1 of 3' };

test('just-finished (non-Rewire) — keeps the generic "Next up" hand-off, not Donna\'s Rewire copy', () => {
  const v = heroView(
    { kind: 'just-finished', session: { id: 'b1', label: 'What Is Your Why?' }, next: { id: 'b2', label: 'Your Strengths', isCheckpoint: false } },
    rebuildCtx,
  );
  assert.match(v.copy, /Next up: Your Strengths/);
  assert.doesNotMatch(v.copy, /some hard work/);
});

test('checkpoint-ready (non-Rewire) — keeps the generic Grinta-moves framing, phase-named', () => {
  const v = heroView({ kind: 'checkpoint-ready', checkpoint: { phase: 'rebuild', label: 'Rebuild Checkpoint' } }, rebuildCtx);
  assert.match(v.title, /Your Rebuild Checkpoint/);
  assert.match(v.copy, /no studying, just an honest read/);
  assert.doesNotMatch(v.copy, /You did it|uptick/);
});

test('mid-week-practice — day N of total, log-today CTA', () => {
  const v = heroView({ kind: 'mid-week-practice', practice: { kind: 'w3_logging', label: 'Log your calls', day: 3, total: 7 } }, ctx);
  assert.match(v.eyebrow, /Day 3 of 7/);
  assert.equal(v.title, 'Log your calls');
  assert.equal(v.ctaLabel, 'Log today with me');
});

test('next-step — the lit session, no-rush framing', () => {
  const v = heroView({ kind: 'next-step', session: { id: 'w2', label: 'Visualization Workshop' } }, ctx);
  assert.equal(v.title, 'Visualization Workshop');
  assert.equal(v.ctaLabel, 'Open this Session');
});

test('fresh — the front door into Reconnect', () => {
  const v = heroView({ kind: 'fresh' }, ctx);
  assert.equal(v.title, 'Reconnect');
  assert.match(v.copy, /where it starts/);
  assert.equal(v.ctaLabel, 'Begin');
});
