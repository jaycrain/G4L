import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC1Opening, applyReclaimC1Turn } from '../lib/agent/reclaim.ts';
import { EVIDENCE_ITEMS, EVIDENCE_ITEM_COUNT, EVIDENCE_PART_STARTS, EVIDENCE_PART_LABEL } from '../lib/reclaim/evidence-instrument.ts';
import type { ConvState, ModelTurn } from '../lib/agent/onboarding.ts';

// C1 · Readiness Assessment. Step 1 = the administered evidence self-check (FORMATIVE, RC-2 — nothing scored). It hands
// into Step 2 = the Reclaim List refinement (COACH mode): the model coaches → the engine proposes the refined list →
// only the member's confirm commits it (the commit itself is proven in reclaim-refinement.test.ts).

const m = (text: string, refinement?: ModelTurn['refinement']): ModelTurn => ({ text, ...(refinement ? { refinement } : {}) });

// walk the 15 evidence items → the arc hands into 'refine'
function throughEvidence(list: string[] = []): ConvState {
  let t = reclaimC1Opening(list);
  for (let i = 0; i < EVIDENCE_ITEM_COUNT; i++) t = applyReclaimC1Turn(t.state, [], '4');
  return t.state;
}

test('C1 Step 1 · warm frame → 15 evidence items in three parts → hands into Step 2 (not the whole session)', () => {
  let t = reclaimC1Opening();
  assert.equal(t.state.stage, 'evidence');
  assert.match(t.reply, /recognize in yourself/i, 'the warm frame');
  assert.match(t.reply, /1 \(strongly disagree\) to 5/i, 'the 1–5 scale');
  assert.ok(t.reply.includes(EVIDENCE_ITEMS[0]!.stem), 'item 0 verbatim');
  assert.match(t.reply, /The Physical Evidence/i, 'part A header');

  for (let i = 0; i < EVIDENCE_ITEM_COUNT; i++) {
    assert.equal(t.state.stage, 'evidence', `administering item ${i}`);
    assert.equal(t.complete, false);
    if (i === 5) assert.match(t.reply, new RegExp(EVIDENCE_PART_LABEL[EVIDENCE_PART_STARTS[5]!], 'i'));
    if (i === 10) assert.match(t.reply, new RegExp(EVIDENCE_PART_LABEL[EVIDENCE_PART_STARTS[10]!], 'i'));
    t = applyReclaimC1Turn(t.state, [], '4');
  }
  assert.equal(t.complete, false, 'evidence completing hands into Step 2, not the whole session');
  assert.equal(t.state.stage, 'refine', 'transitions to the refinement coach stage');
  assert.match(t.reply, /ready for the Reclaim phase/i, 'the reflective mirror');
  assert.match(t.reply, /cycle, not a linear checklist/i, 'not all-or-nothing');
  assert.match(t.reply, /revisit it now to make sure it still fits/i, 'the Step 2 transition');
  assert.doesNotMatch(t.reply, /\bscore\b/i, 'RC-2: formative — no score');
});

test('C1 Step 1 · a non-number is re-prompted, not advanced (instrument fidelity)', () => {
  const t = reclaimC1Opening();
  const bad = applyReclaimC1Turn(t.state, [], 'pretty true');
  assert.equal(bad.state.stage, 'evidence', 'a non-Likert answer does not advance');
  assert.equal((bad.state.administeredResponses ?? []).length, 0, 'nothing recorded');
  assert.match(bad.reply, /1 to 5/i, 're-prompts');
});

test('C1 Step 2 · the refine stage presents the member’s current list for the re-read', () => {
  const state = throughEvidence(['be healthier', 'see friends more']);
  assert.equal(state.stage, 'refine');
});

test('C1 Step 2 · coach → propose → confirm; the confirmed refinement lands in the snapshot for commit', () => {
  let state = throughEvidence(['be healthier', 'get my life together']);

  // Turn 1: the member reflects; the model coaches (no record yet) → still coaching, not proposed.
  let t = applyReclaimC1Turn(state, [], 'the first one still matters, the second feels vague now', m('Which words would make the second one truly yours?'));
  assert.equal(t.complete, false);
  assert.match(t.reply, /truly yours/i, "the model's coaching question is the reply");
  assert.equal(t.state.collected?.pendingRefinement, undefined, 'nothing recorded yet');

  // Turn 2: the model records the settled refinement → the engine PROPOSES it (grouped by tier + top-3).
  t = applyReclaimC1Turn(
    t.state,
    [],
    'yeah, stop living in reaction mode',
    m('', {
      items: [
        { original: 'be healthier', text: 'feel physically capable and steady again', tier: 'top' },
        { original: 'get my life together', text: 'stop living in reaction mode', tier: 'important' },
      ],
      top3: ['feel physically capable and steady again'],
    }),
  );
  assert.equal(t.complete, false, 'proposing is not completing');
  assert.match(t.reply, /Top Priorities Now/i, 'the proposal groups by tier');
  assert.match(t.reply, /feel physically capable and steady again/i, 'shows the refined wording');
  assert.match(t.reply, /save this as your Reclaim List|tweak/i, 'the confirm gate');

  // Turn 3: the member confirms → COMPLETE, and the confirmed refinement is in the snapshot for the action to commit.
  t = applyReclaimC1Turn(t.state, [], 'yes, save it', m(''));
  assert.equal(t.complete, true, 'confirm completes');
  assert.equal(t.state.stage, 'complete');
  assert.match(t.reply, /reflects where you actually are/i, 'the committed close');
  assert.equal(t.state.collected?.pendingRefinement?.items.length, 2, 'the snapshot the action commits');
  assert.equal(t.state.collected?.pendingRefinement?.items[0]!.tier, 'top');
});

test('C1 Step 2 · an out-of-taxonomy tier is dropped from the snapshot (only valid tiers commit)', () => {
  const state = throughEvidence(['be healthier']);
  const t = applyReclaimC1Turn(
    state,
    [],
    'done',
    m('', { items: [{ original: 'be healthier', text: 'be healthier', tier: 'someday' }], top3: [] }),
  );
  // 'someday' isn't a valid tier → sanitized out → nothing ready → still coaching, not proposed.
  assert.equal(t.state.collected?.pendingRefinement, undefined, 'invalid tier never enters the snapshot');
});
