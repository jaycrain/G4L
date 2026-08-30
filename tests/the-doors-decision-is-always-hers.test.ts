// THE DOORS DECISION IS ALWAYS HERS, AND ALWAYS EXPLICIT.
//
// Jay, 2026-08-30: "There should be NO alternative to a Member than accepting or de-selecting chips offered up in
// Onboarding Doors from the conversation. If the only downside is we didn't offer one that we should have then it
// gets picked up in R2. That's perfectly acceptable."
//
// THE HOLE THIS CLOSES. The kept-Doors list is only sent when she TAPS — gap-confirm.tsx builds it from the chips
// she did not drop. Answering in words instead ("yes, that's the whole of it") sends no list, and the engine then
// keeps every Door it inferred. So the surface built to give her the final say handed it back to the Companion
// for anyone who typed.
//
// She can still say anything. "There's more" and "Not quite right" both clear the confirm and return the composer
// on the very next turn — she just rules on the Doors on the way past.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { showComposer } from '../lib/chat/composer.ts';

const CHAT = readFileSync(new URL('../app/onboarding/chat.tsx', import.meta.url), 'utf8');

test('the Doors confirm replaces the composer — chips are the only answer', () => {
  // Structural: gap_confirm must be its OWN branch, not the fall-through that also renders the form.
  const branch = CHAT.slice(CHAT.indexOf("expects?.kind === 'gap_confirm' ?"), CHAT.indexOf('<form className="chat-input"'));
  assert.ok(branch.includes('<GapConfirm'), 'the chips render in their own branch');
  assert.ok(!branch.includes('<form'), 'and no composer renders beside them');
});

test('the shared rule already said so — this surface just never consulted it', () => {
  // showComposer has always classified a structured answer-carrying surface as composer-free. gap_confirm is not
  // in SHORTCUT_KINDS, so the helper would have hidden the box all along; onboarding hard-coded the form instead.
  assert.equal(showComposer({ kind: 'gap_confirm' }, false), false, 'the helper hides the box at the Doors confirm');
  assert.equal(showComposer({ kind: 'beat_confirm' }, false), true, 'a plain confirm still keeps it');
  assert.equal(showComposer({ kind: 'reclaim_list' }, false), false, 'the builder still replaces it');
  assert.equal(showComposer(null, false), true, 'an ordinary conversational turn keeps it');
});

test('she can still say anything — the chips route to it, they do not block it', () => {
  // "There's more" and "Not quite right" are two of the three chips, and both reopen the draw-out. The engine
  // clears awaitingConfirm on an addition, which is what brings the composer back on the next turn.
  const engine = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8');
  const addition = engine.slice(engine.indexOf("} else if (intent === 'addition')"));
  assert.match(addition.slice(0, 3200), /b\.awaitingConfirm = false/, 'an addition clears the confirm, returning the box');
});
