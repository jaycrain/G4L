// A BEAT THAT HANDS INTO A WAITING STAGE MUST ASK FOR WHAT IT WAITS FOR.
//
// Donna's Rewire walk, 2026-08-27: "I was on a great roll with Disinformation Audit then it left me hanging on my
// first true line." The Companion reflected her fifth lie, named the campaign, seeded the work from her Legacy
// Letter, and named the lie that cost her most — then stopped. No question. The engine advanced her to 'affirm',
// which sits waiting for a true line nobody had asked her to write. Her next message was "What am I supposed to
// do here?"
//
// The guard already existed for the other four domains, one line above in the same function. This pins it to the
// fifth — the only handoff where the next stage waits on the member.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRewireTurn, rewireOpening, withScriptedBeat, W1_TURN_ASK_FALLBACK } from '../lib/agent/rewire.ts';
import { BEAT_SEP, type ConvState } from '../lib/agent/onboarding.ts';

/** Walk the five domains, answering each, with the model text supplied for the fifth. */
function walkToHandoff(fifthModelText: string): string {
  let t = rewireOpening();
  let state = t.state as ConvState;
  for (let i = 0; i < 5; i++) {
    const isLast = i === 4;
    t = applyRewireTurn(state, [], `That's a lie I tell myself, number ${i + 1}.`, {
      text: isLast ? fifthModelText : 'Heard. That one sounds reasonable, and it keeps you where you are.',
    });
    state = t.state as ConvState;
  }
  assert.equal(state.stage, 'affirm', 'the fifth domain should hand into the true-line stage');
  return t.reply;
}

test("Donna's turn — the model names the costliest lie and asks nothing — still asks", () => {
  // Verbatim shape from her screenshot: reflection, campaign, seed, then the naming, with no question anywhere.
  const hers =
    `…running on autopilot — and while they run, the Maker waits.\n\n` +
    `Here's what I noticed: you've already been speaking in true lines all session. In your Legacy Letter you ` +
    `wrote "I made it here" and "I'm fit".\n\n` +
    `The one that costs you most, in your own words: I can do things for myself when everyone and everything ` +
    `else is taken care of.`;
  const reply = walkToHandoff(hers);
  assert.ok(reply.includes('?'), 'a handoff into a waiting stage must ask the member something');
  assert.ok(reply.includes(hers), "the model's own turn is kept whole — we append, never replace");
  assert.ok(reply.endsWith(W1_TURN_ASK_FALLBACK), 'the ask lands last, as its own beat');
});

test('a model turn that already asks is left alone — no double question', () => {
  const asks =
    `The one that costs you most, in your own words: "I'm alright."\n\n` +
    `What's the honest line you'd put in its place?`;
  const reply = walkToHandoff(asks);
  assert.equal(reply, asks, 'the model asked; the engine must not ask again');
  assert.equal((reply.match(/\?/g) ?? []).length, 1);
});

test('an empty model turn still gets the campaign reveal and the ask', () => {
  const reply = walkToHandoff('');
  assert.ok(reply.includes('autopilot'), 'the scripted campaign reveal is the fallback');
  assert.ok(reply.endsWith(W1_TURN_ASK_FALLBACK));
});

// The helper's own claim, which its code did not honour until now.
test('withScriptedBeat is BEAT_SEP-aware, as its comment has always said', () => {
  const asked = `I hear that.${BEAT_SEP}What would you put in its place?`;
  assert.equal(withScriptedBeat(asked, 'SCRIPTED'), asked, 'a question in the last BEAT_SEP bubble counts');

  const didNotAsk = `I hear that.${BEAT_SEP}That one costs you the most.`;
  assert.equal(withScriptedBeat(didNotAsk, 'SCRIPTED'), `${didNotAsk}${BEAT_SEP}SCRIPTED`);

  // A question in an EARLIER bubble is not the current ask — the last beat still governs.
  const askedEarlier = `What's underneath that?${BEAT_SEP}That one costs you the most.`;
  assert.ok(withScriptedBeat(askedEarlier, 'SCRIPTED').endsWith('SCRIPTED'));
});
