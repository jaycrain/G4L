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
import { serializeGapConfirmChoice, GAP_CONFIRM_CHOICES } from '../lib/agent/gap-confirm-choice.ts';
import { memberDisplay } from '../lib/agent/member-display.ts';

// THE REAL RESOLVER, IMPORTED. This file used to carry its own copy of it — a second implementation of the rule,
// sitting in the test that exists to defend the rule. It passed while Reconnect leaked, because the copy was
// correct and the product had two render paths and only one of them knew. It now lives in one place
// (lib/agent/member-display.ts) and this asserts against that.
const displayFor = memberDisplay;

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

test('EVERY chat surface humanises — one file was the half-fix that let this ship a third time', () => {
  // THIS TEST PASSED WHILE THE BUG SHIPPED. It read "BOTH render paths" and checked the two member-bubble writes
  // inside app/onboarding/chat.tsx — two bubbles in ONE file. The other render path was a different FILE:
  // app/reconnect/reconnect-chat.tsx, with its own bubble list, which knew none of this. So the Doors board
  // printed `[board] door:body=2 …` into Donna's transcript on 2026-08-22 (item 11) with this guard green.
  //
  // The lesson is the file's own lesson one level up: a half-fix is not "one of two lines", it is "one of the
  // places this can happen". So this enumerates the SURFACES.
  // Listed explicitly. A new chat surface is a deliberate act, and adding it here is the moment to ask whether
  // it renders member text — which is the question that was never asked when Reconnect got its own bubble list.
  const surfaces = ['../app/onboarding/chat.tsx', '../app/reconnect/reconnect-chat.tsx'];

  for (const rel of surfaces) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');

    // COARSE ON PURPOSE. The first version of this matched each surface's bubble JSX with its own regex, and broke
    // on the nested braces in `<RichText text={m.text} />` — a failing probe reporting a healthy product. What
    // actually matters is not the shape of the render, it is that the surface routes member text through the one
    // resolver at all. That is a question a substring can answer and a regex kept getting wrong.
    assert.match(src, /import \{ memberDisplay \}/, `${rel}: does not import the resolver at all`);
    assert.match(src, /memberDisplay\(/, `${rel}: imports the resolver but never renders through it`);
  }

  // Onboarding additionally has TWO member-bubble writes — the optimistic one and the post-reply rebuild. The
  // 2026-08-17 fix did only the first, so the raw string reappeared the instant the Companion answered.
  const onboarding = readFileSync(new URL('../app/onboarding/chat.tsx', import.meta.url), 'utf8');
  const bubbles = onboarding.match(/setMessages\(\[\.\.\.prior, \{ role: 'member', text[^}]*\}/g) ?? [];
  assert.ok(bubbles.length >= 2, `expected both member-bubble writes, found ${bubbles.length}`);
  for (const b of bubbles) {
    assert.match(b, /memberDisplay\(text\)/, `a member bubble writes the RAW text: ${b}`);
  }
});
