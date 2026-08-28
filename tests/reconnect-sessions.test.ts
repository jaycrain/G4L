// RECONNECT IS THREE SESSIONS AND A CHECKPOINT — the boundaries, pinned.
//
// It was ONE arc of eight stages: a single ~65-minute conversation with no landmark in it. Every other phase runs
// one arc per Session, entered from the dashboard and closing back to it. Three sources had already said Reconnect
// should too, and we had not noticed they agreed:
//   · Greg's Gated Assets V4 — four separately-placed assets (R1 IDQ / R2 Doors / R3 Drift+Legacy / R4 Checkpoint),
//     each with its own Placement, plus his pacing notes ("restrict a person to only 10-15 minutes before pausing
//     for the day"; "a soft daily cap … or one session/day"). He never describes it as one sitting.
//   · lib/content/summaries.ts, in its own header: "Reconnect holds three (R1 IDQ · R2 Doors · R3 Drift+Legacy)."
//   · Two testers hitting the same seam independently in one week.
//
// What each test here protects is that a Session ENDS. Before the split every one of these seams handed straight
// on to the next stage, which is what made the phase unbroken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReconnectTurn, reconnectR1Opening, reconnectOpening, reconnectR3Opening, reconnectCheckpointOpening,
  RECONNECT_R1_ARC, RECONNECT_R2_ARC, RECONNECT_R3_ARC, RECONNECT_CHECKPOINT_ARC,
} from '../lib/agent/reconnect.ts';
import { TOTAL_ITEMS } from '../lib/idq/instrument.ts';
import type { ConvState, Collected } from '../lib/agent/onboarding.ts';

const COMMITTED: Collected = { identityNoun: 'Racer', gap: 'The years took it.', doors: ['grind'] };

// ── R1 · THE MIRROR ───────────────────────────────────────────────────────────────────────────────────────────
test('R1 opens on the mirror — and is the FIRST Session, per Greg', () => {
  const t = reconnectR1Opening(COMMITTED);
  assert.equal(t.state.stage, 'measurement', 'R1 is the IDQ');
  assert.match(t.reply, /start with the mirror/i, "Greg's own image, kept");
  assert.match(t.reply, /uncomfortable/i, 'and his discomfort line, which is the best sentence in his intro');

  // OUR RULE BEATS HIS DRAFT HERE. Greg's V4 intro reads "This is a mirror, not a test. There are no right
  // answers and no scores to worry about." Reassuring a member about an instrument implies they feared being
  // graded; the rule says name the thing and move. (Jay, 2026-08-28: "your version.")
  assert.doesNotMatch(t.reply, /not a test|no right answers|no scores|no wrong answers/i,
    'never reassure a member about our instruments');

  // AND IT NO LONGER ASSUMES THE DOORS CAME FIRST — the old opener led with "We've gone deep into what created
  // the distance", which the reorder made false.
  assert.doesNotMatch(t.reply, /gone deep|what created the distance/i);
});

test('R1 ENDS when the instrument does — it does not run on into the Drift Quiz', () => {
  let s = reconnectR1Opening(COMMITTED).state as ConvState;
  let last;
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    last = applyReconnectTurn(s, [], '3', { text: '' }, RECONNECT_R1_ARC);
    s = last.state as ConvState;
  }
  assert.equal(last!.complete, true, 'the Session closes on the 24th answer');
  assert.notEqual(s.stage, 'drift', 'and does NOT hand into R3 — that was the unbroken run');
});

// ── R2 · THE DOORS ────────────────────────────────────────────────────────────────────────────────────────────
test('R2 ENDS after the Door work, naming what was done and what is next', () => {
  const at: ConvState = { stage: 'doors', awaitingConfirm: true, collected: COMMITTED };
  const asked = applyReconnectTurn(at, [], "yeah, that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  const done = applyReconnectTurn(asked.state, [], 'It means I stopped blaming myself.', { text: '' }, RECONNECT_R2_ARC);

  assert.equal(done.complete, true, 'the Doors Session closes');
  assert.notEqual(done.state.stage, 'measurement', 'it does not run on into the questionnaire');
  assert.match(done.reply, /excavation done/i, 'names what was done');
  assert.match(done.reply, /dashboard/i, 'says where the Doors now live');
  assert.match(done.reply, /Drift Quiz/i, 'and what the next Session is');
});

test('R2 still asks Greg\'s fourth question before it closes', () => {
  const at: ConvState = { stage: 'doors', awaitingConfirm: true, collected: COMMITTED };
  const asked = applyReconnectTurn(at, [], "that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  assert.match(asked.reply, /change about how you see your own Fade/i, 'his R2 reflection, built 8/27');
  assert.ok(!asked.complete, 'and the Session is not over until she answers it');
});

// ── R3 · THE DRIFT QUIZ AND THE LEGACY LETTER, one two-part Session ───────────────────────────────────────────
test('R3 opens on the Drift Quiz and holds the Legacy Letter in the same Session', () => {
  const t = reconnectR3Opening(COMMITTED);
  assert.equal(t.state.stage, 'drift');
  // Greg: "the activity is now a 2 part process: Part 1 (Drift Quiz) / Part 2 (Legacy Letter)". Splitting them
  // would end R3 on a quiz result rather than on the thing she makes.
  assert.ok(RECONNECT_R3_ARC.stageOrder.includes('legacy'), 'the letter belongs to this Session');
  assert.ok(RECONNECT_R3_ARC.stageOrder.includes('window'), 'and the window that leads into it');
});

test('R3 ENDS after the letter — the Checkpoint is its own Session', () => {
  assert.ok(!RECONNECT_R3_ARC.stageOrder.includes('checkpoint'),
    "Greg's own R3 closure says 'First take a quick step through the Transition Activity' — it is a separate step");
  assert.ok(RECONNECT_CHECKPOINT_ARC.stageOrder.includes('checkpoint'));
});

// ── R4 · THE CHECKPOINT, then the ceremony ────────────────────────────────────────────────────────────────────
test('the Checkpoint Session carries the ceremony, as every other phase does', () => {
  const t = reconnectCheckpointOpening(COMMITTED);
  assert.equal(t.state.stage, 'checkpoint');
  assert.deepEqual(RECONNECT_CHECKPOINT_ARC.stageOrder, ['checkpoint', 'ceremony']);
});

// ── THE SHAPE ─────────────────────────────────────────────────────────────────────────────────────────────────
test('no stage is orphaned and none is claimed twice', () => {
  const all = [
    ...RECONNECT_R1_ARC.stageOrder, ...RECONNECT_R2_ARC.stageOrder,
    ...RECONNECT_R3_ARC.stageOrder, ...RECONNECT_CHECKPOINT_ARC.stageOrder,
  ];
  assert.equal(new Set(all).size, all.length, 'a stage in two Sessions would run twice or resume into the wrong one');
  for (const stage of ['entry', 'doors', 'measurement', 'drift', 'window', 'legacy', 'checkpoint', 'ceremony'])
    assert.ok(all.includes(stage), `${stage} belongs to no Session — it would be unreachable`);
});

test('R2 opening still snapshots the Doors she walked in with', () => {
  // The only moment this distinction is free: after a re-seeing commits, collected.doors no longer remembers.
  const t = reconnectOpening({ ...COMMITTED, doors: ['grind', 'body'] });
  assert.deepEqual(t.state.doorsAtEntry, ['grind', 'body']);
});
