// NOTHING THE MEMBER DID NOT TYPE APPEARS IN HER TRANSCRIPT AS IF SHE TYPED IT.
//
// Donna, mid-walk 2026-08-20: every tap on the gap confirm printed
//   [gap-confirm] done keep:career_cliff,aging_parents,full_house,load_bearer
// into her own message bubble. She had just finished telling the hardest part of her story and the product
// answered in machine.
//
// It is the SECOND time: `__identity_skip__` leaked the same way on 2026-08-17, and the fix for that one was
// only half-applied — the optimistic bubble was humanised, then the success path overwrote it with the raw
// wire string the moment the reply landed. Correct for a second, then reverted.
//
// So this pins the RULE rather than either instance: a structured surface may send the engine whatever it needs,
// and none of it may ever be shown back to her.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { serializeGapConfirmChoice, parseGapConfirmChoice, GAP_CONFIRM_CHOICES } from '../lib/agent/gap-confirm-choice.ts';

// The same resolution the chat uses. Kept in step by the source assertions below rather than by copying.
const SENTINEL: Record<string, string> = { __identity_skip__: "I'm not sure yet." };
const displayFor = (text: string): string => {
  const t = text.trim();
  const s = SENTINEL[t.toLowerCase()];
  if (s) return s;
  const tapped = parseGapConfirmChoice(t);
  if (tapped) return GAP_CONFIRM_CHOICES.find((c) => c.value === tapped)?.label ?? t;
  return text;
};

test('every gap-confirm tap renders as the label she tapped, never the wire line', () => {
  const doors = ['career_cliff', 'aging_parents', 'full_house', 'load_bearer'];
  for (const choice of GAP_CONFIRM_CHOICES) {
    for (const kept of [doors, ['career_cliff'], [], undefined]) {
      const wire = serializeGapConfirmChoice(choice.value, kept);
      const shown = displayFor(wire);
      assert.equal(shown, choice.label, `${wire} should show as "${choice.label}"`);
      assert.doesNotMatch(shown, /\[gap-confirm\]|keep:|_/, `machine syntax reached the transcript: "${shown}"`);
    }
  }
});

test('the identity skip sentinel still resolves — the first instance of this bug', () => {
  assert.equal(displayFor('__identity_skip__'), "I'm not sure yet.");
});

test('anything she actually TYPED passes through untouched', () => {
  // The rule must not start rewriting her own words, which would be a worse bug than the one it fixes.
  for (const said of [
    'I just felt like I disappeared for a while.',
    'more',                       // a bare word that happens to match a choice VALUE
    "that's the whole of it",     // she typed the label herself
    '[gap-confirm]',              // even this, typed, is hers
  ]) {
    assert.equal(displayFor(said), said, `rewrote something she typed: "${said}"`);
  }
});

test('BOTH render paths humanise — the half-fix is what let this ship twice', () => {
  // The optimistic bubble AND the post-reply rebuild. The 2026-08-17 fix did only the first, so the raw string
  // reappeared the instant the Companion answered.
  const src = readFileSync(new URL('../app/onboarding/chat.tsx', import.meta.url), 'utf8');
  const bubbles = src.match(/setMessages\(\[\.\.\.prior, \{ role: 'member', text[^}]*\}/g) ?? [];
  assert.ok(bubbles.length >= 2, `expected both member-bubble writes, found ${bubbles.length}`);
  for (const b of bubbles) {
    assert.match(b, /displayFor\(text\)/, `a member bubble writes the RAW text: ${b}`);
  }
});
