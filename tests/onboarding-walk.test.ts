// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE WALK — does a member actually get all the way through?
//
// WHY THIS FILE EXISTS, AND WHY IT DID NOT UNTIL 2026-08-20.
//
// There were 1971 tests before this one and not a single one walked a complete onboarding. Every test asserted a
// pure function in isolation, which is why the failures that reached real members all had the same shape — A
// REQUIRED SURFACE DID NOT APPEAR AT ITS BEAT — and none of them were caught:
//
//   · the 1–5 chips vanished after a refresh (broken for six weeks; a member found it)
//   · the wire string printed into her own transcript
//   · the Doors line rendered against a set that was empty at the moment it rendered
//   · the twelve-question baseline never ran, and the model said it would come later
//   · no card, no ceremony, no dashboard
//
// The persona harness DID compute this. On the morning of the 20th it printed, in its own output:
//
//     === SURFACE COVERAGE ===
//       ✓ tapped  identity_pick
//       ✓ tapped  gap_confirm
//       ✓ tapped  reclaim_list
//       ✗ NEVER APPEARED  scale
//
// `scale` is the baseline assessment. That is the exact bug a real member hit four hours later. It was a line of
// output for a human to read rather than a gate, and the human read past it. A signal nobody is obliged to act on
// is not a test.
//
// SO THIS IS THE CONTRACT, NOT A SCENARIO. It does not assert copy, or ordering within a beat, or how many turns
// a draw-out takes — all of those are meant to change. It asserts the two things that must never be false:
//
//   1. Every gate a member must pass through actually RENDERS. Identity, the Doors, the list builder, the twelve
//      baseline items, the card.
//   2. The engine reaches the end. A walk that stops early fails here rather than in someone's inbox.
//
// Plus the rule that Donna's walk cost us: the model may converse, but it may never announce the outcome of a
// gate the engine has not reached.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { ONBOARDING_BASELINE_ITEMS } from '../lib/grinta/survey/instrument.ts';
import { claimsGateOutcome } from '../lib/agent/gate-claims.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import type { ConvMessage, ConvState, Expectation, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

/** Every surface a member MUST be handed before onboarding can be called done. */
const REQUIRED: Expectation['kind'][] = ['identity_pick', 'gap_confirm', 'reclaim_list', 'scale'];

const GAP =
  'Two years ago I lost my job, and I was our family’s sole financial provider. Around the same time my dad got really sick and almost died. I gained twenty pounds and lost my fitness somewhere in there.';

/**
 * Drive a full onboarding the way the CLIENT does — by answering whatever surface the engine hands back.
 *
 * This is the half unit tests cannot reach. A structured expectation is a contract between the engine and the
 * browser, and every bug listed above lived precisely in that seam: the engine's state was right and the member
 * was handed the wrong thing, or nothing. So the harness only ever replies to what it was actually GIVEN — if a
 * surface never arrives, it cannot be answered, and the walk stalls exactly as it did for her.
 */
function walk(model: (state: ConvState, turn: number) => ModelTurn) {
  let state: ConvState = { stage: 'identity', collected: {} };
  const history: ConvMessage[] = [];
  const seen = new Set<string>();
  const turns: Turn[] = [];
  let expects: Expectation | null = null;

  for (let i = 0; i < 60; i++) {
    // Answer the surface in front of us — a tap is what a member would do.
    let msg: string;
    if (expects?.kind === 'identity_pick') msg = expects.candidates?.[0] ?? 'Maker';
    else if (expects?.kind === 'gap_confirm') msg = serializeGapConfirmChoice('done');
    else if (expects?.kind === 'reclaim_list') msg = '• lose the 20 lbs I gained\n• get my fitness back\n• peace at home';
    else if (expects?.kind === 'scale') msg = '3';
    else msg = ['I was a maker.', GAP, 'That’s the whole of it.', 'I want my fitness back.', 'Yeah', 'Ok.'][i % 6]!;

    const t = applyStagedTurn(state, history, msg, model(state, i));
    turns.push(t);
    history.push({ role: 'member', text: msg }, { role: 'agent', text: t.reply });
    state = t.state;
    expects = t.expects ?? null;
    if (expects) seen.add(expects.kind);
    if (t.complete || t.declined) break;
  }
  return { state, turns, seen, history };
}

/** A cooperative model: records what it hears, signals when drawn out. The ordinary case. */
const cooperative = (state: ConvState, i: number): ModelTurn => ({
  text: 'Tell me more about that.',
  ...(state.stage === 'identity' && i > 0 ? { identityCandidates: ['Maker', 'Builder'] } : {}),
  ...(state.stage === 'gap' ? { record: { gap: GAP }, gapReady: true } : {}),
  ...(state.stage === 'reclaim' ? { replyIntent: 'done' as const } : {}),
});

test('WALK — every required surface is handed to the member, and the walk finishes', () => {
  const { seen, state, turns } = walk(cooperative);
  for (const kind of REQUIRED) {
    assert.ok(seen.has(kind), `the member was NEVER handed "${kind}" — that beat cannot be completed`);
  }
  assert.equal(state.stage, 'complete', 'the walk must reach the card, not stall somewhere in the middle');
  assert.ok(turns.at(-1)!.complete, 'and the final turn must say so');
});

test('WALK — all twelve baseline items are asked, none skipped', () => {
  // The instrument is frozen (24-item IDQ, 12-item Grinta baseline). A walk that renders the surface but drops
  // items would pass the coverage check above while writing a wrong number onto her dashboard.
  const { turns } = walk(cooperative);
  const asked = turns.map((t) => t.expects).filter((e): e is Expectation & { kind: 'scale' } => e?.kind === 'scale');
  assert.equal(asked.length, ONBOARDING_BASELINE_ITEMS.length, 'every baseline item must be put to her');
  assert.deepEqual(asked.map((e) => e.index), asked.map((_, i) => i + 1), 'in order, with none missing');
});

test('WALK — the model cannot end onboarding; only the engine can', () => {
  // Donna's walk, reproduced: a model that wraps up in prose while its signal says keep going. It used to be
  // taken at its word by the member and ignored by the engine — a goodbye three turns before the real beat.
  const closesEarly = (state: ConvState): ModelTurn => ({
    text:
      state.stage === 'reclaim'
        ? "So here's what you want back:\n\n- Lose the 20 lbs you gained\n- Get your fitness back\n\nThat's your Reclaim List. It lives on your dashboard now. That's plenty for today."
        : 'Tell me more about that.',
    ...(state.stage === 'identity' ? { identityCandidates: ['Maker'] } : {}),
    ...(state.stage === 'gap' ? { record: { gap: GAP }, gapReady: true } : {}),
  });

  const { seen, state, turns } = walk(closesEarly);
  assert.ok(seen.has('reclaim_list'), 'the builder still arrives — the premature close IS the transition');
  assert.ok(seen.has('scale'), 'and the baseline still runs; the model does not get to skip it');
  assert.equal(state.stage, 'complete', 'the walk finishes despite the model trying to end it early');

  // …and the false claim never reaches her: the turn that opens the builder must not also tell her the list is
  // already made and saved. That contradiction, on one screen, is the bug in its compressed form.
  const opener = turns.find((t) => t.expects?.kind === 'reclaim_list')!;
  assert.equal(claimsGateOutcome(opener.reply), false, 'the builder handoff must not carry the model’s false close');
});

test('WALK — the Companion is never silent; no turn ships a blank bubble', () => {
  // A model turn that calls a tool and writes no prose used to ship through as an empty reply — a blank bubble
  // and a conversation that has visibly stopped, with nothing for her to do but talk into the silence. Found on a
  // live walk (2026-08-20) on the turn right after she named the first thing she wanted back.
  //
  // Asserted over the WHOLE walk rather than at the beat where it was found: every stage passes model prose
  // through somewhere, so any of them can do this, and the next one will be found here instead of by a member.
  // NOT `{...cooperative, text: ''}` — cooperative signals replyIntent 'done' at reclaim, which advances the beat
  // before the draw-out passthrough ever runs, so that version of this test passed against the BROKEN code. The
  // mute model must be silent AND keep the conversation going, which is the real shape: a turn that records a
  // want and says nothing.
  const mute = (state: ConvState, i: number): ModelTurn => ({
    text: '',
    ...(state.stage === 'identity' && i > 0 ? { identityCandidates: ['Maker'] } : {}),
    ...(state.stage === 'gap' ? { record: { gap: GAP }, gapReady: true } : {}),
    ...(state.stage === 'reclaim' ? { record: { reclaimList: ['the water'] } } : {}),
  });
  for (const model of [cooperative, mute]) {
    const { turns } = walk(model);
    for (const t of turns) {
      assert.ok(t.reply.trim().length > 0, `a turn shipped an empty reply at stage "${t.state.stage}"`);
    }
  }
});

test('WALK — an ordinary walk never tells her the work is finished before it is', () => {
  // The regression guard on the whole conversation: until the engine says complete, nothing the member READS may
  // claim her list is made, her words are saved, or today is over. Scoped to a normal walk on purpose — the
  // engine converts a premature close into the real transition at the beat it owns, it does not rewrite arbitrary
  // model prose, and asserting otherwise would test something we did not build. The prompt carries that half.
  const { turns } = walk(cooperative);
  for (const t of turns) {
    if (t.complete) continue;
    assert.equal(claimsGateOutcome(t.reply), false, `a mid-walk turn claimed an outcome: "${t.reply.slice(0, 80)}"`);
  }
});
