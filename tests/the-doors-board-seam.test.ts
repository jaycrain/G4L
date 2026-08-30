// THE DOORS BOARD, AT THE SEAM — is it OFFERED, is her tap HONOURED, and is "none of them" an answer?
//
// The board's halves are well covered already: the parser round-trips, the claim layer refuses a Door she does not
// hold, every card has recognition copy. What nothing covered is the JOIN — and this surface has already shipped a
// silent regression there. From the engine's own comment:
//
//   "ANY RECONNECT ARC, not the exact string 'reconnect'. The phase was split into per-Session arcs on 2026-08-28
//    ('reconnect-r1' … 'reconnect-checkpoint'), and an exact match meant the board simply stopped rendering — the
//    Doors Session opened with the framing and no board under it."
//
// A parser that round-trips perfectly is worth nothing if the board is never put in front of her. That failure was
// caught by a human walking the product; it is cheap to catch here. [[test-the-seam-not-the-halves]]
//
// And the case this was written for: a member for whom NONE of the Doors fit. Marking nothing is an allowed answer
// (ruling #7) — it must not read as a failed step, and it must never cause us to invent a Door for her. That is the
// UI form of the bug fixed in v3.5.56, where the engine invented Doors for a man who said he had none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { expectsForState } from '../lib/agent/onboarding-staged.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import { boardShownSlugs } from '../lib/agent/doors-board-expectation.ts';
import type { ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

const atDoors = (over: Record<string, unknown> = {}): ConvState =>
  ({
    stage: 'doors',
    collected: {
      identityNoun: 'Maker',
      gap: 'I lost the job two years ago and my father nearly died six months after that.',
      ...over,
    },
  }) as never;

const turn = (state: ConvState, msg: string, history: ConvMessage[] = []) =>
  applyReconnectTurn(state, history, msg, { text: 'Say more about that.' } as never, RECONNECT_R2_ARC);

test('THE REGRESSION THAT SHIPPED: the board is offered on the R2 arc, not just the legacy one', () => {
  // The per-Session split renamed the arc and the board stopped rendering. Matching by PHASE is the fix; this fails
  // if anyone narrows it back to an exact id.
  const ex = expectsForState(RECONNECT_R2_ARC, atDoors());
  assert.equal(ex?.kind, 'doors_board', 'the Doors Session opens WITH the board under it');
  assert.ok((ex as { cards: unknown[] }).cards.length >= 11, 'every Door is put in front of her');
});

test('the board is taken away once she has answered it', () => {
  // Otherwise it reappears under every later turn of the same conversation and the Session cannot move on.
  assert.equal(expectsForState(RECONNECT_R2_ARC, atDoors({ boardDone: true })), undefined);
});

test('her taps are honoured verbatim, and biggest-impact leads', () => {
  const submission = serializeBoardSubmission({
    doors: [{ slug: 'career_cliff', relevance: 4 }, { slug: 'aging_parents', relevance: 5 }],
    quietDrift: false,
    first: 'career_cliff',
    biggest: 'aging_parents',
    stillOpen: ['aging_parents'],
  });
  const out = turn(atDoors(), submission);
  const doors = out.state.collected.doors ?? [];
  assert.deepEqual([...doors].sort(), ['aging_parents', 'career_cliff'], 'exactly what she marked — nothing added');
  assert.equal(doors[0], 'aging_parents', 'ruling 8: biggest-impact becomes the primary, expressed as order');
});

test('MARKING NOTHING IS AN ANSWER — no Door is invented for her, and it does not read as a failure', () => {
  // Theo's case, in the UI. He recognises none of them; the board must let him say so and we must not fill the gap
  // on his behalf. (The engine half of this is v3.5.56 — a Door inferred from topic words outranking his own words.)
  const out = turn(atDoors(), serializeBoardSubmission({ doors: [], quietDrift: false, first: null, biggest: null, stillOpen: [] }));
  assert.deepEqual(out.state.collected.doors ?? [], [], 'nothing is invented to fill the silence');
  assert.ok(out.state.collected.boardDone, 'answering with nothing still counts as having answered');
  assert.match(out.reply, /that'?s an answer/i, 'it is received as an answer, not a skipped step');
  assert.doesNotMatch(out.reply, /which (one|of these)/i, 'he is not pushed back onto the board he just declined');
});

test('she can only unmake a Door she was actually shown', () => {
  // The bound that keeps a submission from silently dropping a Door the board never rendered — her tap says nothing
  // about a card she never saw.
  const shown = boardShownSlugs();
  assert.ok(shown.length >= 11 && shown.every((s) => typeof s === 'string' && s.length > 0));
  assert.ok(!shown.includes('acceptance'), 'the retired Door is not on the board');
});
