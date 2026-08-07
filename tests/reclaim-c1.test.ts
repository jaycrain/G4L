import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimC1Opening, applyReclaimC1Turn, RECLAIM_C1_ARC } from '../lib/agent/reclaim.ts';
import type { ConvState, ModelTurn } from '../lib/agent/onboarding.ts';

// C1 · Looking Forward. ONE stage: the Reclaim List refinement (COACH mode) — the model coaches → the engine proposes
// the refined list → only the member's confirm commits it (the commit itself is proven in reclaim-refinement.test.ts).
//
// It used to open with a 15-item evidence self-check. Greg cut it on 2026-08-07 and held it for Cycle 2, so the arc
// went from two stages to one. The tests that walked those 15 items are gone with them; what replaces them is the
// migration test at the bottom, which is the part that can actually hurt a live member.

const m = (text: string, refinement?: ModelTurn['refinement']): ModelTurn => ({ text, ...(refinement ? { refinement } : {}) });

const opened = (list: string[] = []): ConvState => reclaimC1Opening(list).state;

test('C1 opens straight into the refinement — no assessment in front of it', () => {
  const t = reclaimC1Opening(['be healthier', 'see friends more']);
  assert.equal(t.state.stage, 'refine', 'the first turn IS the coaching stage');
  assert.equal(t.complete, false);
  assert.match(t.reply, /recognize in yourself/i, "Greg's framing line, kept from the old opener");
  assert.match(t.reply, /revisit it now to make sure it still fits/i, 'the re-read invitation');
  assert.match(t.reply, /be healthier/, 'their actual list is on screen');
  // The cut instrument must leave no trace in what the member reads.
  assert.doesNotMatch(t.reply, /1 \(strongly disagree\)|rate each statement/i, 'no rating scale survives');
  assert.doesNotMatch(t.reply, /ready for the Reclaim phase/i, 'and no verdict about whether they qualify');
  assert.doesNotMatch(t.reply, /\bscore\b/i);
});

test('the arc has exactly one stage (a re-added assessment must be a deliberate act)', () => {
  assert.deepEqual(RECLAIM_C1_ARC.stageOrder, ['refine']);
  assert.equal(RECLAIM_C1_ARC.stages.evidence, undefined, 'the evidence stage is unwired, not merely skipped');
});

test('an empty list is still workable — the coach offers to build it', () => {
  const t = reclaimC1Opening([]);
  assert.match(t.reply, /list is empty/i, 'says so rather than showing an empty bullet');
  assert.equal(t.complete, false);
});

test('coach → propose → confirm; the confirmed refinement lands in the snapshot for commit', () => {
  const state = opened(['be healthier', 'get my life together']);

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

test('an out-of-taxonomy tier is dropped from the snapshot (only valid tiers commit)', () => {
  const t = applyReclaimC1Turn(
    opened(['be healthier']),
    [],
    'done',
    m('', { items: [{ original: 'be healthier', text: 'be healthier', tier: 'someday' }], top3: [] }),
  );
  // 'someday' isn't a valid tier → sanitized out → nothing ready → still coaching, not proposed.
  assert.equal(t.state.collected?.pendingRefinement, undefined, 'invalid tier never enters the snapshot');
});

// ── the seam that can strand a real person ────────────────────────────────────────────────────────────────────
// Greg, Dana and Jay all had live C1 sessions when this shipped. A session persisted at stage:'evidence' now points at
// a stage the arc no longer defines — arc.stages['evidence'] is undefined, so the kernel would run a turn with no
// stage definition. Unit-testing the new one-stage arc proves nothing about THEM; this does.

test('MID-FLIGHT SESSION: someone persisted at the retired stage is carried across, not stranded', () => {
  const stranded = {
    stage: 'evidence',
    collected: { reclaimList: ['ride my bike again', 'be present with my kids'] },
    administeredResponses: [4, 5, 3], // three items deep when it was pulled
  } as unknown as ConvState;

  const t = applyReclaimC1Turn(stranded, [], '4', m(''));
  assert.equal(t.state.stage, 'refine', 'moved onto the stage that replaced it');
  assert.equal(t.complete, false, 'their session is not silently closed');
  assert.match(t.reply, /ride my bike again/, 'and re-opened with their own list in front of them');
  assert.doesNotMatch(t.reply, /^\s*$/, 'never an empty reply');
});

test('MID-FLIGHT SESSION: the very next turn coaches normally (the migration is one-shot)', () => {
  const stranded = { stage: 'evidence', collected: { reclaimList: ['ride my bike again'] } } as unknown as ConvState;
  const first = applyReclaimC1Turn(stranded, [], '4', m(''));
  const second = applyReclaimC1Turn(first.state, [], 'the bike one still matters most', m('What would riding again look like this month?'));
  assert.match(second.reply, /this month/i, 'the model is driving again — not the opener on a loop');
  assert.equal(second.complete, false);
});

// ── the surfaces the member can see, the agent must also know (CLAUDE.md) ─────────────────────────────────────

test('the Companion is told the science has a home, and told not to invent one', async () => {
  const { checkinSystem } = await import('../lib/agent/checkin.ts');
  // Assert on the ASSEMBLED prompt the agent actually receives, not on a constant sitting beside it.
  const p = checkinSystem({ displayName: 'Tom Miller', identityNoun: 'Athlete', doorDisplayNames: ['The Body'], idScore: 60, reclaimList: ['ride again'] } as never);
  assert.match(p, /Explore the Science/, 'the agent does not know the panel exists');
  assert.match(p, /NEVER invent a study, a statistic, a researcher, or a finding/i, 'the confabulation guard');
  // Greg's science-check language rule, which matters most on exactly this question.
  assert.match(p, /research suggests/i);
  assert.match(p, /deterministic never/i);
});

test('C1 renamed everywhere the member or the agent reads it', async () => {
  const { RECLAIM_V25 } = await import('../lib/curriculum/content/reclaim.ts');
  const { sessionById } = await import('../lib/workspace/session-registry.ts');
  const { ASSET_NAMES } = await import('../lib/assets/definitions.ts');
  // The Companion names the next step from the curriculum title — so the rename reaches the agent through data.
  assert.equal(RECLAIM_V25.find((a) => a.id === 'RCL-C1')?.title, 'Looking Forward');
  assert.equal(sessionById('c1')?.label, 'Looking Forward', 'the session header the member reads');
  assert.equal(ASSET_NAMES['C-1'], 'Looking Forward', 'the name the Companion speaks in a nudge');
});

test('C1 has an Explore panel and it is voiced probabilistically', async () => {
  const { exploreFor } = await import('../lib/content/explore.ts');
  const e = exploreFor('c1');
  assert.ok(e, 'C1 lost its Explore content');
  assert.equal(e!.points.length, 6, "Greg's six foundations");
  const all = e!.points.map((p) => `${p.head} ${p.body}`).join(' ');
  // The science-check language rule is load-bearing HERE above anywhere else — this tier IS the evidence claim.
  for (const banned of [/\bproves\b/i, /\bguarantees?\b/i, /\bwill make you\b/i, /\bensures\b/i]) {
    assert.doesNotMatch(all, banned, `deterministic claim in the science panel: ${banned}`);
  }
  // And it must not read like a literature review — the construct names belong in Greg's documents.
  for (const jargon of [/self-concordan/i, /psychologically coherent/i, /self-regulation/i]) {
    assert.doesNotMatch(all, jargon, `untranslated construct name reached the member: ${jargon}`);
  }
});
