import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireCheckpointOpening, applyRewireCheckpointTurn } from '../lib/agent/rewire.ts';
import {
  buildRewireCeremonyBeats,
  REWIRE_CEREMONY_RESOLVE_LABEL,
  type RewireCeremonyData,
} from '../lib/ceremony/rewire-ceremony-beats.ts';
import { CHECKPOINT_COMMITMENT_ITEMS } from '../lib/grinta/survey/instrument.ts';

// R4 — the administered Commitment Checkpoint arc + the ceremony beats. The engine math is covered in
// grinta-checkpoint-commitment.test.ts; here: the arc walk (6 items → ceremony) and the ceremony's branched,
// component-foregrounded reveal.

test('R4 checkpoint arc · warm frame → 6 administered items → hands into the ceremony', () => {
  let t = rewireCheckpointOpening();
  assert.equal(t.state.stage, 'checkpoint');
  assert.match(t.reply, /real work of Rewire/i, 'the frame in');
  assert.match(t.reply, /mental traps/i, 'plus the first item, verbatim');
  // answer all six with a Likert number
  for (let i = 0; i < CHECKPOINT_COMMITMENT_ITEMS.length; i++) {
    assert.equal(t.state.stage, 'checkpoint', 'still administering');
    t = applyRewireCheckpointTurn(t.state, [], '4', { text: '' });
  }
  assert.equal(t.state.stage, 'ceremony', 'after the 6th, crosses into the ceremony');
  assert.equal((t.state.administeredResponses ?? []).length, 6, 'the six commitment responses captured');
  assert.match(t.reply, /show you what it means/i, 'the close hands into the reveal');
});

test('R4 checkpoint arc · a non-number is re-prompted (instrument fidelity), not advanced', () => {
  let t = rewireCheckpointOpening();
  const bad = applyRewireCheckpointTurn(t.state, [], 'kind of high', { text: '' });
  assert.equal(bad.state.stage, 'checkpoint', 'a non-Likert answer does not advance');
  assert.match(bad.reply, /1 to 5/i, 're-prompts for a number');
});

const withGrinta = (dir: 'up' | 'down' | 'flat', now: number, baseline: number, changePct: number): RewireCeremonyData => ({
  grinta: { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: dir, composite: 3.35 },
  keepers: ['I won’t know what I’m capable of until I try', 'Me at the finish line', 'Redirect · Reframe · Restart'],
});

test('ceremony beats · branch on the COMPONENT delta; the reveal carries the component move (composite is background)', () => {
  const up = buildRewireCeremonyBeats(withGrinta('up', 3.78, 3.0, 26));
  assert.match(up[0]!.text, /real progress/i, 'UP copy');
  const g = up[0]!.reveal;
  assert.equal(g?.kind, 'grinta');
  assert.equal((g as any).componentNow, 3.78, 'the hero number is the component Ave2');
  assert.equal((g as any).componentChangePct, 26, 'the big component move — what the copy narrates');
  assert.equal((g as any).composite, 3.35, 'the composite rides along as quiet context');

  const down = buildRewireCeremonyBeats(withGrinta('down', 3.33, 4.0, -16.75));
  assert.match(down[0]!.text, /looking clearly/i, 'DOWN copy — never a failure (grey, not red)');

  const flat = buildRewireCeremonyBeats(withGrinta('flat', 3.0, 3.0, 0));
  assert.match(flat[0]!.text, /held steady/i, 'FLAT copy');
});

test('ceremony beats · reveals the three tools together, then lights Rebuild', () => {
  const beats = buildRewireCeremonyBeats(withGrinta('up', 3.78, 3.0, 26));
  const pb = beats.find((b) => b.reveal?.kind === 'playbook');
  assert.match(pb!.text, /full kit now|taking with you/i);
  assert.equal((pb!.reveal as any).keepers.length, 3, 'the true line, the picture, the protocol');
  const jr = beats.find((b) => b.reveal?.kind === 'journey_rebuild');
  assert.match(jr!.text, /Rebuild is the body/i);
  assert.equal(REWIRE_CEREMONY_RESOLVE_LABEL, 'Start Rebuilding →');
});

test('ceremony beats · no reading (no baseline / skipped) → steady framing, no number, still walks', () => {
  const beats = buildRewireCeremonyBeats({ grinta: null, keepers: [] });
  assert.match(beats[0]!.text, /held steady/i, 'degrades to the flat framing');
  assert.equal(beats[0]!.reveal, undefined, 'no grinta reveal when there is nothing to show');
});
