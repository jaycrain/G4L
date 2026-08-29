// THE NO-REPEAT GUARD HAS TO BE REACHABLE FROM EVERY EXIT.
//
// Found by the live persona eval, 2026-08-30 — FOUR of six runs, every one on the reclaim beat:
//   "I've got those 5 written down. Have a look — change the wording…"   × 2, word for word
//   "Put them down here in your own words — big or small…"               × 2, word for word
//
// The guard existed. It sat at the BOTTOM of runArcTurn, and nine handler paths build their own Turn and return
// straight past it — including the reclaim commit, which is where every one of those repeats happened.
//
// The guard's own comment had already made the argument: "A guard whose job is 'never say the same thing twice'
// cannot have an exemption for the case that says it twice." It had nine. [[one-fact-many-sites]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, Turn } from '../lib/agent/onboarding.ts';

const SRC = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('EVERY exit routes its reply through the guard — none returns b.reply raw', () => {
  // The structural half, and the one that actually prevents recurrence: a tenth early return added later must go
  // through noRepeat too, and this fails the moment one does not.
  const raw = [...CODE.matchAll(/return \{[^}]*?\breply: b\.reply\b/g)];
  assert.equal(raw.length, 0, `${raw.length} exit(s) still return b.reply without the guard`);
  assert.ok((CODE.match(/noRepeat\(b,/g) ?? []).length >= 9, 'the guard is applied at every exit, not just one');
});

test('the rule has ONE definition', () => {
  // It was hoisted out of runArcTurn's tail. A second inline copy is how the exits diverged in the first place.
  assert.equal((CODE.match(/const leads = \[/g) ?? []).length, 1, 'the lead-in list exists once');
  assert.equal((CODE.match(/function noRepeat\(/g) ?? []).length, 1, 'one definition');
});

test('the reclaim beat does not ship the same line twice — the shape the eval caught', () => {
  // Under-floor submissions repeat the nudge. Two identical submissions is the real member behaviour that
  // produced this: she adds nothing, submits again, and reads the identical sentence.
  const state = { stage: 'reclaim', collected: { athleticPast: 'raced', identityNoun: 'Racer', gap: 'A long story about how it all went, over several years.' }, doorAsked: true } as never;
  const history: ConvMessage[] = [];
  const submit = (s: ConvState): Turn => applyStagedTurn(s, history, '• ride my bike', { text: '' } as never);
  const first = submit(state);
  history.push({ role: 'member', text: '• ride my bike' }, { role: 'agent', text: first.reply });
  const second = submit(first.state as ConvState);
  assert.notEqual(second.reply, first.reply, 'the second under-floor submission repeated the nudge verbatim');
});

test('but a first emission is never padded', () => {
  // The guard must only fire on an actual repeat. Prepending "No rush at all." to a line the member has not seen
  // would be noise, and noise in a beat this fragile reads as the product stalling.
  const state = { stage: 'reclaim', collected: { athleticPast: 'raced', identityNoun: 'Racer', gap: 'A long story about how it all went, over several years.' }, doorAsked: true } as never;
  const t = applyStagedTurn(state, [], '• ride my bike', { text: '' } as never);
  assert.doesNotMatch(t.reply, /^(Take whatever time|No rush at all|Whenever you're ready|There's no wrong way)/,
    'a first-time line is emitted clean');
});
