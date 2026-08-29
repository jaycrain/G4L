// THE IDENTITY IS THE MEMBER'S TO NAME — GROUNDED IN CODE, NOT ASKED FOR IN A PROMPT.
//
// Walked 2026-08-30. A member who said only that she "used to run marathons and was the one everyone leaned on at
// work" was recorded as **the Sovereign** — a word she never used — and the Companion addressed her by it in the
// same turn: "take me back into being the Sovereign."
//
// Two HARD rules from the AI Governance Framework, not style preferences:
//   · never name an identity label without member confirmation
//   · address the member as "you" — never by their Identity
//
// `name_identity` already permitted itself "ONLY when the member flatly names it themselves". Prompt-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, stagedOpening, identityIsGrounded } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const described = (): Turn => {
  const open = stagedOpening();
  return applyStagedTurn(open.state as ConvState, [], 'I used to run marathons and I was the one everyone leaned on at work.',
    { text: 'Mm.', record: { athleticPast: 'ran marathons; the one everyone leaned on' } } as never);
};

test('an invented handle is refused, and she is never addressed by it', () => {
  const t = applyStagedTurn(described().state as ConvState, [], 'Yeah, that is about right.',
    { text: 'I think of you as the Sovereign.', record: { identityNoun: 'Sovereign' } } as never);
  assert.equal((t.state as ConvState).collected.identityNoun, undefined, 'a word she never said is not her identity');
});

test('but her own word, however the model spells it, IS hers', () => {
  // The point of grounding is to keep the capture when it is real. Rejecting these would recreate CAT-54, where
  // refusing the model's identity record produced fifteen consecutive re-prompts for a question she had answered.
  for (const [noun, said] of [
    ['Runner', 'I used to run marathons.'],
    ['Racer', 'I raced bikes every weekend.'],
    ['the Builder', 'I built the whole thing from nothing.'],
    ['Carer', 'I cared for my dad for three years.'],
  ] as const) {
    assert.equal(identityIsGrounded(noun, said), true, `"${noun}" is grounded by "${said}"`);
  }
});

test('a miss costs a chip, not a capture — which is why loose is safe but not required', () => {
  // "Maker" from "I made things" fails: make/made is irregular morphology no prefix can bridge. That is an
  // ACCEPTED miss, and the reason it is acceptable is the fallback. A rejected model handle does not end the beat
  // — the chips flow offers candidates and she taps one, which is the DESIGNED capture path. So a false negative
  // costs her a tap; a false positive costs her a name she never chose. Only the second is a governance breach.
  assert.equal(identityIsGrounded('Maker', 'I made things with my hands.'), false, 'documented miss, not a bug');
});

test('the beat still completes normally when the handle is refused', () => {
  // The guard must not strand anyone. After a refusal the stage is unchanged and the conversation continues —
  // this is the assertion that separates "refused it" from "broke it".
  const t = applyStagedTurn(described().state as ConvState, [], 'Yeah.',
    { text: 'Maybe the Sovereign?', record: { identityNoun: 'Sovereign' } } as never);
  assert.equal((t.state as ConvState).stage, 'identity', 'still in the beat, not stranded');
  assert.ok(t.reply.trim().length > 0, 'and the Companion still speaks');
});

test('the evidence is HER material only — never the model’s own reflections', () => {
  // The Door filter above it makes the same distinction for the same reason: a model that can quote itself into
  // evidence can ground anything it invents.
  assert.equal(identityIsGrounded('Sovereign', 'I think of you as the Sovereign.'), true,
    'the predicate itself is text-only — the CALLER is what must pass her material, and mergeStaged does');
});
