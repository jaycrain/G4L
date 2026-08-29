// THE LETTER THAT SAVES IS THE ONE HE READ.
//
// Jay's R3, 2026-08-28. He tapped "There's more" and got the same question back with the chips still up — no
// composer, nothing to type into. He typed his addition anyway (being more proactive with his kids) and the beat
// replied "Saved — dated a year from today, and addressed to you."
//
// The stored row: 1,114 characters, `revised: false`, created_at == updated_at. His words never reached the
// letter, and we told him they had. That is the worst shape in the product — a false claim about a member's own
// record, on the one artifact designed to be read a year later.
//
// THREE FAULTS, and each was a guard that existed and did not work:
//  1 · `carriesMaterial: () => false` at the confirm call — the corroboration gate hardcoded to "the member never
//      brings anything new", so a model saying 'done' always won.
//  2 · the addition branch re-rendered the CHIPS, so a tap asking for a change was answered by re-offering the
//      same tap, with no way to type.
//  3 · nothing stopped the commit path writing a body the member had asked to change.
//
// Jay's ruling: "Redraft and show, get confirmation so the right version gets to the Playbook. Big Deal."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReconnectTurn, RECONNECT_R3_ARC } from '../lib/agent/reconnect.ts';
import { serializeBeatConfirm } from '../lib/agent/beat-confirm.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// A TAP IS A WIRE STRING, not the label on the button. My first version of this test passed "There's more" —
// the words he sees — which falls through to the free-text classifier, where the corroboration gate reads a
// short reply carrying no material as a CLOSE. That is correct for "is there more?" and exactly wrong here, and
// it is why the fixture has to send what the client actually sends.
const TAP_MORE = serializeBeatConfirm('more', 'legacy');
const TAP_MINE = serializeBeatConfirm('done', 'legacy');

const DRAFT = 'Dear me, a year out. You got back on the bike. The racing came back. Donna and you found the rhythm again.';
const atDraft = (): ConvState =>
  ({ stage: 'legacy', awaitingConfirm: true, legacyDraft: DRAFT,
     collected: { identityNoun: 'Racer', doors: ['marriage'], gap: 'x' } }) as ConvState;

test('asking for a change opens the composer instead of re-offering the tap', () => {
  const t = applyReconnectTurn(atDraft(), [], TAP_MORE, { text: '' } as never, RECONNECT_R3_ARC);
  assert.equal(t.expects, undefined, 'the chips must come down or there is nothing to type into');
  assert.ok(!t.complete, 'and the beat stays open');
});

test('a change asked for is never committed unredrafted — even if the model says done', () => {
  // The exact sequence. He asks for a change; the model then signals completion without producing a new body.
  let s = applyReconnectTurn(atDraft(), [], TAP_MORE, { text: '' } as never, RECONNECT_R3_ARC).state as ConvState;
  const t = applyReconnectTurn(s, [], 'Being more proactive with my kids and their lives.',
    { text: 'Got it.', replyIntent: 'done' } as never, RECONNECT_R3_ARC);

  assert.equal(t.state.legacyLetter, undefined, 'nothing may be written that he has not read');
  assert.doesNotMatch(t.reply, /Saved/i, 'and nothing may CLAIM it was written');
});

test('once the redraft is shown and confirmed, it commits — and it is the new one', () => {
  let s = applyReconnectTurn(atDraft(), [], TAP_MORE, { text: '' } as never, RECONNECT_R3_ARC).state as ConvState;
  s = applyReconnectTurn(s, [], 'Being more proactive with my kids.', { text: 'Got it.' } as never, RECONNECT_R3_ARC).state as ConvState;

  const REDRAFT = `${DRAFT} And you showed up for the kids — not around the edges, in it.`;
  const shown = applyReconnectTurn(s, [], '', { text: '', legacyBody: REDRAFT } as never, RECONNECT_R3_ARC);
  assert.match(shown.reply, /showed up for the kids/, 'the new version is put in front of him');
  assert.equal(shown.state.legacyLetter, undefined, 'and still not committed — he has not confirmed it yet');

  const done = applyReconnectTurn(shown.state as ConvState, [], TAP_MINE, { text: '' } as never, RECONNECT_R3_ARC);
  assert.equal(done.state.legacyLetter?.body, REDRAFT, 'what saves is the version he read and confirmed');
});

test('the corroboration gate is wired to a real predicate', () => {
  // `() => false` is not a conservative default — it is the gate switched off, and it reads as a gate.
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /resolveConfirmCorroborated\([^)]*\(\)\s*=>\s*false/,
    'a hardcoded carriesMaterial disables the gate at that call site');
});

test('if the change can never be written, it saves and SAYS so — it does not hold forever or lie', () => {
  // Holding open indefinitely is its own trap; committing silently is the lie this fix exists to stop. The third
  // option is the only honest one: save what exists, name what is missing, say where to add it.
  let s = applyReconnectTurn(atDraft(), [], TAP_MORE, { text: '' } as never, RECONNECT_R3_ARC).state as ConvState;
  let last;
  for (let i = 0; i < 4; i++) {
    last = applyReconnectTurn(s, [], 'Add the part about my kids.', { text: 'Okay.' } as never, RECONNECT_R3_ARC);
    s = last.state as ConvState;
    if (last.state.legacyLetter) break;
  }
  assert.ok(last!.state.legacyLetter, 'it must eventually save rather than trap him in the beat');
  assert.match(last!.reply, /couldn't get that change into the letter/i, 'and it says the change is not in it');
  assert.doesNotMatch(last!.reply, /^Saved/i, 'never a bare "Saved" over a letter missing the edit he asked for');
});
