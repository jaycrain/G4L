// THE REFINED LIST IS SHOWN ONCE, AND THE SAVE IS ASKED ONCE.
//
// Donna's Reclaim walk, 2026-08-27: "Crazy repetition on priorities when redoing the Reclaim List. Probably works
// better if there are more than 3 but the program has you start with 3 so a lot of people might just have that
// many." She read her three items four times in a row and was asked to confirm twice.
//
// Two of the four repeats are the model's (it printed the tiers, then printed a numbered order) — fixed in
// REFINE_SYSTEM, which is a prompt and cannot be asserted here. The fourth is the engine's, and it is the one this
// pins: with a three-item list, "The three you'd move on next" re-printed the entire list directly beneath itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReclaimC1Turn, reclaimC1Opening, REFINE_SYSTEM } from '../lib/agent/reclaim.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const HERS = [
  'A creative leadership role with compensation that covers my bills and pays off my accumulated debt.',
  'Down 20 lbs, strong core from yoga and Pilates, hiking Boulder with ease.',
  'Getting outside with Maple, living in gratitude, managing my part of any conflict, and being honest about my own needs.',
];

/** Coach one turn, then record the refinement — returns the engine's proposal card. */
function proposalFor(items: string[], tiers: string[], top3: string[]): string {
  const opened = reclaimC1Opening(items);
  let state = opened.state as ConvState;
  const coached = applyReclaimC1Turn(state, [], 'Still feels right.', { text: 'What still lands for you?' });
  state = coached.state as ConvState;
  const t = applyReclaimC1Turn(state, [], "it's right", {
    text: 'Got it.',
    refinement: {
      items: items.map((text, i) => ({ original: text, text, tier: tiers[i]! })),
      top3,
    },
  } as never);
  return t.reply;
}

test('a three-item list is not handed back its own three as "the three you\'d move on next"', () => {
  const card = proposalFor(HERS, ['top', 'important', 'emerging'], HERS);
  assert.ok(card.includes("Here's your list, refined:"), 'the card still shows the list');
  assert.ok(!card.includes("The three you'd move on next"), 'a top-3 that IS the list narrows nothing — omit it');
  for (const item of HERS) {
    assert.equal(card.split(item).length - 1, 1, `"${item.slice(0, 32)}…" appears exactly once`);
  }
});

test('a top-3 that genuinely narrows a longer list is still shown — and ends in one period', () => {
  const seven = [...HERS, 'Read again.', 'Call my brother.', 'Sleep seven hours.', 'Cook on Sundays.'];
  const card = proposalFor(seven, ['top', 'top', 'important', 'important', 'emerging', 'emerging', 'emerging'], HERS);
  assert.ok(card.includes("The three you'd move on next"), 'three out of seven is a real selection');
  // Her items are sentences that already end in a period; the line used to add a second one.
  assert.doesNotMatch(card, /\.\./, 'no doubled full stop');
});

test('the model is told not to print the list or run its own save gate', () => {
  assert.match(REFINE_SYSTEM, /NEVER PRINT THE LIST/);
  assert.match(REFINE_SYSTEM, /never\s+ask them to confirm saving it/);
  assert.match(REFINE_SYSTEM, /THREE OR FEWER ITEMS/);
});
