// THE GAP CONFIRM BECOMES A TAP, NOT A GUESS.
//
// WHY THIS EXISTS. The beat asks "have I got the shape of it — or is there more?" and we classified her free-text
// answer three ways with regex vocabulary. That took five patches in two days — "Yes." re-asked three times
// (Jennifer), "It was primarily around those three things" (cost a day and a reverted module), "that's a fair
// picture of it", "you've said it better than I could", "we've been over this" — and a live walk found two more in
// three runs. One attempt matched "I said yes to the trip that summer", which would have closed the gap
// mid-sentence. English has unlimited ways to say yes; the list cannot be finished.
//
// The product already answered this four times: the Reclaim List became a builder, the identity handle became
// tap-to-pick, the Doors became a board, the instruments became chips. Every high-stakes capture that started as
// free-text inference was replaced with a structured affordance. This is the one gate that never got converted,
// and it is the one still producing bugs.
//
// A tap is a FACT. Everything else is a guess with better odds — including the model's own tag, which is why the
// regexes exist at all (we built them to override it after Jennifer's walk). Upgrading the model is not available:
// capture already runs on the strongest tier (lib/agent/capture-model.ts).
//
// THE TEXT BOX STAYS. She must be able to say something we did not offer, and typed replies still fall through to
// the classifier — which becomes a fallback rather than the primary path. Nothing gets less expressive; the
// ambiguous route just stops being the default one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAP_CONFIRM_CHOICES,
  parseGapConfirmChoice,
  serializeGapConfirmChoice,
  type GapConfirmChoice,
} from '../lib/agent/gap-confirm-choice.ts';

test('the three choices are exhaustive and in the member-first order', () => {
  assert.deepEqual(GAP_CONFIRM_CHOICES.map((c) => c.value), ['more', 'done', 'wrong']);

  // "There's more" LEADS on purpose. The first option is the one the surface signals it expects, and this product
  // never rushes a member off her own story — Greg's own framing is that most people walk through several Doors.
  // Putting "that's it" first would quietly tell her we are ready to move on.
  assert.equal(GAP_CONFIRM_CHOICES[0]!.value, 'more');

  // Labels are in HER voice, not ours — things she would say, not commands we issue.
  for (const c of GAP_CONFIRM_CHOICES) {
    assert.ok(!/^(click|tap|select|choose|confirm|submit)/i.test(c.label), `a command, not her words: ${c.label}`);
    assert.ok(c.label.length <= 28, `too long to read at a glance: ${c.label}`);
  }
});

test('a tap round-trips exactly — the classification becomes a fact', () => {
  for (const c of GAP_CONFIRM_CHOICES) {
    assert.equal(parseGapConfirmChoice(serializeGapConfirmChoice(c.value)), c.value);
  }
});

test('anything she TYPES is not a tap — it falls through to the classifier untouched', () => {
  // The failure to avoid is the reverse of today's: her prose being read as a button press.
  for (const typed of [
    "That's it, that's the whole of it.",
    'There is more actually — my sister that year.',
    'no',
    '',
    'more',            // the bare word she might type is NOT the tap
    "That's not quite right",
  ]) {
    assert.equal(parseGapConfirmChoice(typed), null, `typed prose read as a tap: ${typed}`);
  }
});

test('an unknown or malformed tap is not guessed at', () => {
  // A tap we cannot place must not become one we can. Silently coercing it would put a decision she never made
  // onto the beat that decides whether her story is finished.
  for (const bad of ['[gap-confirm]', '[gap-confirm] sideways', '[gap-confirm] DONE extra', '[gap-confirm]  ']) {
    assert.equal(parseGapConfirmChoice(bad), null, `guessed at a malformed tap: ${bad}`);
  }
});

test('every choice maps to an intent the engine already understands', () => {
  // The point is to REPLACE the guess, not to add a fourth path through the beat. Each tap resolves to exactly the
  // intent the confirm gate already routes on, so nothing downstream changes shape.
  const expected: Record<GapConfirmChoice, 'done' | 'addition' | 'dispute'> = {
    more: 'addition',
    done: 'done',
    wrong: 'dispute',
  };
  for (const c of GAP_CONFIRM_CHOICES) {
    assert.equal(c.intent, expected[c.value], `${c.value} must route to ${expected[c.value]}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// THE SEAM — the tap has to reach the gate, and the gate has to offer it.
//
// The pure layer passing proves nothing about the beat: a parser nobody calls and an expectation nobody emits is
// the exact shape that let the Doors board write nothing while every unit test stayed green.
// ---------------------------------------------------------------------------------------------------------------

import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, ConvMessage, ModelTurn } from '../lib/agent/onboarding.ts';

const GAP = 'I lost the job two years ago. A partnership fell through. Six months later my father nearly died.';
const atGap = (): ConvState => ({ stage: 'gap', collected: { athleticPast: 'Making things', identityNoun: 'Maker', gap: GAP } });

/** Draw out until the beat reflects and waits — that is where the choice belongs. */
function toConfirm(): { state: ConvState; history: ConvMessage[]; expects: unknown } {
  let state = atGap();
  const history: ConvMessage[] = [];
  let expects: unknown = null;
  for (const [m, mt] of [
    ['And the money got tight after that.', { text: 'That is a lot at once.' }],
    ['That was the shape of it.', { text: 'Here is what I have heard.', gapReady: true }],
  ] as [string, ModelTurn][]) {
    const t = applyStagedTurn(state, history, m, mt);
    history.push({ role: 'member', text: m }, { role: 'agent', text: t.reply });
    state = t.state;
    expects = t.expects;
  }
  return { state, history, expects };
}

test('SEAM · the confirm gate OFFERS the choice — it is not a question with no answers', () => {
  const { state, expects } = toConfirm();
  assert.equal(state.awaitingConfirm, true, 'precondition: the beat is waiting on her');
  assert.equal((expects as { kind?: string })?.kind, 'gap_confirm', 'the gate must render its own answers');
  assert.deepEqual((expects as { choices: { value: string }[] }).choices.map((c) => c.value), ['more', 'done', 'wrong']);
});

test('SEAM · a tap CLOSES the beat — no classifier involved', () => {
  const { state, history } = toConfirm();
  const t = applyStagedTurn(state, history, serializeGapConfirmChoice('done'), { text: '', replyIntent: 'more' });
  // replyIntent 'more' is deliberately wrong here: a tap is a fact and must outrank the model's guess.
  assert.equal(t.state.stage, 'reclaim', 'she said that is the whole of it');
});

test('SEAM · a tap of "there’s more" keeps the story open', () => {
  const { state, history } = toConfirm();
  const t = applyStagedTurn(state, history, serializeGapConfirmChoice('more'), { text: 'Tell me.', replyIntent: 'done' });
  assert.equal(t.state.stage, 'gap', 'she said there is more — the model saying done must not close it');
  assert.notEqual(t.state.awaitingConfirm, true, 'and we are drawing out again, not still waiting');
});

test('SEAM · "not quite right" reopens rather than advancing', () => {
  const { state, history } = toConfirm();
  const t = applyStagedTurn(state, history, serializeGapConfirmChoice('wrong'), { text: '', replyIntent: 'done' });
  assert.equal(t.state.stage, 'gap');
  assert.ok(t.state.collected.gap, 'a correction must never wipe what she already told us');
});

test('SEAM · typing still works — the classifier remains the fallback', () => {
  const { state, history } = toConfirm();
  const t = applyStagedTurn(state, history, "That's the whole of it.", { text: '', replyIntent: 'done' });
  assert.equal(t.state.stage, 'reclaim', 'she must never be forced through the chips');
});

test('SEAM · the invitation is ONE question, and the chips are its answers', () => {
  const { state, history, expects } = toConfirm();
  const reply = applyStagedTurn(atGap(), history.slice(0, 2), 'That was the shape of it.',
    { text: 'Here is what I have heard. What was that like for you?', gapReady: true }).reply;

  // The model's own trailing question is dropped — otherwise her three options answer a different question than
  // the one on screen, which is two asks around one decision.
  assert.ok(!/what was that like/i.test(reply), "the model's competing question must not survive");
  assert.equal((reply.match(/\?/g) ?? []).length, 1, 'exactly one question mark on the turn');
  // "does that land" is banned by our own voice rules — the confirm asks "have I got that right" now. Pinned as
  // COPY on purpose: this is the line that asks a member to rule on their own fade story.
  assert.match(reply, /have I got that right the way it happened — or is there more\?$/i);

  // ...and every choice must actually answer it.
  assert.ok(state.awaitingConfirm && (expects as { kind: string }).kind === 'gap_confirm');
});

test('SEAM · the model’s reflection still LEADS — the structure only carries the ending', () => {
  const reply = applyStagedTurn(atGap(), [], 'That was the shape of it.',
    { text: 'Three things inside two years, each one taking something the last had not.', gapReady: true }).reply;
  assert.match(reply, /^Three things inside two years/, 'her story, in her words, comes first');
});

// ---------------------------------------------------------------------------------------------------------------
// DOORS AT INTAKE — propose, then confirm. The riskiest inference in the product.
//
// We tag Doors by matching her prose and then ASSERT them. Jennifer got The Marriage from her FATHER'S divorce, in
// a story where she also said "my marriage is fine". The retired Acceptance Door read "at my age and in this
// economy, I was virtually unhireable" as having quietly surrendered to aging. Those are not near misses — they
// are the product telling a member something false about her own life, in the beat where she is most exposed.
// Guessing wrong is the worst thing this surface can do.
//
// The fix is not another matcher. She sees what we heard, and can take one off. Structure CONFIRMS what the
// conversation elicited — it never asks her to classify herself from a list, which is what a Door picker at intake
// would be, before the metaphor means anything to her. Adding a Door she did NOT tell us about belongs to R2's
// board, where Greg's recognition copy does the work.
// ---------------------------------------------------------------------------------------------------------------

test('DOORS · the confirm shows her the PROPOSAL, so she can rule on it', () => {
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'marriage'] } };
  const t = applyStagedTurn(state, [], 'That was the shape of it.', { text: 'Here is what I heard.', gapReady: true });
  const e = t.expects as { kind: string; doorsHeard?: { slug: string; name: string }[] };
  assert.equal(e.kind, 'gap_confirm');
  assert.deepEqual(e.doorsHeard?.map((d) => d.slug), ['career_cliff', 'marriage'], 'both, by name, before she agrees');
  assert.equal(e.doorsHeard?.[0]!.name, 'The Career Cliff', 'named the way she will see it, not a slug');
});

// NOTHING IS TRUE OF HER UNTIL SHE SAYS SO. The three tests below are the propose→confirm contract itself, and
// they are why this beat was rebuilt on 2026-08-20: it used to ASSERT the Doors into `collected.doors` the moment
// the model or the matcher tagged one, and offer a ✕ to undo something already true. Donna's card then told her
// The Full House opened her Fade — over a story with no partner and no children in it — and the first she knew of
// it was reading it under "The Doors you came through that created your Fade".
test('DOORS · a proposal is true of NOTHING until she rules — it never reaches her record on its own', () => {
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'full_house'] } };
  const t = applyStagedTurn(state, [], 'That was the shape of it.', { text: 'Here is what I heard.', gapReady: true });
  assert.deepEqual(t.state.collected.doors ?? [], [], 'the gate is still open — her record says nothing yet');
  assert.deepEqual(t.state.collected.doorsProposed, ['career_cliff', 'full_house'], 'and the proposal is intact');
});

test('DOORS · a DISPUTE is not a ruling on the Doors — the proposal stays pending, uncommitted', () => {
  // She is still telling the story. Committing here would take her "no, that is not quite right" as agreement to
  // the very inference she has not been asked about.
  const state: ConvState = { stage: 'gap', awaitingConfirm: true, collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'full_house'] } };
  const t = applyStagedTurn(state, [], 'no, that’s not quite right', { text: 'Okay.' });
  assert.deepEqual(t.state.collected.doors ?? [], [], 'nothing committed on a dispute');
  assert.deepEqual(t.state.collected.doorsProposed, ['career_cliff', 'full_house'], 'nothing lost either — she sees it again');
});

test('DOORS · taking one off REMOVES it — her word outranks the matcher', () => {
  // Jennifer's case exactly: the story is right, one Door is not hers.
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'marriage'] }, awaitingConfirm: true };
  const t = applyStagedTurn(state, [], serializeGapConfirmChoice('done', ['career_cliff']), { text: '' });
  assert.deepEqual(t.state.collected.doors, ['career_cliff'], 'the one she kept');
  assert.deepEqual(t.state.collected.doorsProposed, [], 'the gate is closed — nothing left pending');
  assert.equal(t.state.stage, 'reclaim', 'and the beat still closes — correcting us is not a dispute');
});

test('DOORS · she can take them ALL off, and the beat still closes with none', () => {
  // The limit case, and the one the old code could not express: every Door we matched was wrong. She finishes
  // intake holding none, which is correct — the card shows no Doors rather than a wrong one, and R2's board opens
  // with all eleven.
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['full_house'] }, awaitingConfirm: true };
  const t = applyStagedTurn(state, [], serializeGapConfirmChoice('done', []), { text: '' });
  assert.deepEqual(t.state.collected.doors ?? [], [], 'none of them were hers, and we do not keep one anyway');
  assert.equal(t.state.stage, 'reclaim');
});

test('DOORS · confirming keeps every Door, and never invents one', () => {
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'marriage'] }, awaitingConfirm: true };
  const t = applyStagedTurn(state, [], serializeGapConfirmChoice('done', ['career_cliff', 'marriage']), { text: '' });
  assert.deepEqual(t.state.collected.doors, ['career_cliff', 'marriage']);
});

test('DOORS · she cannot ADD one here — intake confirms, R2 offers the whole set', () => {
  // A Door she never mentioned has no business appearing at intake: that would be structure doing the eliciting,
  // and it is what R2's board exists for, with Greg's recognition copy behind it.
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff'] }, awaitingConfirm: true };
  const t = applyStagedTurn(state, [], serializeGapConfirmChoice('done', ['career_cliff', 'vanishing']), { text: '' });
  assert.deepEqual(t.state.collected.doors, ['career_cliff'], 'a slug she was never offered is ignored, not added');
});

test('DOORS · a plain tap with no door list leaves them exactly as they were', () => {
  // Backwards compatible on purpose: the surface may send no list at all, and silence must never mean "drop them".
  const state: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker', gap: GAP, doorsProposed: ['career_cliff', 'marriage'] }, awaitingConfirm: true };
  const t = applyStagedTurn(state, [], serializeGapConfirmChoice('done'), { text: '' });
  assert.deepEqual(t.state.collected.doors, ['career_cliff', 'marriage'], 'absent is not a removal — a bare tap confirms the whole proposal');
});
