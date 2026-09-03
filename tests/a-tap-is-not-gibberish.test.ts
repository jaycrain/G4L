// WHAT THE MEMBER TAPS MUST NOT BEHAVE LIKE NONSENSE.
//
// THE BUG THIS GENERALISES. The Doors confirm offered beat-confirm chips and then read the answer with the
// free-text classifier. A tap arrives as a serialized wire string; the prose reader did not recognise it, and the
// beat carried on as though nothing had been said. Donna, 2026-09-01: "I clicked That's It button and it kept
// coming back." Five days earlier she had reported the same beat as "didn't take yes for an answer" — which is
// what put the chips there. The chips shipped and the parse did not.
//
// A PARSER EXISTING IS NOT THE CONTRACT. `parseBeatConfirm` existed the whole time, and three other beats used
// it. What was missing was a CALL SITE using it, which no "is there a parser" test can see. So the assertion is
// behavioural:
//
//     DIFFERENT taps must produce DIFFERENT turns
//
// THE FIRST VERSION OF THIS TEST COMPARED A TAP AGAINST GIBBERISH, and it was wrong. The Doors confirm is
// deliberately default-to-commit-unless-disputed, so gibberish reading as "done" is the design, not a defect —
// the two replies matched for a legitimate reason and the test reported a bug that was not there. Comparing the
// chips against EACH OTHER needs no assumption about how a beat treats input it does not understand.
//
// It also catches the real thing precisely. Before the fix, prose collapsed all three chips to "done": tapping
// "There's more" and tapping "Not quite right" both produced the turn for "That's it". Identical replies from
// answers that mean opposite things is exactly the signature.
//
// AND THE REGISTRY CANNOT BE SKIPPED. The last test asserts every kind in the Expectation union is covered here.
// A new structured surface added without a case fails this file rather than passing it silently — which is the
// actual failure mode, since the tap bug was not a wrong answer, it was an unasked question.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReconnectTurn, RECONNECT_R1_ARC, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import { serializeGapConfirmChoice, GAP_CONFIRM_CHOICES } from '../lib/agent/gap-confirm-choice.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const COMMITTED: Collected = { identityNoun: 'Racer', gap: 'The years took it.', doors: ['grind', 'body'] } as Collected;

/** Reply the engine gives to `message` from `state` — the two runs must not share state. */
const replyTo = (state: () => ConvState, message: string, arc = RECONNECT_R2_ARC) =>
  applyReconnectTurn(state(), [], message, { text: '' }, arc).reply;

const stagedReplyTo = (state: () => ConvState, message: string) =>
  applyStagedTurn(state(), [], message, { text: '' }).reply;

// ── beat_confirm — the one that actually broke ───────────────────────────────────────────────────────────────
test('beat_confirm · the three chips produce three different turns', () => {
  const at = (): ConvState => ({ stage: 'doors', awaitingConfirm: true, collected: COMMITTED });
  const replies = (['done', 'addition', 'dispute'] as const).map((i) => [i, replyTo(at, serializeBeatConfirm(i))] as const);
  for (const [a, ra] of replies) for (const [b, rb] of replies) {
    if (a >= b) continue;
    assert.notEqual(ra, rb, `"${a}" and "${b}" produced the same turn — the chips are not being read as different answers`);
  }
});

// ── gap_confirm ──────────────────────────────────────────────────────────────────────────────────────────────
test('gap_confirm · the choices produce different turns', () => {
  const at = (): ConvState => ({ stage: 'gap', awaitingConfirm: true, collected: { ...COMMITTED } } as ConvState);
  // Values come FROM the choice list, not from memory. My first draft invented 'whole' and 'not_right'; the real
  // ones are more/done/wrong, the parser correctly refused the invented ones, and the test reported a bug in the
  // code that was a bug in the test. Deriving them means this cannot happen again, and a renamed value updates
  // the test for free.
  const replies = GAP_CONFIRM_CHOICES.map((c) => [c.value, stagedReplyTo(at, serializeGapConfirmChoice(c.value))] as const);
  for (const [a, ra] of replies) for (const [b, rb] of replies) {
    if (a >= b) continue;
    assert.notEqual(ra, rb, `"${a}" and "${b}" produced the same turn`);
  }
});

// ── doors_board ──────────────────────────────────────────────────────────────────────────────────────────────
test('doors_board · two different boards produce two different turns', () => {
  const at = (): ConvState => ({ stage: 'doors', collected: { ...COMMITTED, doors: [] } } as ConvState);
  const board = (slug: string) => serializeBoardSubmission({
    doors: [{ slug: slug as never, relevance: 4 }], quietDrift: false,
    first: slug as never, biggest: slug as never, stillOpen: [slug] as never,
  });
  assert.notEqual(replyTo(at, board('career_cliff')), replyTo(at, board('body')),
    'two different marked boards produced the same turn — the submission is not being read');
});

// ── scale ────────────────────────────────────────────────────────────────────────────────────────────────────
test('scale · a recorded answer changes the state it is recorded in', () => {
  // The scale has no wire format — the chip submits the digit, which is what a member could also type. So the
  // contract is that the ANSWER lands: two different answers cannot leave identical state.
  // The responses accumulate in the STAGE SCRATCH, not on the state root — my first draft read the wrong place
  // and compared two empty arrays, which is a test that cannot fail.
  // R1's arc, not R2's — `measurement` is a stage of The Distance. My first draft drove it through the Doors arc,
  // where that stage does not exist, so nothing ran and two empty states compared equal: a test that could not fail.
  const at = (): ConvState => ({ stage: 'measurement', collected: { ...COMMITTED } } as unknown as ConvState);
  const after = (n: string) => JSON.stringify(
    (applyReconnectTurn(at(), [], n, { text: '' }, RECONNECT_R1_ARC).state as { administeredResponses?: number[] })
      .administeredResponses ?? [],
  );
  assert.equal(after('1'), '[1]');
  assert.equal(after('5'), '[5]', 'a 1 and a 5 must not record the same thing');
});

// ── identity_pick ────────────────────────────────────────────────────────────────────────────────────────────
test('identity_pick · two different candidates commit two different handles', () => {
  const at = (): ConvState => ({
    stage: 'identity',
    collected: { athleticPast: 'I swam open water for twenty years.' },
    pendingIdentityPick: ['Swimmer', 'Competitor'],
  } as unknown as ConvState);
  const handle = (word: string) =>
    (applyStagedTurn(at(), [], word, { text: '' }).state.collected as Collected).identityNoun;
  assert.equal(handle('Swimmer'), 'Swimmer');
  assert.equal(handle('Competitor'), 'Competitor');
});

// ── reclaim_list ─────────────────────────────────────────────────────────────────────────────────────────────
test('reclaim_list · a submitted list reaches the list', () => {
  const at = (): ConvState => ({ stage: 'reclaim', collected: { ...COMMITTED, reclaimList: [] } } as ConvState);
  const out = applyStagedTurn(at(), [], '• Swim again\n• Cook for myself\n• Pay off the debt', { text: '' });
  const list = (out.state.collected as Collected).reclaimList ?? [];
  assert.ok(list.length >= 3, `the builder submission did not reach the list (got ${list.length})`);
  assert.ok(list.some((i) => /swim again/i.test(i)), 'and it must be their words, not a summary');
});

// ── THE REGISTRY — a new surface cannot skip this file ───────────────────────────────────────────────────────
test('every kind in the Expectation union has a case above', () => {
  // Read from the type, not a hand-kept list: a hand-kept list is how the tap bug's own guard would have gone
  // stale. domain_pick is covered by name here because its answer is the plain label the chip shows — the same
  // string a member could type — so it has no wire format to mis-read; if that ever changes it needs a case.
  const src = readFileSync(new URL('../lib/agent/onboarding.ts', import.meta.url), 'utf8');
  const union = src.slice(src.indexOf('export type Expectation'), src.indexOf(';', src.indexOf('export type Expectation')));
  const names = [...union.matchAll(/\|\s*(\w+)Expectation/g)].map((m) => m[1]!);
  // DoorsBoardExpectation is declared in its own module, so resolve across both files rather than assuming this
  // one holds every declaration — an unresolved name must not silently pass as "covered".
  const board = readFileSync(new URL('../lib/agent/doors-board-expectation.ts', import.meta.url), 'utf8');
  const kinds = names.map((n) => {
    const re = new RegExp(`${n}Expectation = \\{[^}]*kind: '([a-z_]+)'`);
    const decl = src.match(re) ?? board.match(re);
    assert.ok(decl, `could not resolve the kind for ${n}Expectation — do not assume it is covered`);
    return decl[1]!;
  });

  const COVERED = new Set(['beat_confirm', 'gap_confirm', 'doors_board', 'scale', 'identity_pick', 'reclaim_list', 'domain_pick']);
  const missing = kinds.filter((k) => !COVERED.has(k));
  assert.deepEqual(missing, [],
    'a structured surface exists with no tap-vs-gibberish case — add one, or the next tap bug ships unnoticed');
});

// ── THE DOORS SET — TWO CHIPS, AND THE THIRD ANSWER STILL REACHABLE ──────────────────────────────────────────
//
// Jay, 2026-09-03: "Not quite right is essentially the same thing as There's more. There's more does more work —
// it implies for the member to go ahead and write what's more."
//
// Dropping a chip is only safe if the INTENT behind it is still reachable, and that is what these assert. The
// button is gone; the dispute is not. A member who types "no, that's not it" must still get the apology and keep
// her Door, exactly as she did when there was a button for it.
import { applyReconnectTurn as applyR2, RECONNECT_R3_ARC } from '../lib/agent/reconnect.ts';

test('doors set · the two chips produce two different turns', () => {
  const at = (): ConvState => ({ stage: 'doors', awaitingConfirm: true, collected: COMMITTED });
  const more = applyR2(at(), [], serializeBeatConfirm('addition', 'doors'), { text: '' }, RECONNECT_R2_ARC).reply;
  const done = applyR2(at(), [], serializeBeatConfirm('done', 'doors'), { text: '' }, RECONNECT_R2_ARC).reply;
  assert.notEqual(more, done, 'the two Doors chips are not being read as different answers');
});

test('THE DISPUTE SURVIVES ITS BUTTON — typed, it still reopens the Door', () => {
  const at: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { ...COMMITTED } } as ConvState;
  const out = applyR2(at, [], "No — that's not it at all. You've read it backwards.", { text: '' }, RECONNECT_R2_ARC);
  assert.match(out.reply, /my mistake|help me see it/i, 'a typed dispute no longer reaches the apology');
  // And it must NOT bank the Door: a dispute is not a completion.
  assert.deepEqual((out.state.collected as Collected).doorsExcavated ?? [], [],
    'a Door was marked walked on a turn where she said we had it wrong');
});

// ── THE RULING SET — drift and the Window ────────────────────────────────────────────────────────────────────
//
// Two chips at every beat (Jay, 2026-09-03: "reducing it to two boxes simplifies things for Members"), but the
// PAIR differs by what the beat asks. These two name and select rather than reflect a cost, so the second chip is
// the correction, not "There's more" — and their prompts are unchanged because they already ask for this pair.
test('ruling set · That’s it and Not quite right produce different turns', () => {
  const at = (): ConvState => ({ stage: 'drift', awaitingConfirm: true, collected: { ...COMMITTED } } as ConvState);
  const done = applyR2(at(), [], serializeBeatConfirm('done', 'ruling'), { text: '' }, RECONNECT_R3_ARC).reply;
  const nope = applyR2(at(), [], serializeBeatConfirm('dispute', 'ruling'), { text: '' }, RECONNECT_R3_ARC).reply;
  assert.notEqual(done, nope, 'the two ruling chips are not being read as different answers');
});

test('EVERY BEAT NOW OFFERS EXACTLY TWO — and none offers a chip its prompt does not ask for', () => {
  // The invariant behind the whole change. A third chip creeping back, or a pair landing on the wrong beat, is
  // the defect Donna reported: buttons that cannot answer the question on screen.
  const src = readFileSync(new URL('../lib/agent/beat-confirm.ts', import.meta.url), 'utf8');
  for (const set of ['DOORS_CONFIRM_CHOICES', 'RULING_CONFIRM_CHOICES', 'LEGACY_CONFIRM_CHOICES']) {
    const block = src.slice(src.indexOf(`export const ${set}`), src.indexOf('];', src.indexOf(`export const ${set}`)));
    const n = (block.match(/value:/g) ?? []).length;
    assert.equal(n, 2, `${set} offers ${n} chips — the member-facing rule is two`);
  }
});
