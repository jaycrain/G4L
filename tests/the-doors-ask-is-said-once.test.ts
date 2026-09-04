// THE DOORS ASK — SAID ONCE, AND NOT THE SAME WORDS EVERY DOOR.
//
// Jennifer, 2026-09-04: "Repetition of 'have I got that right, or not quite?' Probably could add variation of
// that phrase." She marked TEN Doors, and this beat runs once per Door.
//
// TWO DIFFERENT REPETITIONS SAT UNDER THAT ONE SENTENCE, and the second was mine from the day before:
//
//   1. ACROSS Doors — the identical ask, ten times in one Session.
//   2. WITHIN a turn — unifying the chip prompt with the spoken line so the beat "says one line, chips and prose
//      alike" meant the member saw the SAME SENTENCE TWICE in a single turn: once closing the reply, once as the
//      label above the buttons. Rotating alone would have shipped three variants, each still doubled.
//
// The chips carry the ask — that is the design ("the prompt rides on the chips, so the model's words are never
// contradicted by a question it did not ask"). The reply speaks it ONLY when the chips are withheld, which is the
// member-on-the-way-out case.
//
// AND IT CYCLES RATHER THAN CLAMPS. The Legacy Letter's rotation clamps because there are at most two revisions;
// here there are up to eleven Doors, so clamping would repeat the third variant from the third Door on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState, Collected, ConvMessage } from '../lib/agent/onboarding.ts';

const atInsight = (): ConvState => ({
  stage: 'doors', awaitingConfirm: false,
  collected: { identityNoun: 'Athlete', boardDone: true, doors: ['body', 'loss', 'grind', 'marriage'], doorsExcavated: [] } as Collected,
  stageScratch: { doors: { doorDepth: 3, openedDoor: 'body' } },
} as unknown as ConvState);

/** Walk N Doors' worth of insight confirms, accumulating history the way a real Session does. */
function asks(n: number): { reply: string; prompt: string }[] {
  let history: ConvMessage[] = [];
  const out: { reply: string; prompt: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = applyReconnectTurn(atInsight(), history, 'It took the mornings.',
      { text: 'The mornings went first.', depthReady: true } as never, RECONNECT_R2_ARC);
    const prompt = (t as { expects?: { prompt?: string } }).expects?.prompt ?? '';
    out.push({ reply: t.reply, prompt });
    history = [...history, { role: 'member', text: 'x' }, { role: 'agent', text: `${t.reply} ${prompt}` }];
  }
  return out;
}

test('THE ASK IS NOT SPOKEN TWICE IN ONE TURN', () => {
  // The regression I introduced on 2026-09-03 and Jennifer met on 09-04.
  const [first] = asks(1);
  assert.ok(first!.prompt, 'the chips must carry the ask');
  assert.ok(!first!.reply.includes(first!.prompt),
    `the reply repeats the chip label verbatim — the member reads it twice:\n  reply: ${first!.reply}\n  chips: ${first!.prompt}`);
});

test('and it varies from Door to Door', () => {
  const four = asks(4).map((x) => x.prompt);
  assert.equal(new Set(four.slice(0, 3)).size, 3, `three consecutive Doors must not share an ask: ${JSON.stringify(four)}`);
  assert.notEqual(four[0], four[1], 'two Doors in a row got the identical sentence');
  assert.notEqual(four[1], four[2]);
});

test('IT CYCLES — an eleven-Door board never repeats twice running', () => {
  // Jennifer marked ten; Greg nine. Clamping would give every Door past the third the same words.
  const eleven = asks(11).map((x) => x.prompt);
  for (let i = 1; i < eleven.length; i++) {
    assert.notEqual(eleven[i], eleven[i - 1], `Doors ${i} and ${i + 1} share an ask — the rotation clamped instead of cycling`);
  }
});

test('every variant still lets the chips render — no wh-word, no imperative', () => {
  // The constraint that shaped the wording: endsOnOpenQuestion withholds the chips when the final question
  // carries a wh-word, so a variant containing one would silently kill the buttons on the beat it belongs to.
  for (const p of asks(3).map((x) => x.prompt)) {
    assert.doesNotMatch(p, /\b(who|whose|whom|what|what's|when|where|why|how|which)\b/i,
      `"${p}" carries a wh-word — the chips would be withheld on this Door`);
    assert.match(p, /\?$/, 'the ask must end by returning the turn');
  }
});
