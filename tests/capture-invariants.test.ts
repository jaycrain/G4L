import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRepeatedReplies,
  checkGapTidied,
  checkDoorsCaptured,
  checkReclaimDistilled,
  checkBounded,
  runCaptureInvariants,
  type WalkTurn,
} from '../lib/agent/capture-invariants.ts';

// The invariants must FLAG the exact shapes Donna/milie hit, and PASS a clean walk. This is the checked gate that the
// happy-path persona read didn't provide (Jay: "is the harness a happy path that always passes?").

const say = (role: 'agent' | 'member', text: string): WalkTurn => ({ role, text });

test('no-repeated-reply — catches the milie reclaim close loop (same beat fired 4×), passes a distinct walk', () => {
  const close = 'Got it — that’s a strong list to build from. Anything missing before we move on?';
  const looped: WalkTurn[] = [
    say('agent', close), say('member', 'No'),
    say('agent', 'You named a few things in “…”. Which one do you most want back? We’ll start there — the rest aren’t going anywhere.'),
    say('member', 'the mornings'),
    say('agent', close), say('member', 'No, let’s move on'),
    say('agent', close),
  ];
  assert.ok(checkRepeatedReplies(looped).length >= 1, 'the repeated close is flagged');

  const clean: WalkTurn[] = [
    say('agent', 'When did you feel most like yourself? Tell me about them.'), say('member', 'When I swam.'),
    say('agent', 'The water was where you were most yourself. What pulled you away from it?'), say('member', 'Life got loud.'),
    say('agent', 'A hundred reasonable trades. What do you want back first?'),
  ];
  assert.equal(checkRepeatedReplies(clean).length, 0, 'a distinct walk has no repeats');
});

test('gap-tidied — flags a raw run-on gap, passes clean prose', () => {
  assert.ok(checkGapTidied('i took a job in data entry.it is the opposite of being creative . my knee hurts').length >= 1);
  assert.equal(checkGapTidied('I took a job in data entry. It is the opposite of being creative. My knee hurts.').length, 0);
  assert.equal(checkGapTidied('').length, 0, 'no gap → nothing to flag');
});

test('doors-captured — flags a door-rich gap with zero Doors (milie), passes when captured or genuinely door-less', () => {
  const richGap = 'My father died. He had been a huge support. My knee hurts so I can’t run anymore and I throw my back out.';
  assert.ok(checkDoorsCaptured(richGap, []).length >= 1, 'door-rich gap, no doors → flagged');
  assert.equal(checkDoorsCaptured(richGap, ['loss', 'body']).length, 0, 'captured → passes');
  assert.equal(checkDoorsCaptured('I just want more energy and to see friends', []).length, 0, 'no door signal → nothing to flag');
});

test('reclaim-distilled — flags raw multi-sentence / verbose items (milie), passes clean wants', () => {
  const rawItems = [
    'Some time every week to create. Focus first on writing a story I started a long time ago about something that happened in my hometown.',
    'Change my eating and workout habits to lose 15 lbs and regain core strength so I can play with my kids again without hurting.',
  ];
  assert.ok(checkReclaimDistilled(rawItems).length >= 1, 'raw/verbose items are flagged');
  assert.equal(checkReclaimDistilled(['Open-water swimming', 'Own my mornings', 'The documentary']).length, 0, 'clean wants pass');
});

test('bounded — flags a runaway, passes a normal-length walk', () => {
  const many = Array.from({ length: 60 }, (_, i) => say('agent', `line ${i} unique enough words here to count as a turn`));
  assert.ok(checkBounded(many, 45).length >= 1);
  assert.equal(checkBounded(many.slice(0, 20), 45).length, 0);
});

test('runCaptureInvariants — a milie-shaped walk fails on multiple invariants; a clean walk holds', () => {
  const badWalk = {
    transcript: [say('agent', 'Got it — that’s a strong list. Anything missing?'), say('member', 'No'), say('agent', 'Got it — that’s a strong list. Anything missing?')],
    collected: {
      gap: 'i took a job.it did not feed my soul . my father died and my knee hurts',
      doors: [] as never[],
      reclaimList: ['Some time every week to create. Focus first on writing a story I started a long time ago in my hometown.'],
    },
  };
  const bad = runCaptureInvariants(badWalk);
  const kinds = new Set(bad.map((v) => v.invariant));
  assert.ok(kinds.has('no-repeated-reply'));
  assert.ok(kinds.has('gap-tidied'));
  assert.ok(kinds.has('doors-captured'));
  assert.ok(kinds.has('reclaim-distilled'));

  const goodWalk = {
    transcript: [say('agent', 'When did you feel most like yourself?'), say('member', 'Swimming.'), say('agent', 'What pulled you away?')],
    collected: {
      gap: 'My parents got sick as my marriage was falling apart. I made small trades until three years were gone. My father died.',
      doors: ['aging_parents', 'marriage', 'loss'] as never[],
      reclaimList: ['Open-water swimming', 'Own my mornings'],
    },
  };
  assert.deepEqual(runCaptureInvariants(goodWalk), [], 'a clean, complete walk holds');
});
