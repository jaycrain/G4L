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
  // THE DOORWAY FIRST (2026-08-28). The Checkpoint no longer opens on item 1 — it recaps the phase and asks what
  // changed, and the instrument arrives on the next turn. See tests/no-session-opens-on-an-assessment.test.ts.
  const doorway = rewireCheckpointOpening();
  assert.equal(doorway.state.stage, 'checkpoint-open');
  assert.match(doorway.reply, /real work of Rewire/i, 'the frame in');

  let t = applyRewireCheckpointTurn(doorway.state, [], 'The self-talk, mostly.', { text: '' });
  assert.equal(t.state.stage, 'checkpoint');
  assert.match(t.reply, /mental traps/i, 'then the first item, verbatim');
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
  const t = applyRewireCheckpointTurn(rewireCheckpointOpening().state, [], 'A fair bit.', { text: '' });
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
  // The PROPERTY, not the sentence: this beat names Rebuild and the body. It used to pin the exact string
  // "Rebuild is the body", which meant a correct copy fix (Greg, 2026-08-04) failed a passing test.
  assert.match(jr!.text, /Rebuild/);
  assert.match(jr!.text, /body/i);
  // AND THE TENSE STAYS FIXED. "Rewire was the mind" told a member the mind work is behind them, which
  // contradicts the program model — Rewire and Rebuild run in PARALLEL, dosed per member.
  assert.doesNotMatch(jr!.text, /Rewire was/i, 'Rewire is not finished when Rebuild starts — they run in parallel');
  assert.equal(REWIRE_CEREMONY_RESOLVE_LABEL, 'Start Rebuilding →');
});

test('ceremony beats · no reading (no baseline / skipped) → steady framing, no number, still walks', () => {
  const beats = buildRewireCeremonyBeats({ grinta: null, keepers: [] });
  assert.match(beats[0]!.text, /held steady/i, 'degrades to the flat framing');
  assert.equal(beats[0]!.reveal, undefined, 'no grinta reveal when there is nothing to show');
});
