// AGREEING WITH US IS NOT EVIDENCE THAT WE WERE WRONG.
//
// Jay, R2, 2026-08-28. The Companion made a genuinely good observation — "The Body isn't the door, it's where the
// toll from The Relationship and The Grind is showing up on you. Does that sound right, or not quite?" — he said
// "That's correct", and the next thing he read was:
//
//   "Something you said makes me wonder if the door you named isn't quite the one — can you say more, so I get
//    it right?"
//
// He had just said it was right. It asked him to argue with a proposal he had accepted.
//
// THE GUARD FOR THIS ALREADY EXISTED, and its comment describes this exact experience from an earlier walk of
// his: "the Companion answered 'Yes' with 'maybe the door you named isn't quite the one' (twice, on Jay's walk:
// an unearned, repeated challenge to something he'd just confirmed). Propose-never-assert requires substance: no
// bare assent, and enough words to actually carry a redirect."
//
// It was implemented as `t.length >= 12 && !isProcessMetaOrAssent(t)`. That is a test of LENGTH wearing the
// clothes of a test of MEANING. "Yes" was caught by the character count, not because anything understood it as
// agreement — and "That's correct" is fourteen characters, so it walked straight through the guard written to
// stop it. So did "That's right" (twelve) and "Yep that's it" (thirteen).
//
// Four lines below it sat isKeeperMaterial, which correctly calls every one of those non-material. Two
// definitions of "did the member actually say something", in one file, disagreeing about the same sentence.
// That is the shape this codebase keeps paying for. [[member-words-outrank-model-guess]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isKeeperMaterial, applyReconnectTurn, RECONNECT_R2_ARC } from '../lib/agent/reconnect.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// The model signalling "his real door is The Relationship, not The Body" ON THE TURN HE AGREES. That is the
// situation — the model is not wrong to notice, it is wrong to act on agreement as if it were evidence.
// `marriage` is the SLUG behind the display name "The Relationship" — the first version of this fixture used
// 'relationship', which is not a slug, so isDoorSlug rejected it and the branch under test never ran. The test
// passed on both inputs by never reaching the gate at all.
const MODEL_PROPOSES_A_SWAP = {
  text: '',
  revision: { toSlug: 'marriage', kind: 'correct' },
} as never;

const inTheDoorWork = (): ConvState =>
  ({ stage: 'doors', collected: { identityNoun: 'Racer', doors: ['body'], gap: 'x' } }) as ConvState;

/** The reply a member gets when the engine acts on the model's swap — the line Jay was shown. */
const CHALLENGE = /makes me wonder if the door you named isn't quite the one|Does that feel truer/;

// Agreement, in the shapes members actually type. NONE of these may license a challenge to what they just
// confirmed — and note that three of the five clear a twelve-character floor.
const AGREEMENT = [
  "That's correct",   // 14 — Jay's, the one that shipped
  "That's right",     // 12 — exactly on the old floor
  "Yep that's it",    // 13
  'Yes',
  'Correct',
  'Perfectly depicted',
  "that's it exactly",
];

// Agreement that CARRIES something new, or a real redirect. These must still be able to move the door — the fix
// must not buy silence by refusing every follow-up.
const CARRIES_SUBSTANCE = [
  "That's correct, and the weight is really about the wine",
  "Actually it's more about my dad being sick than the marriage",
  'The racing stopped when the film got stressful, not when we started fighting',
];

test('bare agreement can never ground a door revision — driven through the engine', () => {
  // ASSERTED ON THE REPLY, not on the predicate. The first version of this test called isKeeperMaterial
  // directly, which is the predicate the gate now happens to use — so reverting the gate left it green. A test
  // that cannot fail on the bug it was written for is decoration. [[existence-is-not-the-assertion]]
  for (const m of AGREEMENT) {
    const t = applyReconnectTurn(inTheDoorWork(), [], m, MODEL_PROPOSES_A_SWAP, RECONNECT_R2_ARC);
    assert.doesNotMatch(t.reply, CHALLENGE,
      `"${m}" (${m.length} chars) got his agreement answered with a challenge to it`);
  }
});

test('the predicate agrees, for the same reasons', () => {
  for (const m of AGREEMENT) assert.equal(isKeeperMaterial(m), false, `"${m}" reads as material`);
});

test('agreement carrying real material still moves the door', () => {
  // The fix must not buy silence by refusing every follow-up — a member who agrees AND redirects has given us
  // evidence, and the re-seeing is one of the most valuable moves in the phase.
  for (const m of CARRIES_SUBSTANCE) {
    assert.equal(isKeeperMaterial(m), true, `"${m}" is substance and must still be heard`);
    const t = applyReconnectTurn(inTheDoorWork(), [], m, MODEL_PROPOSES_A_SWAP, RECONNECT_R2_ARC);
    assert.match(t.reply, CHALLENGE, `"${m}" carries a redirect and should have been offered the swap`);
  }
});

test('the gate measures substance, not characters', () => {
  // THE STRUCTURAL HALF. A length floor will always be one plausible phrasing away from failing, and every fix
  // to it is another number. The gate reads the same predicate the keeper capture reads, so the two cannot hold
  // different opinions about the same sentence.
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const fn = src.match(/function revisionIsGrounded\([^)]*\)[^{]*\{[\s\S]*?\n\}/)![0];

  assert.doesNotMatch(fn, /\.length\s*>=/, 'a character count is not a test of whether they said anything');
  assert.match(fn, /isKeeperMaterial\(/, 'it must read the one definition of substance this file already has');
});
