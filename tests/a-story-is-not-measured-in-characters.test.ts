// THE NEVER-STRAND FLOOR WAS MEASURED BACKWARDS.
//
// When several gap turns pass with nothing captured, a backstop sweeps the conversation so the member is not
// stranded looping the same question. What it stores becomes their fade story: read back at the confirmation
// card, carried by the Companion, and the thing the program routes on.
//
// It decided "is there enough here" with `corpus.length >= 40`. Length is the one measure that cannot tell a
// story from a shrug, and these are both 45 characters:
//
//   "The restaurant closed and my mother moved in."     ← a real chapter
//   "Not really sure. Hard to say. Maybe? I dunno."     ← a shrug, stored as her account of her own life
//
// It was also too high for a terse real fade — "Knee. Then the divorce." is 23 characters — though that half
// turned out to be narrower than it sounded: the ordinary fade matcher accepts that string, so the backstop is
// never asked. Checked rather than repeated; the first test below records it. The shrug is what reached members.
// (Jay raised this 2026-09-02 as the oldest item on the list.)
//
// THE FIX IS TWO WAYS IN, because there are two kinds of real answer and no single test covers both:
//   · a FADE SIGNAL at any length — a Door named, a loss verb, reduction language. Admits the terse one, and runs
//     on the same vocabulary the fade gate itself uses.
//   · otherwise, prose that is not merely hedging AND has some substance. Keeps the chapter that names no Door
//     and uses no loss verb.
//
// The asymmetry that settles the direction, and it is not symmetric: a false positive costs a member one more
// turn of being asked. A false negative writes "maybe, I dunno" into the record as how their life narrowed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { isMostlyHedging } from '../lib/agent/onboarding-intent.ts';
import type { ConvState, Collected, ConvMessage } from '../lib/agent/onboarding.ts';

/** The backstop fires after several gap turns with nothing captured — so drive it there, not at a hand-set flag. */
function afterSilentGapTurns(said: string[]): ConvState & { reply?: string } {
  const history: ConvMessage[] = [
    { role: 'agent', text: 'Somewhere the distance started to open — an accumulation of what we call Doors. What pulled you away?' },
    ...said.slice(0, -1).flatMap((t) => ([
      { role: 'member' as const, text: t }, { role: 'agent' as const, text: 'Go on.' },
    ])),
  ];
  const state: ConvState = { stage: 'gap', collected: {} as Collected, stageScratch: { gap: { gapTurns: 4 } } } as ConvState;
  const t = applyStagedTurn(state, history, said[said.length - 1]!, { text: '' });
  return { ...(t.state as ConvState), reply: t.reply };
}

const gapOf = (s: ConvState) => ((s.collected as Collected).gap ?? '').trim();

test('A TERSE REAL FADE IS KEPT — and it never reaches the backstop at all', () => {
  // 23 characters, two Doors. It is kept, and the honest note is that this test PASSES AGAINST THE OLD FLOOR TOO:
  // `shouldCaptureStagedGap` accepts this string on the ordinary path, so the backstop is never consulted and the
  // character floor never got a vote. Checked rather than assumed, because a test whose name claims to prove the
  // fix while passing without it is worse than no test.
  //
  // So the terse-fade half of this defect only bites when the fade matcher ALSO misses — rarer than it sounded,
  // and the shrug half below is what was actually reaching members. Kept because it pins the good behaviour: the
  // new signal branch is what would hold it if the matcher were ever tightened. [[existence-is-not-the-assertion]]
  const gap = gapOf(afterSilentGapTurns(['Knee. Then the divorce.']));
  assert.match(gap, /knee|divorce/i, 'a real fade story was dropped for being brief');
});

test('A SHRUG IS NOT KEPT — the case the character floor accepted', () => {
  // 45 characters, exactly as long as a real chapter, and it would have been read back to her at the card as her
  // own account of how her life narrowed.
  for (const shrug of [
    'Not really sure. Hard to say. Maybe? I dunno.',
    "um, I don't know, maybe, sort of, I guess it is hard to say",
  ]) {
    const gap = gapOf(afterSilentGapTurns([shrug]));
    assert.equal(gap, '', `a shrug was stored as her fade story: "${gap}"`);
  }
});

test('a real chapter with NO Door and NO loss verb still survives', () => {
  // The regression the signal test alone would have caused, and it is Donna's actual shape: matchDoors finds
  // nothing here, hasGenuineLoss is false. Only the second branch keeps it, which is why both exist.
  const gap = gapOf(afterSilentGapTurns(['The restaurant closed and my mother moved in.']));
  assert.match(gap, /restaurant closed/i, 'a real chapter was dropped because it named no Door');
});

test('a leading hedge does not kill the story behind it', () => {
  // "I don't know how I got here, but…" is how people actually start. Stripping hedges must not strip the answer.
  const gap = gapOf(afterSilentGapTurns([
    "I don't know how I got here, but the restaurant closed and I stopped cooking for myself.",
  ]));
  assert.match(gap, /restaurant closed/i);
});

test('the hedge detector reads phrases, not length', () => {
  assert.equal(isMostlyHedging('Not really sure. Hard to say. Maybe? I dunno.'), true);
  assert.equal(isMostlyHedging(''), true);
  assert.equal(isMostlyHedging('The restaurant closed and my mother moved in.'), false);
  assert.equal(isMostlyHedging('Knee. Then the divorce.'), false);
  // A member using a hedge INSIDE a real answer is not hedging.
  assert.equal(isMostlyHedging('Maybe it was the divorce, but the job went first.'), false);
});

// A NO-FADE MEMBER'S OWN WORDS ARE NOT A FABRICATED FADE — and my first version of this test said they were.
//
// Greg Welk walked in on 2026-09-03 opening with "I don't perceive a gap", and his record stores that whole
// answer as his gap. I read the standing rule — "we never fabricate a Fade to admit anyone; nothing writes a gap
// or a Door for him" — asserted the field must be EMPTY, and had a red test against correct code.
//
// The rule forbids INVENTING. Storing what he actually typed, verbatim, in answer to the question we asked, is
// the opposite of inventing: it is the only honest thing in the field. Emptying it would throw away the real
// material he gave us — "the classic midlife wondering, windows of opportunity closing as I age" — and leave the
// Companion knowing nothing about a member who had just explained himself at length.
//
// So the invariant is about PROVENANCE, not emptiness: every word came from him, and no Door was written from it.
// [[read-the-whole-path-before-proposing]]
test('a no-fade member keeps his OWN words, and no Door is invented from them', () => {
  const GREG = "I don't perceive a gap. I've spent my life active and I still am — bikepacking, adventures with my "
    + 'kids, and my work aligns with my passion. I maintain both pretty well. What I do feel, at 62 and healthy, is '
    + 'the classic midlife wondering — windows of opportunity closing as I age.';
  const out = afterSilentGapTurns([GREG]);
  const gap = gapOf(out);

  // His words, not ours. Nothing added, nothing characterised.
  assert.ok(gap === '' || GREG.includes(gap.slice(0, 40)),
    `the stored gap is not his own words: "${gap.slice(0, 80)}"`);
  assert.doesNotMatch(gap, /fade|loss|lost|drift/i, 'no fade vocabulary of ours was put into his account');

  // And the thing the rule actually protects: no Door asserted off the back of it.
  const doors = (out.collected as Collected).doors ?? [];
  assert.deepEqual(doors, [], `a Door was written for a member who says he has no gap: ${JSON.stringify(doors)}`);
});

test('SHE IS MOVED ON, NOT ASKED AGAIN — refusing to store must not become a loop', () => {
  // The mirror failure, and dropping the character floor created it: advancement is gated on having a gap, so a
  // corpus we decline to store left the stage re-asking. The repeat guard measured the openers converging at 82%
  // on exactly this walk. Fabricating a fade and interrogating someone who has none are both failures; the
  // no-Door-yet path is the third option, and it already existed.
  const out = afterSilentGapTurns(['I guess so', 'not sure', 'hard to say', 'maybe work']);
  assert.equal(gapOf(out), '', 'hedging was stored as her fade story');
  assert.equal(out.stage, 'reclaim', 'she was left in the gap stage to be asked a fifth time');
});

test('the no-Door-yet reply never says the absence back to her as a label', () => {
  // Descriptive of the record, never a thing said to a member. "No Fade", "no gap", "nothing to work on" told to
  // someone who came here anyway is the sentence that ends a membership.
  const out = afterSilentGapTurns(['I guess so', 'not sure', 'hard to say', 'maybe work']);
  const reply = (out as unknown as { reply?: string }).reply ?? '';
  assert.doesNotMatch(reply, /no (fade|gap|door)|nothing to (work on|reclaim)/i);
});
