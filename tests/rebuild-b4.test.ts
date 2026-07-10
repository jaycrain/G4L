import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildCheckpointOpening, applyRebuildCheckpointTurn } from '../lib/agent/rebuild.ts';
import {
  CHECKPOINT_CONTROL_ITEMS,
  BASELINE_CONTROL_ITEMS,
  pairwiseAverage,
  grintaStem,
} from '../lib/grinta/survey/instrument.ts';
import { scoreCheckpointStrand } from '../lib/grinta/survey/scoring.ts';
import {
  buildRebuildCeremonyBeats,
  REBUILD_CEREMONY_RESOLVE_LABEL,
  type RebuildCeremonyData,
} from '../lib/ceremony/rebuild-ceremony-beats.ts';

// B4 · The Rebuild Checkpoint — the administered Control arc (12 items → pairwise 12→6), the Control scoring (reuses
// scoreCheckpointStrand, target 'rebuild'), and the branched Rebuild ceremony (Control component foregrounded).

test('B4 checkpoint arc · warm frame → 12 administered items → hands into the ceremony', () => {
  let t = rebuildCheckpointOpening();
  assert.equal(t.state.stage, 'checkpoint');
  assert.match(t.reply, /real work of Rebuild/i, 'the frame in');
  assert.ok(t.reply.includes(grintaStem(CHECKPOINT_CONTROL_ITEMS[0]!)), 'plus the first item, verbatim');
  for (let i = 0; i < CHECKPOINT_CONTROL_ITEMS.length; i++) {
    assert.equal(t.state.stage, 'checkpoint', 'still administering');
    t = applyRebuildCheckpointTurn(t.state, [], '4', { text: '' } as never);
  }
  assert.equal(t.state.stage, 'ceremony', 'after the 12th, crosses into the ceremony');
  assert.equal((t.state.administeredResponses ?? []).length, 12, 'all 12 control responses captured');
  assert.match(t.reply, /show you what you just built/i, 'the close hands into the reveal');
});

test('B4 checkpoint arc · a non-number is re-prompted (instrument fidelity), not advanced', () => {
  const t = rebuildCheckpointOpening();
  const bad = applyRebuildCheckpointTurn(t.state, [], 'pretty aware', { text: '' } as never);
  assert.equal(bad.state.stage, 'checkpoint', 'a non-Likert answer does not advance');
  assert.match(bad.reply, /1 to 5/i, 're-prompts for a number');
});

test('pairwiseAverage · 12 → 6, consecutive pairs (the B4 factory addition)', () => {
  const twelve = [4, 2, 5, 5, 3, 3, 4, 2, 5, 1, 2, 4];
  const six = pairwiseAverage(twelve);
  assert.deepEqual(six, [3, 5, 3, 3, 3, 3], 'mean of each consecutive a/b pair');
  assert.throws(() => pairwiseAverage([1, 2, 3]), /even/);
});

test('B4 scoring · reuses scoreCheckpointStrand for the CONTROL strand, EE sign, composite re-average', () => {
  // baseline control = [3,3,3] → Ave1 = 3; checkpoint 12 all 4s → pairwise 6 all 4s → Ave2 = mean(3,3,3,4,4,4,4,4,4) = 3.67
  const control12 = Array(12).fill(4);
  const scored6 = pairwiseAverage(control12);
  const cp = scoreCheckpointStrand({
    target: 'rebuild',
    baselineValues: [3, 3, 3],
    newValues: scored6,
    carriedStrands: { reconnect: 3, rewire: 3, reclaim: 3 },
  });
  assert.equal(cp.baseline, 3, 'Control Ave1');
  assert.equal(cp.now, 3.67, 'Control Ave2 (9-item-equivalent)');
  assert.ok(cp.changePct! > 0, 'up-positive (EE sign)');
  assert.equal(cp.score.strands.rebuild, 3.67, 'the rebuild strand updated');
  assert.equal(cp.score.strands.reconnect, 3, 'other strands carried');
  assert.equal(cp.score.composite, 3.17, 'composite re-averages the four'); // mean(3.67,3,3,3)

  assert.equal(BASELINE_CONTROL_ITEMS.length, 3);
  assert.equal(CHECKPOINT_CONTROL_ITEMS.length, 12);
});

const withGrinta = (dir: 'up' | 'down' | 'flat', now: number, baseline: number, changePct: number): RebuildCeremonyData => ({
  grinta: { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: dir, composite: 3.2 },
  keepers: ['Movement — a 10-minute walk after dinner\nEating — a vegetable at dinner'],
});

test('B4 ceremony · branches on the Control delta; foregrounds the component; lights Reclaim; Start Reclaiming →', () => {
  const up = buildRebuildCeremonyBeats(withGrinta('up', 3.67, 3.0, 22));
  assert.match(up[0]!.text, /Grinta Index moved/i, 'UP copy');
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
