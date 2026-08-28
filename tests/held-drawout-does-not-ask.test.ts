// A HELD BEAT DOES NOT SHIP THE QUESTION IT IS DECLINING TO ANSWER.
//
// Jay, R3, 2026-08-28. The Companion held up his reclaimed Tuesday and ended on "Is that the day worth chasing?"
// He said "Absolutely". It replied "What else is different by 7am?" — he answered the question he was asked, and
// was asked another one. Then, a beat later, he had to say "That's it" TWICE.
//
// Same fault as onboarding's gap beat, fixed this morning, in the three Reconnect draw-outs nobody looked at.
// When the model judges a beat done it writes its reflection and ends on a CONFIRM; if the engine is under the
// beat's depth floor it holds — correctly — but `withQuestion` KEEPS a question the model already asked. So the
// confirm goes out while the engine is still gathering, and the member's answer reaches the handler that can only
// read it as more material.
//
// doors, drift and window all carried the identical line. The fix is one helper, not a third and fourth copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReconnectTurn, RECONNECT_R2_ARC, RECONNECT_R3_ARC, BEAT_SEP } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const COLLECTED = { identityNoun: 'Racer', doors: ['body'], gap: 'x', reclaimList: ['gravel races', 'ride with friends'] };

/** The model's turn when it believes the beat is done: a reflection ENDING ON ITS OWN CONFIRM. */
const MODEL_WRAPS = {
  text: 'That reclaimed Tuesday: you wake rested, the workout is earlier, the world is lit back up and the ' +
    'people are in it again. Is that the day worth chasing?',
  depthReady: true,
} as never;

const BEATS: [string, ConvState, unknown][] = [
  ['window', { stage: 'window', collected: COLLECTED } as ConvState, RECONNECT_R3_ARC],
  ['drift', { stage: 'drift', collected: COLLECTED } as ConvState, RECONNECT_R3_ARC],
  ['doors', { stage: 'doors', collected: COLLECTED } as ConvState, RECONNECT_R2_ARC],
];

test('a beat held under its floor replaces the confirm it will not honour', () => {
  for (const [name, state, arc] of BEATS) {
    const t = applyReconnectTurn(state, [], 'It would be lighter, and the friends would be back in it.', MODEL_WRAPS, arc as never);
    if (t.state.awaitingConfirm) continue; // it advanced — the confirm is real and belongs on screen

    assert.doesNotMatch(t.reply, /Is that the day worth chasing\?/,
      `${name}: held the beat but still asked the model's confirm`);
    // The engine's own probe was APPENDED as its own beat. Asserted structurally rather than by matching copy:
    // the first version demanded a '?' (several probes close on a period) and the second listed phrasings and
    // missed drift's. receiveThen joins receipt + BEAT_SEP + probe, so the separator is the fact to check.
    assert.ok(t.reply.includes(BEAT_SEP), `${name}: no engine probe was appended after the model's receipt`);
    // The model's words survive — only its trailing ask is replaced. Losing the reflection would be a worse fix.
    assert.match(t.reply, /reclaimed Tuesday|wake rested/, `${name}: the model's reflection was thrown away`);
  }
});

test('all three draw-outs share ONE hold rule', () => {
  // The gap beat had this fixed in the morning and these three did not, because the fix was written at a call
  // site instead of as a rule. Three copies is how the fourth gets missed.
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  // Counted as "the definition, plus every hold branch" rather than a fixed number — the window has TWO hold
  // branches (the gather floor and the confirm re-open), which is why an expected count of 4 was wrong.
  assert.equal((src.match(/function heldDrawout\(/g) ?? []).length, 1, 'exactly one definition');
  assert.ok((src.match(/= heldDrawout\(/g) ?? []).length >= 3, 'every draw-out hold routes through it');
  // SCOPED TO THE HOLD BRANCHES — the reply that immediately follows `if (!advance) {`. A blanket ban on
  // `withQuestion(b.modelText, …More(…))` was wrong: the CONFIRM handlers use exactly that shape on their
  // 'addition' branch, where the member has just given new material and the model IS answering it. Keeping its
  // question there is correct; the fault is only ever keeping a question the engine has declined to honour.
  for (const m of src.matchAll(/if \(!advance\) \{\s*b\.reply = ([^;]+);/g)) {
    assert.match(m[1]!, /heldDrawout\(/, `a hold branch bypasses the rule: ${m[1]!.slice(0, 60)}`);
  }
  assert.ok([...src.matchAll(/if \(!advance\) \{/g)].length >= 3, 'expected the three draw-out holds');
});

test('a three-word turn is not a reflection worth confirming', () => {
  // "That's the day." became the window beat's reflect-and-confirm: a bubble that restated nothing, with an
  // implicit ask to confirm it. He said "That's it" a second time, which is what a member does when the product
  // appears not to have heard the first one.
  const thin = { text: "That's the day.", depthReady: true } as never;
  const t = applyReconnectTurn({ stage: 'window', collected: COLLECTED } as ConvState, [],
    'Rested, lighter, the friends back in it.', thin, RECONNECT_R3_ARC);

  assert.notEqual(t.state.awaitingConfirm, true, 'nothing was reflected, so there is nothing to confirm');
  assert.match(t.reply, /What else is different/i, 'it draws out rather than parking on three words');
});
