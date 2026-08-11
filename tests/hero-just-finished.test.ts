import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroView } from '../lib/dashboard/hero-copy.ts';

// Jay got lost in his own program TWICE — he told me he was in Reclaim while sitting in the Rebuild Checkpoint.
// The card said "Nice work — Rebuild Checkpoint" as the headline AND "You finished Rebuild Checkpoint today" as the
// subhead: two lines about the past, nothing naming what came next, and a button reading "Start the next Session"
// that named nothing either. If the person who designed the program can't tell where he is, a member cannot.
const ctx = { phaseLabel: 'Rebuild', phaseOrdinal: 3, sessionPosition: '1 of 3' };
const finishedCheckpoint = {
  kind: 'just-finished' as const,
  session: { label: 'Rebuild Checkpoint' },
  next: { label: 'Looking Forward', isCheckpoint: false },
} as never;

test('the just-finished headline names what you FINISHED', () => {
  const v = heroView(finishedCheckpoint, ctx as never);
  assert.match(v.title, /Rebuild Checkpoint/);
});

test('...and its forward line NAMES the next session, so the subhead can carry it', () => {
  const v = heroView(finishedCheckpoint, ctx as never);
  assert.match(v.copy, /Looking Forward/, 'the subhead must say where you are going, not repeat the headline');
  assert.ok(v.copy !== v.title, 'headline and subhead must not say the same thing');
});

test('the CTA does not say "next" — the subhead above already named the session', () => {
  const v = heroView(finishedCheckpoint, ctx as never);
  assert.equal(v.ctaLabel, 'Start the Session');
});

test('a checkpoint ahead still gets its own verb, since "Session" would be wrong', () => {
  const v = heroView(
    { kind: 'just-finished', session: { label: 'B3' }, next: { label: 'Rebuild Checkpoint', isCheckpoint: true } } as never,
    ctx as never,
  );
  assert.equal(v.ctaLabel, 'Take the Checkpoint');
  assert.match(v.copy, /Rebuild Checkpoint/);
});

test('with nothing next, the card still refuses to invent a step', () => {
  const v = heroView({ kind: 'just-finished', session: { label: 'C4' }, next: null } as never, ctx as never);
  assert.equal(v.ctaLabel, 'Back to your path');
  assert.doesNotMatch(v.copy, /Next up/);
});
