// A MEMBER'S OBJECTION IS NOT PART OF THEIR FADE STORY.
//
// Found by the gate on 2026-09-02, on a run that PASSED. Every Session closed, one ask per bubble, nothing
// repeated — and this was stored as the member's gap:
//
//   "…You just asked me that. That's what the last twenty minutes have been — me telling you what pulled me away
//    from her. The closing, my mother, the invisible work. I already answered it."
//
// Her complaint about being asked twice, filed as her account of how her life narrowed. It would be read back to
// her at the confirmation card, and carried by the Companion for as long as she uses the product.
//
// WHY THE FADE MATCHER SAID YES, and why tightening it is the wrong instinct: the sentence NAMES HER DOORS. She
// was listing what she had already told us, so it looks exactly like a chapter. No amount of content analysis
// separates "here is my story" from "I already gave you my story" — the words are the same words.
//
// THE GUARD ALREADY EXISTED AND RAN SOMEWHERE ELSE. isConversationalMeta carries an ALREADY_ANSWERED matcher and
// was built for this sentence; isAboutTheApp was written for the neighbouring shape. Both were wired into the
// Reclaim List — canBeReclaimItem is canBeGapChapter's twin — and neither reached the gap. Fifth instance this
// week of a rule that exists and runs in one place.
//
// AND THIS IS NOT THE WORK THAT GOT REVERTED. Stage-agreement inferred the member had diverged and then captured
// what she said next, reciting her protest back as a goal; it was reverted and its note calls the idea dead. This
// only DECLINES to store a shape we already refuse elsewhere. Excluding is safe where inferring is not: the worst
// case is a chapter she has to repeat, not a sentence of ours put in her mouth.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeGapChapter, shouldCaptureStagedGap } from '../lib/agent/onboarding-intent.ts';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

/** Verbatim, from the two members who produced this shape a day apart. */
const MARIE = "You just asked me that. That's what the last twenty minutes have been — me telling you what pulled "
  + 'me away from her. The closing, my mother, the invisible work. I already answered it.';
const DONNA = 'You already asked me that. I just answered it — both, with the Load-Bearer sitting underneath.';

// MY FIRST DIAGNOSIS WAS WRONG AND THE RED CHECK CAUGHT IT — kept here because the wrong answer is instructive.
//
// I assumed the protest was appended by the ordinary gap capture, wrote a guard for that path, and asserted the
// fade matcher would have accepted it. It does not: shouldCaptureStagedGap REFUSES both protests, so that path was
// never the one. Reverting the "fix" changed nothing, which is how I found out.
//
// The real door was the never-strand BACKSTOP: when no single turn has qualified as a fade, it sweeps the whole
// conversation into the gap so the member is not stranded. That is where her complaint — and her identity answer,
// and her tapped handle — came from.
test('TWO DOORS, one per member — and the fade matcher only closes one of them', () => {
  // DONNA'S protest NAMES A DOOR ("with the Load-Bearer sitting underneath"), because she was listing what she had
  // already told us. The fade matcher accepts it — correctly, on content — so hers would have been appended by the
  // ordinary capture. canBeGapChapter is what stops it.
  assert.equal(shouldCaptureStagedGap(DONNA), true, 'hers reads as fade content, which is why content cannot decide');
  assert.equal(canBeGapChapter(DONNA), false, 'and it must still never become a chapter');

  // MARIE'S does not name a Door, so the matcher refuses it and the append path was never her way in. Hers came
  // through the never-strand backstop, which is a different door and needs a different fix.
  assert.equal(shouldCaptureStagedGap(MARIE), false);
  assert.equal(canBeGapChapter(MARIE), false);
});

test('DONNA\'S DOOR: a protest that names a Door is not appended to the gap', () => {
  const at: ConvState = { stage: 'gap', collected: { gap: 'The restaurant closed.' } as Collected };
  const gap = (applyStagedTurn(at, [], DONNA, { text: '' }).state.collected as Collected).gap ?? '';
  assert.ok(!/already asked me that/i.test(gap), `the protest was appended: "…${gap.slice(-70)}"`);
  assert.match(gap, /restaurant closed/i, 'and what she really said survives');
});

test('a real chapter still lands, including a terse one', () => {
  // THE FAILURE THAT WOULD BE WORSE. Over-excluding loses the story a member came here to tell, and a terse fade
  // ("Knee. Then divorce.") is exactly what an over-eager filter drops — the case the fade matcher was already
  // hardened for once, after a member was declined on eleven words.
  for (const chapter of [
    'The restaurant closed and my mother moved in the same month. I stopped cooking for myself after that.',
    'Knee. Then the divorce.',
    'I lost my job two years ago. Not just a job — I had spent years building toward it.',
  ]) {
    assert.equal(canBeGapChapter(chapter), true, `a real chapter was refused: "${chapter.slice(0, 50)}…"`);
  }
});

test('MARIE\'S DOOR: the backstop sweeps her story and leaves the protest behind', () => {
  // The actual failing shape: several gap turns, nothing captured, so the never-strand backstop fires and stores
  // the corpus. Her chapters must survive it; her complaint must not.
  const said = [
    'The restaurant closing was the big door — obvious, loud.',
    'And then within the same month my mother moved in, and I was cooking scrambled eggs instead of running a brigade.',
    'I am still running an operation, but I am invisible in it.',
    MARIE,
  ];
  const history = said.slice(0, -1).flatMap((t) => ([
    { role: 'member' as const, text: t }, { role: 'agent' as const, text: 'Go on.' },
  ]));
  let state: ConvState = { stage: 'gap', collected: {} as Collected, stageScratch: { gap: { gapTurns: 4 } } } as ConvState;
  const out = applyStagedTurn(state, history, MARIE, { text: '' });
  const gap = (out.state.collected as Collected).gap ?? '';

  assert.ok(!/already answered it/i.test(gap), `her protest is in her fade story: "…${gap.slice(-80)}"`);
  assert.match(gap, /restaurant closing/i, 'and the chapters she actually told us must survive');
  assert.match(gap, /mother moved in/i);
});

test('THE CONFIRM IS DIFFERENT: an addition is a chapter by CONTEXT, not by content', () => {
  // The regression my own first pass caused, kept as a guard. At the confirm the member has been ASKED "is there
  // more?", so what they say next belongs in the gap whether or not it independently reads as a fade. "Yeah, there
  // was work too — it piled on" carries no Door and no loss word; requiring content there dropped it silently,
  // which is the exact failure this beat exists to prevent (Jay's walk, 3/5/6: an addition heard as a move-on).
  //
  // So this site excludes ONLY a protest. Two rules, two places, and the difference between them is whether we
  // just asked.
  const at: ConvState = { stage: 'gap', awaitingConfirm: true, collected: { gap: 'Married, kids, stopped competing.' } as Collected };
  const added = (applyStagedTurn(at, [], 'Yeah, there was work too — it piled on and crowded everything out', { text: '' })
    .state.collected as Collected).gap ?? '';
  assert.match(added, /work too/i, 'an addition at the confirm must reach the gap');

  const protested = (applyStagedTurn(at, [], DONNA, { text: '' }).state.collected as Collected).gap ?? '';
  assert.ok(!/already asked me that/i.test(protested), 'but a protest at the confirm still must not');
});
