import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclaimCheckpointOpening, applyReclaimCheckpointTurn } from '../lib/agent/reclaim.ts';
import { CHECKPOINT_CHALLENGE_ITEMS, BASELINE_CHALLENGE_ITEMS, grintaStem } from '../lib/grinta/survey/instrument.ts';
import { scoreCheckpointStrand } from '../lib/grinta/survey/scoring.ts';
import { buildReclaimCeremonyBeats, RECLAIM_CEREMONY_RESOLVE_LABEL, type ReclaimCeremonyData } from '../lib/ceremony/reclaim-ceremony-beats.ts';

// C4 · The Reclaim Checkpoint (the capstone). The administered Challenge read (a CLEAN 6 — no pairwise), the Challenge
// scoring (reuses scoreCheckpointStrand target 'reclaim'), and the branched capstone ceremony → the Loop.

test('C4 checkpoint arc · warm frame → 6 administered items → hands into the ceremony', () => {
  // THE DOORWAY FIRST (2026-08-28) — the instrument arrives one turn later. See
  // tests/no-session-opens-on-an-assessment.test.ts.
  const doorway = reclaimCheckpointOpening();
  assert.equal(doorway.state.stage, 'checkpoint-open');
  assert.match(doorway.reply, /real work of Reclaim/i, 'the frame in');

  let t = applyReclaimCheckpointTurn(doorway.state, [], 'My weekends belong to me again.');
  assert.equal(t.state.stage, 'checkpoint');
  assert.ok(t.reply.includes(grintaStem(CHECKPOINT_CHALLENGE_ITEMS[0]!)), 'then the first item, verbatim');
  for (let i = 0; i < CHECKPOINT_CHALLENGE_ITEMS.length; i++) {
    assert.equal(t.state.stage, 'checkpoint', 'still administering');
    t = applyReclaimCheckpointTurn(t.state, [], '4');
  }
  assert.equal(t.state.stage, 'ceremony', 'after the 6th, crosses into the ceremony');
  assert.equal((t.state.administeredResponses ?? []).length, 6, 'the six challenge responses captured');
  assert.match(t.reply, /show you what you just built/i, 'the close hands into the reveal');
});

test('C4 checkpoint arc · a non-number is re-prompted (instrument fidelity), not advanced', () => {
  const t = applyReclaimCheckpointTurn(reclaimCheckpointOpening().state, [], 'Quite a lot.');
  const bad = applyReclaimCheckpointTurn(t.state, [], 'very true');
  assert.equal(bad.state.stage, 'checkpoint', 'a non-Likert answer does not advance');
  assert.match(bad.reply, /1 to 5/i, 're-prompts');
});

test('C4 scoring · reuses scoreCheckpointStrand for the CHALLENGE strand (clean 6, no pairwise), EE sign', () => {
  // baseline challenge = [3,3,3] → Ave1 = 3; the 6 checkpoint items all 4 → Ave2 = mean(3,3,3,4,4,4,4,4,4) = 3.67
  const cp = scoreCheckpointStrand({
    target: 'reclaim',
    baselineValues: [3, 3, 3],
    newValues: Array(6).fill(4),
    carriedStrands: { reconnect: 3, rewire: 3, rebuild: 3 },
  });
  assert.equal(cp.baseline, 3, 'Challenge Ave1');
  assert.equal(cp.now, 3.67, 'Challenge Ave2 (9-item read)');
  assert.ok(cp.changePct! > 0, 'up-positive (EE sign)');
  assert.equal(cp.score.strands.reclaim, 3.67, 'the reclaim strand updated');
  assert.equal(cp.score.strands.reconnect, 3, 'other strands carried');
  assert.equal(cp.score.composite, 3.17, 'composite re-averages the four'); // mean(3,3,3,3.67)
  assert.equal(BASELINE_CHALLENGE_ITEMS.length, 3);
  assert.equal(CHECKPOINT_CHALLENGE_ITEMS.length, 6);
});

const withGrinta = (dir: 'up' | 'down' | 'flat', now: number, baseline: number, changePct: number): ReclaimCeremonyData => ({
  grinta: { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: dir, composite: 3.4 },
  keepers: ['feel physically capable and steady again', 'stop living in reaction mode'],
});

test('C4 ceremony · branches on the Challenge delta; Legacy revisit; closes Cycle 1; Share your story →', () => {
  const up = buildReclaimCeremonyBeats(withGrinta('up', 3.67, 3.0, 22));
  assert.match(up[0]!.text, /Reclaim just climbed/i, 'UP copy');
  assert.equal((up[0]!.reveal as { componentNow: number }).componentNow, 3.67, 'hero = the challenge component Ave2');

  const down = buildReclaimCeremonyBeats(withGrinta('down', 2.8, 3.2, -12.5));
  assert.match(down[0]!.text, /seeing the whole picture/i, 'DOWN copy — grey, never red (HH)');

  const flat = buildReclaimCeremonyBeats(withGrinta('flat', 3.0, 3.0, 0));
  assert.match(flat[0]!.text, /held steady/i, 'FLAT copy');

  const legacy = up.find((b) => /words you wrote near the start/i.test(b.text));
  assert.ok(legacy, 'the Legacy-revisit beat (repointed to the Playbook — no Legacy Letter is written in the live flow yet)');
  const cycle = up.find((b) => b.reveal?.kind === 'cycle_complete');
  assert.match(cycle!.text, /closed your first full cycle|Success Story/i, 'closes Cycle 1 + invites the Success Story');
  assert.equal(RECLAIM_CEREMONY_RESOLVE_LABEL, 'Share your story →');
});

test('C4 ceremony · no reading → steady framing, no number, still walks', () => {
  const beats = buildReclaimCeremonyBeats({ grinta: null, keepers: [] });
  assert.match(beats[0]!.text, /held steady/i, 'degrades to the flat framing');
  assert.equal(beats[0]!.reveal, undefined, 'no grinta reveal when there is nothing to show');
});
