// RESUME MUST OWE THE MEMBER EXACTLY WHAT A LIVE TURN OWES THEM.
//
// Jay's charter walk, 2026-08-25. Reconnect's doors stage is designed to open "with the framing and the board
// TOGETHER — recognition before conversation, so the Companion draws out what she marked instead of fishing for
// it." He got the framing, stepped away, came back — and got a text box. Every arc's resume path recomputed the
// expectation by calling `scaleExpects` DIRECTLY, which is the fallback inside `nextExpects`, reached only after
// the structured branches decline. So resume could return scale chips and nothing else.
//
// THE COST WAS NOT A MISSING WIDGET. He typed "Got it" into the box; the model read that as a conversational turn
// and moved on to drawing out; the board then arrived a beat late, next to a question that assumed it had already
// happened — the Companion fishing for exactly what the board exists to prevent. A hidden surface desynchronises
// the stage.
//
// AND IT IS THE NORMAL PATH, not an edge case: Reconnect runs 65+ minutes, so a member stepping away and coming
// back is what members DO.
//
// WHY THIS FILE EXISTS AT ALL — the halves were both fine. `nextExpects` was correct, `scaleExpects` was correct,
// and nothing tested the SEAM between the saved state and the surface. Same shape as the infinite-loop bug from
// dead code earlier this month: propose and resolve both existed, both unit-tested, never wired together.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectsForState } from '../lib/agent/onboarding-staged.ts';
import { RECONNECT_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('resuming ON the doors stage still owes the member the board', () => {
  // Exactly Jay's state when he came back: doors stage, board not submitted, one Door carried from onboarding.
  const state = { stage: 'doors', collected: { doors: ['grind'] } } as unknown as ConvState;
  const ex = expectsForState(RECONNECT_ARC, state);

  assert.equal(ex?.kind, 'doors_board', 'resume dropped the Doors board — this is the walk bug, exactly');
});

test('once the board is submitted, resume does NOT offer it again', () => {
  // The other half of the branch. Re-offering a board she has already answered reads as not having listened, and
  // would reappear under every subsequent turn of the conversation.
  const state = { stage: 'doors', collected: { doors: ['grind'], boardDone: true } } as unknown as ConvState;
  assert.notEqual(expectsForState(RECONNECT_ARC, state)?.kind, 'doors_board');
});

test('a stage with no structured surface still resumes to nothing, not to a crash', () => {
  const state = { stage: 'entry', collected: {} } as unknown as ConvState;
  assert.equal(expectsForState(RECONNECT_ARC, state), undefined);
});

test('NO arc recomputes the resume expectation by itself', () => {
  // The boundary, enforced. All four arcs had this bug simultaneously because each one derived the expectation at
  // its own call site — four chances to reach for the fallback, and four that took it. A future arc must not get
  // a fifth. `scaleExpects` stays exported (the live paths inside the engine use it); what must never come back is
  // an ACTION recomputing a resumed member's surface from a bare stage id.
  for (const f of ['app/reconnect/actions.ts', 'app/rewire/actions.ts', 'app/rebuild/actions.ts', 'app/reclaim/actions.ts']) {
    assert.ok(
      !/scaleExpects\s*\(/.test(read(f)),
      `${f} computes a resumed member's surface itself — use expectsForState(arc, state), which sees the structured branches too`,
    );
    assert.match(read(f), /expectsForState\s*\(/, `${f} should resume through the one owner`);
  }
});
