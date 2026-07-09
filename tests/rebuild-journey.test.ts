import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// v2.4 Rebuild journey integration — with REBUILD staged, the curriculum forecast surfaces the CONVERSATIONAL flow
// (B1→B2→B3→B4 Checkpoint at /rebuild/…), and closing each session advances the member. The registry resolves the
// flags at module load, so these imports are DYNAMIC (after the env is set) to select the v2.4 phase. REWIRE is also
// staged so the whole path is the conversational one (each file is its own process — flags are isolated).
process.env.REWIRE = 'staged';
process.env.REBUILD = 'staged';

test('REBUILD_V24 · the guided flow is B1→B2→B3→B4, route-backed, B1 gated on Rewire', async () => {
  const { REBUILD_V24 } = await import('../lib/curriculum/content/rebuild.ts');
  assert.deepEqual(REBUILD_V24.map((a) => a.id), ['RBLD-B1', 'RBLD-B2', 'RBLD-B3', 'RBLD-B4']);
  assert.equal(REBUILD_V24[0]!.route, '/rebuild/{memberId}/b1');
  assert.equal(REBUILD_V24[0]!.gating, 'rewire_checkpoint_passed', 'B1 unlocks only after the Rewire ceremony');
  assert.equal(REBUILD_V24[3]!.kind, 'checkpoint');
  assert.equal(REBUILD_V24[3]!.route, '/rebuild/{memberId}/b4');
  assert.equal(REBUILD_V24[3]!.earns, 'rebuild-milestone');
});

async function seedMember(db: Db, email: string): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [email])).rows[0]!.member_id;
}

test('forecast · a Rewire-complete member is guided B1 → B2 → B3 → B4 at the /rebuild routes, then Reclaim lights', async () => {
  const [{ getForecast }, { markSessionClosed, setGate }] = await Promise.all([
    import('../lib/curriculum/view.ts'),
    import('../lib/curriculum/store.ts'),
  ]);
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-rebuild-journey@x.com');

  // cross into Rebuild (the Reconnect + Rewire ceremonies set these gates)
  await setGate(db, m, 'reconnect_checkpoint_passed');
  await setGate(db, m, 'rewire_checkpoint_passed');
  let f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RBLD-B1', 'the guided next step is What Is Your Why?');
  assert.equal(f.current?.route, '/rebuild/{memberId}/b1', 'routed to the conversational surface');
  assert.equal(f.current?.openable, true, 'route-backed → built/openable');
  assert.equal(f.phases.find((p) => p.phase === 'rebuild')?.status, "You're here");

  // close B1 → B2 → B3 → B4, advancing each time
  await markSessionClosed(db, m, 'RBLD-B1');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RBLD-B2');
  assert.equal(f.current?.route, '/rebuild/{memberId}/b2');

  await markSessionClosed(db, m, 'RBLD-B2');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RBLD-B3');

  await markSessionClosed(db, m, 'RBLD-B3');
  f = await getForecast(db, m);
  assert.equal(f.current?.id, 'RBLD-B4', 'the guided next step is the Rebuild Checkpoint');
  assert.equal(f.current?.kind, 'checkpoint');
  assert.equal(f.current?.route, '/rebuild/{memberId}/b4');

  // cross the Rebuild Checkpoint → past Rebuild (into Reclaim)
  await setGate(db, m, 'rebuild_checkpoint_passed');
  f = await getForecast(db, m);
  assert.notEqual(f.current?.id, 'RBLD-B4', 'the Rebuild Checkpoint is done; the member has moved on to Reclaim');
  assert.equal(f.phases.find((p) => p.phase === 'rebuild')?.status, 'Complete', 'Rebuild reads Complete once crossed');
  assert.equal(f.phases.find((p) => p.phase === 'reclaim')?.status, "You're here", 'Reclaim is now the active phase');
});
