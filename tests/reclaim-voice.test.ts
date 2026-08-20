// A WANT WRITTEN IN SECOND PERSON WAS WRITTEN BY THE MODEL, NOT THE MEMBER.
//
// Donna's walk, 2026-08-19 — the first complete four-R walk. Her top Reclaim item was stored as:
//
//   "A creative role that covers the bills each month, then lets YOU rebuild savings and pay off the debt"
//
// Nobody says "you" to themselves about their own life. That sentence is the Companion talking TO her, tagged
// during her gap story with add_reclaim_item, seeded into the builder, and accepted without edit — so a sentence
// she never said became the top item the whole program measures her against. Her other two are plainly hers
// ("Lose the 20 lbs", "Less day-to-day conflict"), which is what makes the odd one legible.
//
// WHY A PRONOUN IS ENOUGH. This is not a quality judgement about the wording — those are unreliable and we have
// been burned by them. It is a PROVENANCE test with one job: second person is proof the model DRAFTED rather than
// QUOTED, because the instruction is to capture her words exactly and her words are never addressed to her.
//
// WHY IT IS SAFE TO DROP RATHER THAN STORE. Only the model-tag path is checked. A builder submission is her own
// typing and is never touched, whatever it says — that guarantee is the whole reason the builder exists. And the
// tag is a CONVENIENCE (it seeds the builder so she needn't type it twice), not the capture of record. The
// capture of record is her submission, which enforces the >=MIN floor — so dropping a bad seed can never produce
// a short list; it can only cost her retyping a want she is, at that moment, in the middle of discussing.
//
// The alternative is worse and it is what happened: a fabricated sentence sitting on her dashboard for a year.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isModelVoiced } from '../lib/agent/reclaim-voice.ts';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

test('Donna\'s actual item — the one that shipped — is caught', () => {
  assert.equal(
    isModelVoiced('A creative role that covers the bills each month, then lets you rebuild savings and pay off the debt from this period'),
    true,
  );
});

test('her two GOOD items are untouched — this must not fire on ordinary wants', () => {
  assert.equal(isModelVoiced('Lose the 20 lbs — and feel it: lighter, good in clothes, moving well'), false);
  assert.equal(isModelVoiced('Less day-to-day conflict — peace and optimism in its place'), false);
});

test('first person is the member — always kept', () => {
  assert.equal(isModelVoiced('I want my energy back'), false);
  assert.equal(isModelVoiced('Get my Saturdays back with my kids'), false);
  assert.equal(isModelVoiced('Time to myself'), false);
});

test('every second-person form, since the model varies its phrasing', () => {
  assert.equal(isModelVoiced('A rhythm that works for you'), true);
  assert.equal(isModelVoiced('Your mornings back'), true);
  assert.equal(isModelVoiced("Work that's yours again"), true);
  assert.equal(isModelVoiced("Something that's you're proud of"), true);
  assert.equal(isModelVoiced('Time for yourself, without guilt'), true);
});

test('the pronoun must be a WORD — no substring false positives', () => {
  // "your" inside "journey", "you" inside "young" — a substring match would eat real wants.
  assert.equal(isModelVoiced('Feeling young again'), false);
  assert.equal(isModelVoiced('Being useful to my crew'), false);
  assert.equal(isModelVoiced('Yoga twice a week'), false);
});

test('capitalisation and punctuation do not let one through', () => {
  assert.equal(isModelVoiced('You, rested.'), true);
  assert.equal(isModelVoiced('The life YOUR family remembers'), true);
});

test('empty and whitespace are not "model voiced" — they are just empty', () => {
  assert.equal(isModelVoiced(''), false);
  assert.equal(isModelVoiced('   '), false);
});

// ---------------------------------------------------------------------------
// THE SEAM. Both halves of the Doors board passed alone while nothing crossed between them, so the action would
// have persisted nothing — silently. A pure function plus a call site is the same shape, and the call site is the
// half that carries the actual claim: that the check fires on the MODEL path and cannot reach the member's own.
// ---------------------------------------------------------------------------
const atReclaim = (): ConvState => ({
  stage: 'reclaim',
  collected: { identityNoun: 'Maker', gap: 'The job went, then the partnership, then my father nearly died.' },
});

test('SEAM — a model-voiced tag never reaches the list (Donna\'s exact turn)', () => {
  const t = applyStagedTurn(atReclaim(), [], 'I need work that actually pays the bills.', {
    text: 'The bills.',
    record: { reclaimList: ['A creative role that covers the bills each month, then lets you rebuild savings'] },
  });
  assert.deepEqual(t.state.collected.reclaimList ?? [], [], 'the Companion\'s own sentence is not a capture');
});

test('SEAM — a properly quoted tag on the same turn DOES land', () => {
  const t = applyStagedTurn(atReclaim(), [], 'I need work that actually pays the bills.', {
    text: 'The bills.',
    record: { reclaimList: ['work that actually pays the bills'] },
  });
  assert.deepEqual(t.state.collected.reclaimList, ['work that actually pays the bills']);
});

test('SEAM — the BUILDER is untouchable: her own "you" survives', () => {
  // The guarantee the builder exists to give. If this ever fails, the check has leaked onto her words and the
  // fix is worse than the bug it replaced — she typed it, so it is the list, whatever it says.
  const drawn = applyStagedTurn(atReclaim(), [], 'I want a few things.', { text: 'Go on.', replyIntent: 'done' });
  const t = applyStagedTurn(
    drawn.state,
    [],
    '• A rhythm that works for you\n• Lose the 20 lbs\n• Less conflict',
    { text: '' },
  );
  assert.deepEqual(t.state.collected.reclaimList, ['A rhythm that works for you', 'Lose the 20 lbs', 'Less conflict']);
});

// ── NEVER DROP WHAT SHE GAVE YOU ───────────────────────────────────────────────────────────────────────────────
//
// The guard above is right that a second-person sentence was composed by the model and must not be COMMITTED as
// her words. It was wrong about what to do next: it discarded the item, and with it the want underneath.
//
// "Get your fitness back" is the model's phrasing of something she actually said. Dropping it means the builder
// opens NOT holding it, so she has to say the same thing twice — or, if she doesn't notice the omission, the want
// is simply gone. That is the ~30% loss the builder was introduced to end, reintroduced by a guard meant to
// protect capture. (Donna, 2026-08-20: two of her three wants were this exact shape.)
//
// So a model-voiced item is not truth, but it IS a seed: it goes to the builder as a proposal she rules on, in
// the one place where what she submits is authoritative and verbatim. Propose → confirm, exactly like the rest.


test('a model-voiced want is SEEDED for her to confirm, never committed and never lost', () => {
  const state: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: 'A hard two years.' } };
  const turn = applyStagedTurn(state, [], 'I want my fitness back and the weight off.', {
    text: 'That matters. What else?',
    record: { reclaimList: ['Get your fitness back', 'Lose the 20 lbs you gained'] },
  });

  // NOT committed on the model's authority — that part of the rule stands.
  assert.deepEqual(turn.state.collected.reclaimList ?? [], [], 'model-voiced text must never become a stored item');

  // …but NOT thrown away either. It must reach her.
  const seeds = turn.state.collected.reclaimSeeds ?? [];
  assert.deepEqual(seeds, ['Get your fitness back', 'Lose the 20 lbs you gained'], 'the wants must survive as seeds');
});

test('the builder opens HOLDING the seeds, so she never says the same thing twice', () => {
  let state: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: 'A hard two years.' } };
  const t1 = applyStagedTurn(state, [], 'My fitness.', {
    text: 'What else?',
    record: { reclaimList: ['Get your fitness back'] },
  });
  state = t1.state;
  // She closes the beat; the builder opens.
  const t2 = applyStagedTurn(state, [], "That's everything.", { text: 'Understood.', replyIntent: 'done' });
  assert.equal(t2.expects?.kind, 'reclaim_list');
  const seeded = t2.expects?.kind === 'reclaim_list' ? t2.expects.seeded : [];
  assert.ok(seeded.includes('Get your fitness back'), 'the want she named must be in the form when it opens');
});

test('HER OWN typing is never treated as model-voiced, even when it says "you"', () => {
  // The guarantee the builder exists to provide. A submission is hers, whatever words are in it.
  const state: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: 'x' }, stageScratch: { reclaim: { drawnOut: true } } };
  const turn = applyStagedTurn(state, [], '• work that pays you what you are worth\n• get my fitness back\n• peace at home', {
    text: 'Got it.',
  });
  assert.ok(
    (turn.state.collected.reclaimList ?? []).includes('work that pays you what you are worth'),
    'she may write whatever she likes and it stands',
  );
});
