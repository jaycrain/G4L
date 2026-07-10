import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../lib/agent/arc-session.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

// W-15 — the phase-arc save/resume store. A refresh/crash mid-Reconnect used to lose the excavation (client-held only);
// this persists the working state + transcript per (member, arc) so it resumes. Keyed by member_id (account exists).

async function seedMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Tom Miller','tom@x.com','Cyclist','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

const state: ConvState = { stage: 'doors', collected: { doors: ['body'], identityNoun: 'Cyclist' } };
const messages: ConvMessage[] = [
  { role: 'agent', text: 'Welcome back — the door you named was the body.' },
  { role: 'member', text: 'yeah, my knees gave out and I stopped' },
  { role: 'agent', text: 'That’s the moment it started. Say more?' },
];

test('save then load round-trips the Reconnect state + transcript', async () => {
  const { db, memberId } = await seedMember();
  await saveArcSession(db, memberId, 'reconnect', state, messages);
  const got = await loadArcSession(db, memberId, 'reconnect');
  assert.ok(got);
  assert.equal(got!.state.stage, 'doors');
  assert.deepEqual(got!.state.collected.doors, ['body']);
  assert.equal(got!.messages.length, 3);
  assert.equal(got!.messages[1]!.text, 'yeah, my knees gave out and I stopped');
});

test('stored as real jsonb (object/array), not a double-encoded scalar string', async () => {
  const { db, memberId } = await seedMember();
  await saveArcSession(db, memberId, 'reconnect', state, messages);
  const t = (
    await db.query<{ st: string; mt: string }>(
      'select jsonb_typeof(state) st, jsonb_typeof(messages) mt from arc_session where member_id=$1 and arc=$2',
      [memberId, 'reconnect'],
    )
  ).rows[0]!;
  assert.equal(t.st, 'object');
  assert.equal(t.mt, 'array');
});

test('no session for this member/arc → load returns null (client starts fresh)', async () => {
  const { db, memberId } = await seedMember();
  assert.equal(await loadArcSession(db, memberId, 'reconnect'), null);
});

test('arcs are isolated — a reconnect session does not leak into rewire', async () => {
  const { db, memberId } = await seedMember();
  await saveArcSession(db, memberId, 'reconnect', state, messages);
  assert.equal(await loadArcSession(db, memberId, 'rewire'), null);
});

test('saving again upserts (one in-flight session per member+arc)', async () => {
  const { db, memberId } = await seedMember();
  await saveArcSession(db, memberId, 'reconnect', state, messages);
  const advanced: ConvState = { stage: 'measurement', collected: { ...state.collected } };
  await saveArcSession(db, memberId, 'reconnect', advanced, [...messages, { role: 'member', text: 'ok' }]);
  const got = await loadArcSession(db, memberId, 'reconnect');
  assert.equal(got!.state.stage, 'measurement');
  assert.equal(got!.messages.length, 4);
  const n = (await db.query<{ n: number }>('select count(*)::int n from arc_session where member_id=$1', [memberId])).rows[0]!.n;
  assert.equal(n, 1);
});

test('clear removes the session (arc completed at the ceremony)', async () => {
  const { db, memberId } = await seedMember();
  await saveArcSession(db, memberId, 'reconnect', state, messages);
  await clearArcSession(db, memberId, 'reconnect');
  assert.equal(await loadArcSession(db, memberId, 'reconnect'), null);
});
