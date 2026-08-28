// A MEMBER WHO CLOSES THE GAP IS HEARD THE FIRST TIME.
//
// Jay's walk, 2026-08-28. The Companion wrote a full recap and ended on "Does that land — or is there more to
// it?". He answered "That's the big stuff". He got a SECOND recap and "Was there more around that same stretch
// …?". His note: "This isn't horrible, but still repetitive."
//
// TWO INDEPENDENT FAULTS, and the first one is the interesting one:
//
// 1 · WE ASKED A QUESTION WE WERE NOT LISTENING FOR. When the model decides the story is done it writes the recap
//     and asks the confirm itself. If the engine is still under its depth floor it holds — correctly — but the
//     reply builder (`withQuestion`) KEEPS a question the model already asked. So the confirm went out while
//     `awaitingConfirm` stayed false, and his answer to it arrived at the GATHER handler, which can only read a
//     message as more story. Nobody misjudged the member; the two halves were asking different questions.
//     Fixed by replacing the model's trailing confirm with the draw-out question the engine will honour — keyed
//     on the model's structured `gapReady` flag, never on reading its prose. [[stage-agreement-invariant]]
//
// 2 · THE TWO CLOSE DETECTORS DISAGREED. The confirm gate read "That's the big stuff" as done; the gather gate
//     did not — so even once the question lined up, the close was not a close. The comment sitting on that very
//     line already predicted this: "the GATHER gate and the CONFIRM gate are two different close detectors, and
//     every earlier agreement fix went into the confirm one." It was still true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { memberSignalsGapComplete, resolveGapConfirm } from '../lib/agent/onboarding-intent.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

const GAP =
  'I was riding at a high level, setting PRs, racing gravel competitively, and starting a documentary with my ' +
  'wife Donna. The film got stressful right out of the gate. We missed deadlines, it worried our partners and ' +
  'got into our relationship. I stopped racing completely.';

const start = (): ConvState => ({ stage: 'gap', collected: { identityNoun: 'Racer', gap: GAP } }) as ConvState;

// The model's turn when it believes the story is whole: a recap that ENDS ON A CONFIRM.
const MODEL_WRAPS = {
  text: "Let me make sure I have the whole picture. Here's how it went, as you've told it: the film, the racing, " +
    "Donna's dad. Does that land — or is there more to it?",
  gapReady: true,
} as never;

test('the engine never ships a confirm question it is about to ignore', () => {
  const t = applyStagedTurn(start(), [], "Then Donna's dad got sick and she went home to help.", MODEL_WRAPS);

  // Held below the floor — which is correct and unchanged. Nothing here shortens the draw-out.
  assert.ok(!t.state.awaitingConfirm, 'still gathering; the floor holds');
  // …so the member must NOT be looking at a confirm. The model's recap survives; only its question is replaced.
  assert.doesNotMatch(t.reply, /is there more to it\?/, "the model's confirm is replaced, not shipped");
  assert.match(t.reply, /Let me make sure I have the whole picture/, 'its recap is kept — receiveThen keeps the receipt');
  assert.match(t.reply, /\?$/, 'and the turn still ends on a question the engine will honour');
});

test("a close during the draw-out advances — it is not read as another chapter", () => {
  let state = start();
  const history: ConvMessage[] = [];
  const first = applyStagedTurn(state, history, "Then Donna's dad got sick and she went home.", MODEL_WRAPS);
  state = first.state as ConvState;
  history.push({ role: 'member', text: "Then Donna's dad got sick and she went home." },
    { role: 'agent', text: first.reply });

  const closed = applyStagedTurn(state, history, "That's the big stuff", { text: 'That was a lot to carry.' });

  assert.equal(closed.state.awaitingConfirm, true, 'his close moves the beat to the confirm');
  // The exact shape he saw: thanked for a close, then asked the same question again.
  assert.doesNotMatch(closed.reply, /Was there more around that same stretch/,
    'the follow-up he had just answered must not come back');
});

test('an addition riding on a close still draws out — the close never eats new material', () => {
  // The reason this fix lives in isAnaphoricClose and not in GAP_DONE_RE. That regex is an unanchored substring
  // match with no loss-signal guard, so teaching it "big stuff" would close on this sentence too and drop the
  // sister. Here the residue test sees her and keeps going.
  const withMore = "That's the big stuff, and my sister stopped speaking to me that same year";
  assert.equal(memberSignalsGapComplete(withMore), false, 'new material outranks the closing phrase');
  assert.equal(resolveGapConfirm(withMore, undefined, 'anything_more'), 'addition');
});

test('the gather gate and the confirm gate agree about what a close is', () => {
  // THE INVARIANT, not a list of phrasings. Every earlier fix in this family added the one sentence that had just
  // failed — Jennifer's "Yes.", Donna's "It was primarily around those three things", now "That's the big stuff".
  // What keeps going wrong is that the two gates are fixed separately, so the codebase holds two different
  // opinions about the same sentence and the member meets whichever one the engine happens to be standing in.
  const closings = [
    "That's the big stuff", "that's the brunt of it", "That's the heart of it", "that's the gist of it",
    "That's it", "mainly those three things", "that's pretty much it", "that's the whole story",
  ];
  for (const m of closings) {
    assert.equal(resolveGapConfirm(m, undefined, 'anything_more'), 'done', `confirm gate: "${m}"`);
    assert.equal(memberSignalsGapComplete(m), true, `gather gate disagrees on: "${m}"`);
  }

  // And symmetrically — anything carrying real material must read as more on BOTH sides.
  const more = [
    'The big stuff was my dad dying that spring and I never really came back from it',
    'and my sister stopped speaking to me that same year',
    'my heart gave out on a ride and I spent a month in hospital',
  ];
  for (const m of more) {
    assert.equal(resolveGapConfirm(m, undefined, 'anything_more'), 'addition', `confirm gate: "${m}"`);
    assert.equal(memberSignalsGapComplete(m), false, `gather gate closed on real material: "${m}"`);
  }
});
