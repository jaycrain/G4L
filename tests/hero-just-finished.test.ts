import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroView } from '../lib/dashboard/hero-copy.ts';
import type { HeroState } from '../lib/dashboard/hero-copy.ts';

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

// REVERSED 2026-08-17 BY DONNA'S WALK, AND THESE TESTS FOLLOWED IT LATE.
//
// The original fix (above) put the FINISHED session in the headline and the next one in the subhead. Donna's
// review asked for the opposite — "this top banner should orient them toward what's ahead, not recap what they
// just did" — so the next session moved INTO the headline and the acknowledgment moved to the eyebrow. Both
// decisions solve Jay's "where am I?" problem; only one can be the copy, and the newer one ships.
//
// What is invariant across the reversal, and what these now assert: the member can always see what they just
// finished AND where they are going, on the same card, in different lines. That is the actual requirement. The
// tests had frozen one particular arrangement of it and failed the moment the arrangement changed.

test('the acknowledgment survives — the eyebrow still says what you just finished', () => {
  const v = heroView(finishedCheckpoint, ctx as never);
  assert.match(v.eyebrow, /You just finished/, 'orienting forward must not silently drop the credit for finishing');
});

test('the headline NAMES the next session, so the card points forward', () => {
  const v = heroView(finishedCheckpoint, ctx as never);
  assert.match(v.title, /Looking Forward/, 'the headline is where "what is ahead" now lives');
  assert.ok(v.copy !== v.title, 'headline and subhead must not say the same thing');
  assert.doesNotMatch(v.copy, /Rebuild Checkpoint/, 'and the subhead must not drag the card back to the past');
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
  assert.match(v.title, /Rebuild Checkpoint/, 'named in the headline now — see the reversal note above');
});

test('with nothing next, the card still refuses to invent a step', () => {
  const v = heroView({ kind: 'just-finished', session: { label: 'C4' }, next: null } as never, ctx as never);
  assert.equal(v.ctaLabel, 'Back to your path');
  assert.doesNotMatch(v.copy, /Next up/);
});

// ── THE SUBHEAD SAYS WHAT YOU JUST DID (Jay, 2026-08-25 — "fix it system wide") ───────────────────────────────
//
// He hit the same subhead twice in one walk: "Really, that's the copy?" and then "the subhead is wrong again."
// It read "If you want to keep going, click the button" — a sentence describing the control directly beneath it.
//
// The rule he set on 2026-08-08 is that this line names what the member last FINISHED, and lastAccomplishment
// was built for it. A just-finished exception was carved out later on the reasoning that the HEADLINE already
// said what they finished. That stopped being true when the headline moved to naming what is NEXT — so both
// lines pointed forward and the subhead had nothing left to say but filler.

test('no hero state describes the button instead of the member', () => {
  const states: HeroState[] = [
    { kind: 'just-finished', next: { label: 'Visualization Workshop', isCheckpoint: false } },
    { kind: 'just-finished', next: { label: 'Rewire Checkpoint', isCheckpoint: true } },
    { kind: 'just-finished', next: { label: 'Quality Days', isCheckpoint: false } },
    { kind: 'just-finished', next: null },
  ] as never;
  for (const st of states) {
    const v = heroView(st, { phaseLabel: 'Rewire', phaseOrdinal: 2 });
    assert.doesNotMatch(v.copy, /click the button/i, `subhead describes the control: "${v.copy}"`);
    // A subhead that narrates the affordance is the shape, not just that one phrase.
    assert.doesNotMatch(v.copy, /\bpress\b|\btap the\b/i, `subhead narrates the affordance: "${v.copy}"`);
  }
});
