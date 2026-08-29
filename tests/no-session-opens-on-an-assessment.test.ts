// NO SESSION OPENS ON AN ASSESSMENT.
//
// Jay, 2026-08-28, mid-walk: "If the Session is leading with an assessment, something's missing."
//
// He had said the specific version of it twice already — "This is underdeveloped for a Checkpoint" (Rewire W4) and
// "This Session can't just start with an assessment" (Rebuild B2) — and both times I fixed the Session in front of
// me. The general form was the useful one: EIGHT of the sixteen Sessions opened cold on an instrument. R1 (the
// IDQ, the first Session anyone ever does), B1, B2, C2, and all four Checkpoints. In every one, the member's first
// act was to tap a number.
//
// It was never a copy problem. Greg's specs describe the missing piece in his own vocabulary: B1.md:264 and
// B2.md:448 both declare "Stage 1: Engagement — present opening frame ... set the stance", and R1.md:341 runs
// opening → rating → closure with the rating in the MIDDLE. We had built the middle stage, eight times, and the
// frames we did have were glued onto item 1 where a member meets them on the way to the chips.
//
// THIS TEST IS THE RULE, NOT THE EIGHT FIXES. Every one of those Sessions was individually plausible — an
// instrument is a reasonable thing to open with, which is exactly why it happened eight times independently. A
// ninth instrument-led Session is a matter of time; this fails the moment one is added without a doorway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECONNECT_R1_ARC, RECONNECT_R2_ARC, RECONNECT_R3_ARC, RECONNECT_CHECKPOINT_ARC,
  reconnectR1Opening, reconnectCheckpointOpening, applyReconnectTurn,
} from '../lib/agent/reconnect.ts';
import { REWIRE_ARC, REWIRE_W2_ARC, REWIRE_W3_ARC, REWIRE_CHECKPOINT_ARC, rewireCheckpointOpening } from '../lib/agent/rewire.ts';
import { REBUILD_B1_ARC, REBUILD_B2_ARC, REBUILD_B3_ARC, REBUILD_CHECKPOINT_ARC, rebuildB1Opening, rebuildB2Opening, rebuildCheckpointOpening } from '../lib/agent/rebuild.ts';
import { RECLAIM_C1_ARC, RECLAIM_C2_ARC, RECLAIM_C3_ARC, RECLAIM_CHECKPOINT_ARC, reclaimC2Opening, reclaimCheckpointOpening } from '../lib/agent/reclaim.ts';
import { CHECKPOINT_ENGAGE_Q, type ArcConfig } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const ARCS: Array<[string, ArcConfig]> = [
  ['R1', RECONNECT_R1_ARC], ['R2', RECONNECT_R2_ARC], ['R3', RECONNECT_R3_ARC], ['R4', RECONNECT_CHECKPOINT_ARC],
  ['W1', REWIRE_ARC], ['W2', REWIRE_W2_ARC], ['W3', REWIRE_W3_ARC], ['W4', REWIRE_CHECKPOINT_ARC],
  ['B1', REBUILD_B1_ARC], ['B2', REBUILD_B2_ARC], ['B3', REBUILD_B3_ARC], ['B4', REBUILD_CHECKPOINT_ARC],
  ['C1', RECLAIM_C1_ARC], ['C2', RECLAIM_C2_ARC], ['C3', RECLAIM_C3_ARC], ['C4', RECLAIM_CHECKPOINT_ARC],
];

test('no arc begins on an administered stage', () => {
  for (const [name, arc] of ARCS) {
    const first = arc.stages[arc.stageOrder[0]!];
    assert.notEqual(first?.mode, 'administered',
      `${name} opens on its instrument — a member's first act in the Session is to tap a number`);
  }
});

// The eight that had to be given one. Named individually so that removing a doorway fails HERE, with the Session's
// name on it, rather than silently passing the rule above by deleting the stage and the instrument together.
const INSTRUMENT_LED: Array<[string, ArcConfig, () => Turn]> = [
  ['R1', RECONNECT_R1_ARC, () => reconnectR1Opening({})],
  ['R4', RECONNECT_CHECKPOINT_ARC, () => reconnectCheckpointOpening({})],
  ['W4', REWIRE_CHECKPOINT_ARC, () => rewireCheckpointOpening()],
  ['B1', REBUILD_B1_ARC, () => rebuildB1Opening()],
  ['B2', REBUILD_B2_ARC, () => rebuildB2Opening()],
  ['B4', REBUILD_CHECKPOINT_ARC, () => rebuildCheckpointOpening()],
  ['C2', RECLAIM_C2_ARC, () => reclaimC2Opening()],
  ['C4', RECLAIM_CHECKPOINT_ARC, () => reclaimCheckpointOpening()],
];

test('each instrument-led Session opens on a question, and offers no chips to answer it with', () => {
  for (const [name, , open] of INSTRUMENT_LED) {
    const t = open();
    assert.match(t.reply.trim(), /\?$/, `${name}: the opening turn does not end on a question`);
    // THE CHIPS ARE THE TELL. A doorway that ships a 1–5 scale under its open question has not moved the
    // assessment at all — it has just written a sentence above it. This is the assertion that catches a doorway
    // that exists but does not work, which is the failure mode this whole class is made of.
    assert.equal(t.expects, undefined, `${name}: scale chips render under the doorway's open question`);
  }
});

test('the instrument is still what the doorway opens onto', () => {
  // The rule must not be satisfiable by deleting the instrument. Every one of these arcs still reaches an
  // administered stage — the doorway is a stage IN FRONT of it, not a replacement for it.
  for (const [name, arc] of INSTRUMENT_LED) {
    const admin = arc.stageOrder.filter((s) => arc.stages[s]?.mode === 'administered');
    assert.ok(admin.length >= 1, `${name}: no administered stage left — the instrument went missing`);
    assert.equal(arc.stageOrder[1], admin[0], `${name}: the doorway does not open directly onto the instrument`);
  }
});

test('one answer opens the doorway — it is not a beat to be held in', () => {
  // A doorway with a depth floor would be worse than no doorway: it puts a gate in front of the instrument the
  // member came to do. Whatever they say, however short, advances it.
  const t = applyReconnectTurn(
    { stage: 'mirror-open', collected: {} } as ConvState, [], 'The body.', { text: '' }, RECONNECT_R1_ARC);
  assert.equal((t.state as ConvState).stage, 'measurement', 'a short answer still opens it');
  assert.ok(t.expects, 'and the instrument brings its chips with it');
});

test('a member who asks a question back gets an answer, not the instrument', () => {
  // The one case worth holding for. They asked what this is; handing them item 1 answers a question they did not
  // ask and loses the one they did.
  const t = applyReconnectTurn(
    { stage: 'mirror-open', collected: {} } as ConvState, [],
    'What is this going to be used for?',
    { text: 'It sets your baseline — nothing outside this is scored.' },
    RECONNECT_R1_ARC);
  assert.equal((t.state as ConvState).stage, 'mirror-open', 'it stays in the doorway to answer them');
  assert.match(t.reply, /baseline/, "the model's answer survives");
});

test('but asking questions can never become a way to be stuck in front of the instrument', () => {
  // Bounded, because the alternative is a member who cannot start a Session they came to do. [[completeness-never-touches-drawout]]
  let s = { stage: 'mirror-open', collected: {} } as ConvState;
  for (let i = 0; i < 4; i++) {
    s = applyReconnectTurn(s, [], 'What is this for?', { text: 'A baseline.' }, RECONNECT_R1_ARC).state as ConvState;
  }
  assert.equal(s.stage, 'measurement', 'the doorway opened anyway rather than holding them there');
});

test('all four Checkpoints ask the same question, from one definition', () => {
  // Four phases, one moment — "what changed" — and four places it could drift apart. It is built once
  // (checkpointEngagement) so the fourth phase cannot quietly get a worse version of it. [[one-fact-many-sites]]
  for (const [name, , open] of INSTRUMENT_LED.filter(([n]) => n.endsWith('4'))) {
    assert.ok(open().reply.includes(CHECKPOINT_ENGAGE_Q), `${name}: does not ask the Checkpoint question`);
  }
});

test('a Checkpoint names what the phase did before it measures it', () => {
  // Jay: "This is underdeveloped for a Checkpoint." Reconnect's had no recap at all — it opened "a quick check-in
  // before we close" and went to item 1, closing the phase that holds the mirror, the Doors and the Window
  // without naming one of them.
  assert.match(reconnectCheckpointOpening({}).reply, /Doors/, 'Reconnect recaps the phase');
  assert.match(rewireCheckpointOpening().reply, /caught the lies/, 'Rewire recaps the phase');
  assert.match(rebuildCheckpointOpening().reply, /underneath the numbers/, 'Rebuild recaps the phase');
  assert.match(reclaimCheckpointOpening().reply, /clearer eyes/, 'Reclaim recaps the phase');
});

// ── THE ANCHORS ARE THE INSTRUMENT'S, NOT OURS ────────────────────────────────────────────────────────────────
//
// Jay, 2026-08-28: "It's not branding, it's more likely psychometrically sound from the professor. So, if it's an
// easy swap out, use Greg's terms throughout."
//
// We had shipped "not at all" → "completely" on six 1–5 instruments. Greg states the anchors verbatim and
// identically in every one of his specs — R1.md:33 for the IDQ, GATED-RECONNECT.md:112/482 and
// GATED-REWIRE.md:1062 for the Grinta family: "Rate each statement from 1 (strongly disagree) to 5 (strongly
// agree)." An agreement scale over statements has agreement anchors; ours were a warmer paraphrase of somebody
// else's instrument.
//
// NOT A UNIVERSAL LABEL, which is the thing this test protects in BOTH directions. B1 is SDT on 1–7, B2 is 1–4,
// C2 rates magnitude on 1–10 where "strongly agree" would be meaningless. The rule is that anchors follow the
// instrument — so this asserts Greg's anchors on the 1–5 family and asserts the others are LEFT ALONE.
test('every 1-5 agreement instrument carries Greg’s anchors, from one definition', () => {
  const onFive = ARCS.flatMap(([name, arc]) =>
    arc.stageOrder.map((s) => [name, arc.stages[s]] as const)
      .filter(([, st]) => st?.mode === 'administered' && st.scale?.max === 5));
  assert.ok(onFive.length >= 5, 'expected the IDQ + the four Checkpoint reads');
  for (const [name, st] of onFive) {
    assert.equal(st!.scale!.minLabel, 'strongly disagree', `${name}: 1–5 low anchor is not Greg's`);
    assert.equal(st!.scale!.maxLabel, 'strongly agree', `${name}: 1–5 high anchor is not Greg's`);
  }
});

test('and the instruments on other scales keep their own anchors', () => {
  const anchorsOf = (arc: ArcConfig, id: string) => arc.stages[id]!.scale!;
  assert.deepEqual(
    { ...anchorsOf(REBUILD_B1_ARC, 'why') },
    { max: 7, minLabel: 'not at all true', maxLabel: 'very true', itemCount: 12 },
    'B1 is SDT on 1–7 — agreement anchors would be the wrong instrument',
  );
  assert.equal(anchorsOf(REBUILD_B2_ARC, 'skills').max, 4, 'B2 is 1–4');
  assert.equal(anchorsOf(RECLAIM_C2_ARC, 'audit-physical').minLabel, 'low', 'C2 rates magnitude, not agreement');
});
