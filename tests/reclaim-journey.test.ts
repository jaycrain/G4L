import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// v2.5 Reclaim journey integration — with RECLAIM staged, the curriculum forecast surfaces the CONVERSATIONAL flow
// (C1→C2→C3→C4 Checkpoint at /reclaim/…), and closing each session advances the member. The registry resolves the
// flags at module load, so these imports are DYNAMIC (after the env is set). All prior flags staged too, so the whole
// path is conversational (each file is its own process — flags are isolated).
process.env.REWIRE = 'staged';
process.env.REBUILD = 'staged';
process.env.RECLAIM = 'staged';

test('RECLAIM_V25 · the guided flow is C1→C2→C3→C4, route-backed, C1 gated on Rebuild', async () => {
  const { RECLAIM_V25 } = await import('../lib/curriculum/content/reclaim.ts');
  assert.deepEqual(RECLAIM_V25.map((a) => a.id), ['RCL-C1', 'RCL-C2', 'RCL-C3', 'RCL-C4']);
  assert.equal(RECLAIM_V25[0]!.route, '/reclaim/{memberId}/c1');
  assert.equal(RECLAIM_V25[0]!.gating, 'rebuild_checkpoint_passed', 'C1 unlocks only after the Rebuild ceremony');
  assert.equal(RECLAIM_V25[3]!.kind, 'checkpoint');
  assert.equal(RECLAIM_V25[3]!.route, '/reclaim/{memberId}/c4');
  assert.equal(RECLAIM_V25[3]!.earns, 'reclaim-capstone', 'C4 is the capstone');
});

async function seedMember(db: Db, email: string): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [email])).rows[0]!.member_id;
}

test('forecast · a Rebuild-complete member is guided C1 → C2 → C3 → C4 at the /reclaim routes; the capstone closes the cycle', async () => {
  const [{ getForecast }, { markSessionClosed, setGate }] = await Promise.all([
    import('../lib/curriculum/view.ts'),
    import('../lib/curriculum/store.ts'),
  ]);
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-reclaim-journey@x.com');

  // cross into Reclaim (the three prior ceremonies set these gates)
  await setGate(db, m, 'reconnect_checkpoint_passed');
  await setGate(db, m, 'rewire_checkpoint_passed');
  await setGate(db, m, 'rebuild_checkpoint_passed');
  let f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RCL-C1', 'the guided next step is Readiness Assessment');
  assert.equal(f.current?.route, '/reclaim/{memberId}/c1', 'routed to the conversational surface');
  assert.equal(f.current?.openable, true, 'route-backed → built/openable');
  assert.equal(f.phases.find((p) => p.phase === 'reclaim')?.status, "You're here");

  await markSessionClosed(db, m, 'RCL-C1');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RCL-C2');

  await markSessionClosed(db, m, 'RCL-C2');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RCL-C3');

  await markSessionClosed(db, m, 'RCL-C3');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RCL-C4', 'the guided next step is the Reclaim Checkpoint');
  assert.equal(f.current?.kind, 'checkpoint');
  assert.equal(f.current?.route, '/reclaim/{memberId}/c4');

  // cross the Reclaim Checkpoint → the capstone; the whole cycle is done.
  await setGate(db, m, 'reclaim_checkpoint_passed');
  f = await getForecast(db, m);
  assert.notEqual(f.current?.id, 'RCL-C4', 'the capstone is crossed — no phase session left to light');
  const reclaimItems = f.phases.find((p) => p.phase === 'reclaim')!.items;
  assert.ok(reclaimItems.every((i) => i.state === 'done'), 'every Reclaim item reads done after the capstone');
});
