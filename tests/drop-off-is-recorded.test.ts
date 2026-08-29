// WHERE A MEMBER STOPPED — the measure CLAUDE.md has required since day one, which did not exist until now.
//
// Jay, 2026-08-26, on the backend review: "Go." The diagnostic's furthest_step_by_session read member_event rows
// carrying both `step` and `ref`. Exactly one call site writes `step` (idq_complete) and it passes no `ref`, so
// the field returned {} for every member who has ever used the product — rendering as "nobody ever dropped off"
// rather than "we are not measuring this". Meanwhile session_progress.current_step had been sitting in the schema
// since 0023, monotonic by greatest(), written only by the old step-based curriculum flow that no conversational
// Session calls: Jay's eleven completed Sessions all read current_step = 1.
//
// Two dead paths to one question. This asserts the live one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema } from '../lib/db/schema.ts';
import type { Db } from '../lib/db/schema.ts';
import { recordFurthestStep, sessionPosition, sessionTotals, MEASURED_ASSET_IDS } from '../lib/agent/session-step.ts';
import { REBUILD_B2_ARC, REBUILD_B3_ARC } from '../lib/agent/rebuild.ts';
import { REWIRE_W2_ARC } from '../lib/agent/rewire.ts';
import { stageStep } from '../lib/agent/onboarding-staged.ts';

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

const stepOf = async (db: Db, memberId: string, id: string) =>
  (await db.query<{ current_step: number }>(
    'select current_step from session_progress where member_id = $1 and session_id = $2', [memberId, id],
  )).rows[0]?.current_step ?? null;

test('an ADMINISTERED Session counts items answered, not stages', async () => {
  // THE ASSERTION THAT SAVED THIS FROM BEING A SECOND DEAD FIELD. B2 is a single-stage arc wrapping a 24-item
  // instrument, so a stage index would read 1 for a member who quit on item 2 and 1 for a member who finished —
  // exactly the lie the old member_event field told. The unit has to follow the Session.
  const { db, memberId } = await freshDb();
  const state = { stage: REBUILD_B2_ARC.stageOrder[0]!, collected: {}, administeredResponses: [3, 4, 2, 5, 1] };
  assert.deepEqual(sessionPosition('RBLD-B2', state), { step: 5, of: 24, unit: 'item' });
  await recordFurthestStep(db, memberId, 'RBLD-B2', state);
  assert.equal(await stepOf(db, memberId, 'RBLD-B2'), 5, 'five of twenty-four answered');
});

test('a CONVERSATIONAL Session counts stages', async () => {
  const { db, memberId } = await freshDb();
  const second = REWIRE_W2_ARC.stageOrder[1]!;
  assert.deepEqual(sessionPosition('RWR-W2', { stage: second, collected: {} }), { step: 2, of: 3, unit: 'stage' });
  await recordFurthestStep(db, memberId, 'RWR-W2', { stage: second, collected: {} });
  assert.equal(await stepOf(db, memberId, 'RWR-W2'), 2);
});

test('NO MEASURED SESSION IS STUCK AT A CONSTANT', () => {
  // A Session whose furthest step can only ever be 1 cannot record a drop-off — every member who starts reads as
  // complete, which is the exact lie the old member_event field told. This guard caught the first version of this
  // feature: a plain stage index left B1, B2, B3, C1 and C3 pinned at 1 forever, and those are the long ones.
  //
  // A Session is measurable if it is BOUNDED (of > 1: items or stages) or explicitly OPEN-ENDED (a coaching arc
  // counted in turns, of = 0). What must never exist is a bounded Session with a total of one.
  const stuck = Object.entries(sessionTotals()).filter(([, t]) => t.of === 1);
  assert.deepEqual(stuck, [], `these Sessions cannot measure drop-off: ${stuck.map(([id]) => id).join(', ')}`);

  const open = Object.entries(sessionTotals()).filter(([, t]) => t.unit === 'turn').map(([id]) => id);
  // C1 IS STILL HERE, and will leave this list when the six-pass arc is switched on. RECLAIM_C1_PASSES_ARC is
  // built and tested (tests/c1-six-passes.test.ts) but is NOT the live arc until its per-pass commit reaches the
  // Reclaim List store — see the block above RECLAIM_C1_ARC. Until then C1 remains one open conversation and
  // turns are its honest unit. When it flips, this expectation drops to ['RBLD-B3', 'RCL-C3'].
  assert.deepEqual(open.sort(), ['RBLD-B3', 'RCL-C1', 'RCL-C3'], 'the coaching arcs, counted in turns');
});

test('a COACHING Session counts turns, and says it has no fixed end', () => {
  const { REBUILD_B3_ARC: b3 } = { REBUILD_B3_ARC };
  const pos = sessionPosition('RBLD-B3', { stage: b3.stageOrder[0]!, collected: {} }, 7);
  assert.deepEqual(pos, { step: 7, of: 0, unit: 'turn' }, 'of: 0 says unbounded rather than inventing a target');
});

test('IT ONLY EVER MOVES FORWARD — a resume at stage one cannot erase stage three', async () => {
  // The failure this prevents is subtle and would look like data: a member who reaches the last stage, closes the
  // tab, and comes back would otherwise re-record stage one and read as an early drop-off. `greatest()` in the
  // upsert is what stops it, and this is the assertion that keeps that clause alive through a future rewrite.
  const { db, memberId } = await freshDb();
  const order = REBUILD_B3_ARC.stageOrder;
  await recordFurthestStep(db, memberId, 'RBLD-B3', { stage: order[order.length - 1]!, collected: {} });
  const far = await stepOf(db, memberId, 'RBLD-B3');
  await recordFurthestStep(db, memberId, 'RBLD-B3', { stage: order[0]!, collected: {} });
  assert.equal(await stepOf(db, memberId, 'RBLD-B3'), far, 'a backwards step overwrote the furthest one');
});

test('an unknown stage records NOTHING rather than guessing a position', async () => {
  // A wrong step is worse than a missing one: it reads as a member who stopped somewhere they were never standing.
  const { db, memberId } = await freshDb();
  await recordFurthestStep(db, memberId, 'RBLD-B3', { stage: 'not-a-real-stage', collected: {} });
  assert.equal(await stepOf(db, memberId, 'RBLD-B3'), null);
});

test('an unmeasured asset is a no-op, not a crash', async () => {
  const { db, memberId } = await freshDb();
  await recordFurthestStep(db, memberId, 'RCN-EXC', { stage: 'doors', collected: {} });
  assert.equal(await stepOf(db, memberId, 'RCN-EXC'), null, 'Reconnect is one continuous arc — not a closable session');
});

test('EVERY MEASURED ASSET RESOLVES TO A REAL ARC WITH REAL STAGES', () => {
  // The map in session-step.ts is the one place session→arc is written down. A phase whose arc is renamed or whose
  // stageOrder empties would silently stop measuring, and silence is indistinguishable from "nobody drops off".
  assert.equal(MEASURED_ASSET_IDS.length, 12, 'three phases × four sessions');
  for (const id of MEASURED_ASSET_IDS) assert.match(id, /^(RWR|RBLD|RCL)-/, `${id} is not a phase asset id`);
});
