import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// v2.3 Rewire journey integration — with REWIRE staged, the curriculum forecast surfaces the CONVERSATIONAL flow
// (W1→W2→W3→Checkpoint at /rewire/…), and closing each session advances the member. The registry resolves the flag
// at module load, so these imports are DYNAMIC (after the env is set) to select the v2.3 phase.
process.env.REWIRE = 'staged';

test('REWIRE_V23 · the guided flow is W1→W2→W3→Checkpoint, route-backed, W1 gated on Reconnect', async () => {
  const { REWIRE_V23 } = await import('../lib/curriculum/content/rewire.ts');
  assert.deepEqual(REWIRE_V23.map((a) => a.id), ['RWR-W1', 'RWR-W2', 'RWR-W3', 'RWR-CHK']);
  assert.equal(REWIRE_V23[0]!.route, '/rewire/{memberId}/w1');
  assert.equal(REWIRE_V23[0]!.gating, 'reconnect_checkpoint_passed', 'W1 unlocks only after the Reconnect ceremony');
  assert.equal(REWIRE_V23[3]!.kind, 'checkpoint');
  assert.equal(REWIRE_V23[3]!.route, '/rewire/{memberId}/checkpoint');
});

async function seedMember(db: Db, email: string): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [email])).rows[0]!.member_id;
}

test('forecast · a Reconnect-complete member is guided W1 → W2 → W3 → Checkpoint at the /rewire routes', async () => {
  const [{ getForecast }, { markSessionClosed, setGate }] = await Promise.all([
    import('../lib/curriculum/view.ts'),
    import('../lib/curriculum/store.ts'),
  ]);
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-journey@x.com');

  // cross into Rewire (the Reconnect ceremony sets this gate)
  await setGate(db, m, 'reconnect_checkpoint_passed');
  let f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RWR-W1', 'the guided next step is the Disinformation Audit');
  assert.equal(f.current?.route, '/rewire/{memberId}/w1', 'routed to the conversational surface, not /session');
  assert.equal(f.current?.openable, true, 'route-backed → built/openable');

  // close W1 → the forecast advances to W2
  await markSessionClosed(db, m, 'RWR-W1');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RWR-W2');
  assert.equal(f.current?.route, '/rewire/{memberId}/w2');

  // close W2 → W3
  await markSessionClosed(db, m, 'RWR-W2');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RWR-W3');

  // close W3 → the Checkpoint
  await markSessionClosed(db, m, 'RWR-W3');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RWR-CHK');
  assert.equal(f.current?.kind, 'checkpoint');
  assert.equal(f.current?.route, '/rewire/{memberId}/checkpoint');

  // cross the Rewire Checkpoint → past Rewire (into Rebuild)
  await setGate(db, m, 'rewire_checkpoint_passed');
  f = await getForecast(db, m);
  assert.notEqual(f.current?.id, 'RWR-CHK', 'the Rewire Checkpoint is done; the member has moved on to Rebuild');
  const rewirePhase = f.phases.find((p) => p.phase === 'rewire');
  assert.equal(rewirePhase?.status, 'Complete', 'Rewire reads Complete once the Checkpoint is crossed');
});

test('markSessionClosed · idempotent; closes a conversational session with no prior progress row', async () => {
  const { markSessionClosed, closedSessionIds } = await import('../lib/curriculum/store.ts');
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-close@x.com');
  await markSessionClosed(db, m, 'RWR-W1');
  await markSessionClosed(db, m, 'RWR-W1'); // idempotent
  assert.deepEqual(await closedSessionIds(db, m), ['RWR-W1']);
});
