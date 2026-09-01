// A MEMBER IS NEVER RELEASED WITHOUT BEING OFFERED A HANDLE.
//
// Marion's two live walks, 2026-09-01, same code and same persona, diverged:
//   · run 1 — the model proposed candidates at turn four; she picked "Teacher".
//   · run 2 — the model proposed nothing across five turns; she reached the gap stage having never been offered
//             a handle at all, and was released with identitySkipped.
//
// Nothing was broken. Whether the chooser appeared was simply left to the model deciding to call a tool, and a
// model's judgement is not a guarantee. Jay's ruling: "We HAVE to offer chips that are selected. If it's a trade
// off between ultimate flexibility for any human words any way, and 100% accuracy, it's the latter." Same call he
// made on 2026-07-29 when tap-to-pick replaced extraction, for the same reason.
//
// So the ENGINE decides when an offer is owed and the WRAPPER makes the call. These tests cover the decision,
// which is the half that can be reasoned about offline — applyStagedTurn stays pure and every replay fixture
// keeps describing real behaviour.
//
// The four conditions below are each here because getting one wrong causes a distinct harm, named in each test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mustForceIdentityCandidates } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

const NO_HISTORY: ConvMessage[] = [];
// The authored frame, verbatim — an agent turn containing it means the chooser has already been shown.
const OFFERED: ConvMessage[] = [{ role: 'agent', text: 'Here are a few words for who that was — tap the one that fits, or write your own. It\u2019s a handle to hold onto, not a label set in stone, and we can change it anytime.' }];

const at = (identityTurns: number, collected: Record<string, unknown> = {}): ConvState =>
  ({
    stage: 'identity',
    collected: { athleticPast: 'I taught history for twenty-six years.', ...collected },
    stageScratch: { identity: { identityTurns } },
  }) as unknown as ConvState;

const noWords = { text: 'some reflection' } as never;

test('forces the offer once the member is past the breathe floor', () => {
  assert.equal(mustForceIdentityCandidates(at(3), noWords, NO_HISTORY), true);
  assert.equal(mustForceIdentityCandidates(at(4), noWords, NO_HISTORY), true);
});

test('does NOT fire inside the breathe floor — this is the rushing Jay flagged twice', () => {
  // "identity suggestions came too abruptly" (2026-08-28) and "it felt a little rushed" (2026-08-27). Forcing an
  // offer at turn one would reintroduce exactly that, and buy reliability with the thing he twice asked for.
  assert.equal(mustForceIdentityCandidates(at(0), noWords, NO_HISTORY), false);
  assert.equal(mustForceIdentityCandidates(at(2), noWords, NO_HISTORY), false);
});

test('never overrides a model that already did its job', () => {
  // A second forced call on top of a good proposal is wasted latency and money on the most expensive path in the
  // product, and risks replacing the model's own-language words with a colder second set.
  const withWords = { text: 'here are some', identityCandidates: ['Teacher', 'Mentor'] } as never;
  assert.equal(mustForceIdentityCandidates(at(4), withWords, NO_HISTORY), false);
});

test('blank or whitespace candidates do NOT count as an offer', () => {
  // The gate is "was the member actually offered something", not "did the tool fire". An empty array reaching the
  // client renders a chooser with no chips — worse than no chooser, because it looks broken.
  assert.equal(mustForceIdentityCandidates(at(4), { text: 'x', identityCandidates: [] } as never, NO_HISTORY), true);
  assert.equal(mustForceIdentityCandidates(at(4), { text: 'x', identityCandidates: ['  ', ''] } as never, NO_HISTORY), true);
});

test('never proposes off nothing — no past self, no words', () => {
  // THE ONE THIS BEAT MUST NEVER DO. With no drawn-out past self there is no member language to draw from, so a
  // proposal would be a label from thin air — the governance line is that we never name an identity the member
  // did not give us. Someone who has said nothing is released at five turns instead, as before.
  const blank = { stage: 'identity', collected: {}, stageScratch: { identity: { identityTurns: 4 } } } as unknown as ConvState;
  assert.equal(mustForceIdentityCandidates(blank, noWords, NO_HISTORY), false);
});

test('stops once they have a handle, and stays out of every other stage', () => {
  assert.equal(mustForceIdentityCandidates(at(4, { identityNoun: 'Teacher' }), noWords, NO_HISTORY), false);
  const gap = { stage: 'gap', collected: { athleticPast: 'x' }, stageScratch: { identity: { identityTurns: 4 } } } as unknown as ConvState;
  assert.equal(mustForceIdentityCandidates(gap, noWords, NO_HISTORY), false);
});

// ── THE FOURTH EXIT ───────────────────────────────────────────────────────────────────────────────────────────
//
// The model has a `skip_identity` tool and it uses it. Marion said "Can we just move on?" and the model skipped
// her on the spot — before she had ever been shown a chip. It bypasses the engine's turn counting entirely, which
// is why the first version of this guarantee did nothing for her: it was waiting for a turn count that the model
// never let her reach.
const modelSkips = { text: 'that is completely fine', record: { identitySkipped: true } } as never;

test('a model-signalled skip TRIGGERS the offer instead of ending the beat', () => {
  // Even at turn one: the skip is what makes the offer urgent, not something to wait out.
  assert.equal(mustForceIdentityCandidates(at(1), modelSkips, NO_HISTORY), true);
});

test('but only once — a member who has seen the chooser and declined is not asked again', () => {
  // Declining a real offer is a legitimate answer. Re-forcing it would be the product refusing to hear "no",
  // which is the opposite of the posture (the member sets the depth, and stops anytime).
  assert.equal(mustForceIdentityCandidates(at(4), modelSkips, OFFERED), false);
  assert.equal(mustForceIdentityCandidates(at(4), noWords, OFFERED), false);
});

test('a model skip with nothing to draw on is still honoured', () => {
  // No past self means no member language, so there is nothing to propose FROM. Someone who has told us nothing
  // is let go rather than handed a label from thin air.
  const blank = { stage: 'identity', collected: {}, stageScratch: { identity: { identityTurns: 1 } } } as unknown as ConvState;
  assert.equal(mustForceIdentityCandidates(blank, modelSkips, NO_HISTORY), false);
});
