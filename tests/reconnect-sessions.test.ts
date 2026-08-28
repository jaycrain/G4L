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
import { readFileSync } from 'node:fs';
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

  // AND IT HAS TO END ON A CLOSE, WHICH THIS TEST ORIGINALLY NEVER CHECKED.
  //
  // The two assertions above passed the whole time. `complete` was true, the stage was not 'drift', and the
  // reply still ended with the Drift Quiz's opening question — because the flag was moved and the copy was not.
  // Jay met it on his walk: the Mirror closed, the ring moved, he was returned to the dashboard, and the last
  // thing said to him was a question from a Session he had not opened.
  //
  // Control flow and copy are two different claims. [[existence-is-not-the-assertion]]
  assert.doesNotMatch(last!.reply, /which do you feel the distance from most right now/,
    "R3's opener must not be spoken at R1's close");
  assert.doesNotMatch(last!.reply.trim(), /\?$/, 'a Session close does not ask a question nobody is there to answer');
  assert.match(last!.reply, /Next are your Doors/, 'it says what comes next, like every other Session close');
});

test('the personalized close ends the same way — both paths, one line', () => {
  // The engine's close and the model's personalized close are two separate sites, and BOTH appended the Drift
  // Quiz's opener. Fixing one would have left most members — the personalized path is the common one — still
  // reading R3's question at the end of R1. One exported constant, used by both.
  const engine = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const action = readFileSync(new URL('../app/reconnect/actions.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  assert.match(engine, /MIRROR_CLOSE_NEXT\}`/, "the engine's close ends on the next-Session line");
  assert.match(action, /MIRROR_CLOSE_NEXT\}`/, 'and so does the personalized one');
  assert.doesNotMatch(action, /driftOpen\(/, "the action must not open R3 from inside R1's close");
});

// ── R2 · THE DOORS ────────────────────────────────────────────────────────────────────────────────────────────
test('R2 ENDS after the Door work, naming what was done and what is next', () => {
  const at: ConvState = { stage: 'doors', awaitingConfirm: true, collected: COMMITTED };
  const asked = applyReconnectTurn(at, [], "yeah, that's it", { text: '', replyIntent: 'done' }, RECONNECT_R2_ARC);
  const done = applyReconnectTurn(asked.state, [], 'It means I stopped blaming myself.', { text: '' }, RECONNECT_R2_ARC);

  assert.equal(done.complete, true, 'the Doors Session closes');
  assert.notEqual(done.state.stage, 'measurement', 'it does not run on into the questionnaire');
  assert.match(done.reply, /Door work done/i, 'names what was done');
  // "the excavation" was the ASSET's name (RCN-EXC), never the Session's — the member has been in "The Doors"
  // the whole time and asked what the excavation was. And the Doors are in the PLAYBOOK, not the dashboard:
  // redesign-dashboard keeps them off it on purpose, so the old line sent him somewhere they cannot appear.
  assert.doesNotMatch(done.reply, /excavation/i, 'an internal asset name is not a member-facing word');
  assert.match(done.reply, /Playbook/i, 'says where the Doors actually live');
  assert.doesNotMatch(done.reply, /on your dashboard/i, 'because they are not on the dashboard');
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

// THE SAME RULE FOR EVERY SESSION, checked as COPY and not just as control flow.
//
// R1 shipped with `complete = true` and the Drift Quiz's opening question in the same reply; nobody caught it
// because the tests read the flag and the stage. R3 had the identical shape waiting one Session later — BOTH
// branches of the legacy close ended on `checkpointOpener()` — and would have handed Jay the Checkpoint's first
// instrument question on his way out to the dashboard. Found by auditing ahead of his walk rather than by him
// hitting it. [[existence-is-not-the-assertion]]
test('no Session close speaks the NEXT Session opener', () => {
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // Every completion in the arc file, with the reply assigned around it.
  const completions = [...src.matchAll(/b\.complete = true;[\s\S]{0,400}?b\.reply = ([^;]+);/g)].map((m) => m[1]!);
  const reverse = [...src.matchAll(/b\.reply = ([^;]+);[\s\S]{0,400}?b\.complete = true;/g)].map((m) => m[1]!);
  const all = [...completions, ...reverse];
  assert.ok(all.length >= 3, `expected to find the Session closes; found ${all.length}`);

  for (const reply of all) {
    assert.doesNotMatch(reply, /driftOpen\(|checkpointOpener\(|idqOpen\(|reconnectCallback\(/,
      `a close must NAME what is next, never open it: ${reply.slice(0, 80)}`);
  }
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

// ── THE MIRROR SHOWS YOU THE MIRROR ──────────────────────────────────────────────────────────────────────────
//
// Jay, on the ceremony's score card: "This should be included in R1 too."
//
// The radar and the number lived ONLY in the Reconnect ceremony — three Sessions after the reading is taken. So
// the Session whose entire product IS the ID Score closed on a sentence about it ("I've got your baseline now.
// You'll see it take shape on your dashboard") and sent the member off to go find their own number.
//
// It is the same card, from the same scorer, not a lookalike — the reading a member is shown must never be
// computed by a second path from the one that stored it.
test('the completing IDQ turn carries the reading it just took', () => {
  const actions = readFileSync(new URL('../app/reconnect/actions.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  assert.match(actions, /scoreIdq\(/, 'scored by the instrument\'s own function, not a display-side copy');
  assert.match(actions, /reveal\?: IdqReveal/, 'and returned to the client on the turn it is created');
  // Once only. A reveal left on the module would re-show a reading the member has already seen.
  assert.match(actions, /lastReveal = null;/, 'the reveal is consumed by the turn that produced it');
});

test('R1 renders the reading above the science card', () => {
  const chat = readFileSync(new URL('../app/reconnect/reconnect-chat.tsx', import.meta.url), 'utf8');
  const code = chat.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(code, /done && reveal &&/, 'shown at the close, and only when there is a reading');
  assert.match(code, /<IdqRadar/, 'the same radar the ceremony uses');
  assert.ok(code.indexOf('<IdqRadar') < code.indexOf('<TeachingUnderstand'),
    'the reading he just made comes before the science explaining why it was worth making');
});
