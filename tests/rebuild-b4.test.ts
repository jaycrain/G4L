import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildCheckpointOpening, applyRebuildCheckpointTurn } from '../lib/agent/rebuild.ts';
import {
  CHECKPOINT_CONTROL_ITEMS,
  CHECKPOINT_CONTROL_SCORED,
  BASELINE_CONTROL_ITEMS,
  grintaStem,
} from '../lib/grinta/survey/instrument.ts';
import { scoreCheckpointStrand } from '../lib/grinta/survey/scoring.ts';
import {
  buildRebuildCeremonyBeats,
  REBUILD_CEREMONY_RESOLVE_LABEL,
  type RebuildCeremonyData,
} from '../lib/ceremony/rebuild-ceremony-beats.ts';

// B4 · The Rebuild Checkpoint — the administered Control arc, the Control scoring (reuses scoreCheckpointStrand,
// target 'rebuild'), and the branched Rebuild ceremony (Control component foregrounded).
//
// SIX ITEMS, NOT TWELVE, since Greg's V5 (2026-08-14). The activity/diet a/b pairs and the pairwise 12→6 average
// are gone: what is administered is now what is scored. These tests count off CHECKPOINT_CONTROL_ITEMS.length
// rather than a literal, so the next change to the instrument does not need a test edit to go with it.

test('B4 checkpoint arc · warm frame → every administered item → hands into the ceremony', () => {
  // THE DOORWAY FIRST (2026-08-28) — the recap and "what's different now" are their own beat; the instrument
  // arrives on the next turn. See tests/no-session-opens-on-an-assessment.test.ts.
  const doorway = rebuildCheckpointOpening();
  assert.equal(doorway.state.stage, 'checkpoint-open');
  // Pinned the old sentence verbatim and broke when B4's set-up was restored from Greg's own "Introduction (Shown
  // to Member)". Assert what the frame has to DO: say what this checkpoint asks, and what moving to Reclaim means.
  assert.match(doorway.reply, /past the numbers|beyond the numbers/i, 'this is not a weigh-in');
  assert.match(doorway.reply, /Reclaim/i, 'and it names what comes next');

  let t = applyRebuildCheckpointTurn(doorway.state, [], 'I stopped negotiating with myself at 6am.', { text: '' } as never);
  assert.equal(t.state.stage, 'checkpoint');
  assert.ok(t.reply.includes(grintaStem(CHECKPOINT_CONTROL_ITEMS[0]!)), 'then the first item, verbatim');
  for (let i = 0; i < CHECKPOINT_CONTROL_ITEMS.length; i++) {
    assert.equal(t.state.stage, 'checkpoint', 'still administering');
    t = applyRebuildCheckpointTurn(t.state, [], '4', { text: '' } as never);
  }
  assert.equal(t.state.stage, 'ceremony', 'after the last item, crosses into the ceremony');
  assert.equal(
    (t.state.administeredResponses ?? []).length,
    CHECKPOINT_CONTROL_ITEMS.length,
    'every control response captured — six since V5',
  );
  assert.match(t.reply, /show you what you just built/i, 'the close hands into the reveal');
});

test('B4 checkpoint arc · a non-number is re-prompted (instrument fidelity), not advanced', () => {
  const t = applyRebuildCheckpointTurn(rebuildCheckpointOpening().state, [], 'A lot, actually.', { text: '' } as never);
  const bad = applyRebuildCheckpointTurn(t.state, [], 'pretty aware', { text: '' } as never);
  assert.equal(bad.state.stage, 'checkpoint', 'a non-Likert answer does not advance');
  assert.match(bad.reply, /1 to 5/i, 're-prompts for a number');
});

test('the administered set IS the scored set — no reduction step to drift', () => {
  // The V5 cut's real safety property. While B4 administered 12 and scored 6, two lists had to stay in step and
  // nothing enforced it; a wrong-length reduction would have silently mis-scored the strand.
  assert.equal(CHECKPOINT_CONTROL_ITEMS.length, 6, 'six administered');
  assert.deepEqual([...CHECKPOINT_CONTROL_SCORED], [...CHECKPOINT_CONTROL_ITEMS], 'and the same six scored');
  assert.ok(!CHECKPOINT_CONTROL_ITEMS.some((c) => /[ab]$/.test(c)), 'no a/b halves remain');
});

test('B4 scoring · reuses scoreCheckpointStrand for the CONTROL strand, EE sign, composite re-average', () => {
  // baseline control = [3,3,3] → Ave1 = 3; checkpoint six all 4s → Ave2 = mean(3,3,3,4,4,4,4,4,4) = 3.67.
  // The Ave2 is unchanged by the V5 cut, which is the point: six 4s and twelve 4s-averaged-to-six are the same
  // nine-item read. Greg's accumulation model is untouched; only how the six are collected changed.
  const control6 = Array(CHECKPOINT_CONTROL_ITEMS.length).fill(4);
  const cp = scoreCheckpointStrand({
    target: 'rebuild',
    baselineValues: [3, 3, 3],
    newValues: control6,
    carriedStrands: { reconnect: 3, rewire: 3, reclaim: 3 },
  });
  assert.equal(cp.baseline, 3, 'Control Ave1');
  assert.equal(cp.now, 3.67, 'Control Ave2 (9-item-equivalent)');
  assert.ok(cp.changePct! > 0, 'up-positive (EE sign)');
  assert.equal(cp.score.strands.rebuild, 3.67, 'the rebuild strand updated');
  assert.equal(cp.score.strands.reconnect, 3, 'other strands carried');
  assert.equal(cp.score.composite, 3.17, 'composite re-averages the four'); // mean(3.67,3,3,3)

  assert.equal(BASELINE_CONTROL_ITEMS.length, 3);
  // SIX since V5 — was 12 when the checkpoint administered activity/diet halves.
  assert.equal(CHECKPOINT_CONTROL_ITEMS.length, 6);
});

const withGrinta = (dir: 'up' | 'down' | 'flat', now: number, baseline: number, changePct: number): RebuildCeremonyData => ({
  grinta: { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: dir, composite: 3.2 },
  keepers: ['Movement — a 10-minute walk after dinner\nEating — a vegetable at dinner'],
});

test('B4 ceremony · branches on the Control delta; foregrounds the component; lights Reclaim; Start Reclaiming →', () => {
  const up = buildRebuildCeremonyBeats(withGrinta('up', 3.67, 3.0, 22));
  assert.match(up[0]!.text, /Rebuild just climbed/i, 'UP copy');
  assert.equal((up[0]!.reveal as { componentNow: number }).componentNow, 3.67, 'hero = the control component Ave2');

  const down = buildRebuildCeremonyBeats(withGrinta('down', 2.8, 3.2, -12.5));
  assert.match(down[0]!.text, /looking clearly/i, 'DOWN copy — grey, never red (HH)');

  const flat = buildRebuildCeremonyBeats(withGrinta('flat', 3.0, 3.0, 0));
  assert.match(flat[0]!.text, /held steady/i, 'FLAT copy');

  const pb = up.find((b) => b.reveal?.kind === 'playbook');
  assert.match(pb!.text, /your why.*plan|plan you're running/i, 'Playbook seeds = why + plan');
  const jr = up.find((b) => b.reveal?.kind === 'journey_reclaim');
  assert.match(jr!.text, /Reclaim is the bigger world/i, 'lights Reclaim');
  assert.equal(REBUILD_CEREMONY_RESOLVE_LABEL, 'Start Reclaiming →');
});

test('B4 ceremony · no reading → steady framing, no number, still walks', () => {
  const beats = buildRebuildCeremonyBeats({ grinta: null, keepers: [] });
  assert.match(beats[0]!.text, /held steady/i, 'degrades to the flat framing');
  assert.equal(beats[0]!.reveal, undefined, 'no grinta reveal when there is nothing to show');
});
