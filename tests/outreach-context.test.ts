import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { phaseFromGates, loadContext } from '../lib/outreach/context.ts';
import { setGate } from '../lib/curriculum/store.ts';
import { getOpenOutreach, recordReady, markResponded } from '../lib/outreach/store.ts';

async function member(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Ctx QA','ctx.qa@x.com') returning member_id`,
  );
  return { db, id: rows[0]!.member_id };
}

test('phaseFromGates advances one step per checkpoint', () => {
  assert.equal(phaseFromGates([]), 'reconnect');
  assert.equal(phaseFromGates(['reconnect_checkpoint_passed']), 'rewire');
  assert.equal(phaseFromGates(['reconnect_checkpoint_passed', 'rewire_checkpoint_passed']), 'rebuild');
  assert.equal(phaseFromGates(['reconnect_checkpoint_passed', 'rewire_checkpoint_passed', 'rebuild_checkpoint_passed']), 'reclaim');
});

test('loadContext reads phase from gates + counts closed sessions in that phase', async () => {
  const { db, id } = await member();
  let ctx = await loadContext(db, id);
  assert.equal(ctx.phase, 'reconnect');
  assert.equal(ctx.sessionsInPhase, 0);

  // Close a reconnect session (RCN-EXC belongs to the reconnect phase).
  await db.query(`insert into session_progress (member_id, session_id, status) values ($1,'RCN-EXC','closed')`, [id]);
  ctx = await loadContext(db, id);
  assert.equal(ctx.sessionsInPhase, 1, 'the closed reconnect session counts toward the active phase');

  // Cross into rewire — the reconnect session no longer counts toward the (now rewire) phase.
  await setGate(db, id, 'reconnect_checkpoint_passed');
  ctx = await loadContext(db, id);
  assert.equal(ctx.phase, 'rewire');
  assert.equal(ctx.sessionsInPhase, 0);
});

test('getOpenOutreach returns the unanswered nudge, then null once responded', async () => {
  const { db, id } = await member();
  assert.equal(await getOpenOutreach(db, id), null);
  const rid = await recordReady(db, id, {
    trigger: 'morning_presence', tense: 'present', message: 'You mentioned running. What is here today?',
    provenance: { stream: 'words', ref: 'keeper:1', quote: 'running' },
  });
  const open = await getOpenOutreach(db, id);
  assert.equal(open?.id, rid);
  assert.equal(open?.message, 'You mentioned running. What is here today?');
  await markResponded(db, id, rid, 'dismissed');
  assert.equal(await getOpenOutreach(db, id), null, 'a dismissed nudge is no longer open');
});
