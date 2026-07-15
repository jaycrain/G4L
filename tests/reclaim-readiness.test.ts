import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { reclaimReadiness, RECLAIM_UNLOCK_DAYS } from '../lib/reclaim/readiness.ts';

// The Loop gate — Reclaim opens N days after the Rebuild checkpoint (v1 rule). The readiness predicate is the ONE place
// the policy lives; here it's proven in isolation, then (below) that it flips the hero to the "coming, not active" state.

let seq = 0;
async function member(db: Db): Promise<string> {
  seq += 1;
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('P', $1) returning member_id`, [`rr${seq}@x.com`])).rows[0]!.member_id;
}
const setGateAt = (db: Db, m: string, ageDays: number) =>
  db.query(`insert into phase_gate (member_id, gate, set_at) values ($1, 'rebuild_checkpoint_passed', now() - ($2 || ' days')::interval)`, [m, ageDays]);

test('no Rebuild checkpoint yet → ready (nothing to gate)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  assert.equal((await reclaimReadiness(db, await member(db))).ready, true);
});

test('Rebuild checkpoint just crossed → NOT ready, with an opens-on date and a full countdown', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await setGateAt(db, m, 0);
  const r = await reclaimReadiness(db, m);
  assert.equal(r.ready, false);
  assert.equal(r.daysLeft, RECLAIM_UNLOCK_DAYS);
  assert.ok(r.opensOn && r.reason.length > 0);
});

test('past the unlock window → ready', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await setGateAt(db, m, RECLAIM_UNLOCK_DAYS + 1);
  assert.equal((await reclaimReadiness(db, await (async () => m)())).ready, true);
});

test('at the Reclaim boundary but not ready → the hero reads reclaim-locked (never offers C1)', async () => {
  for (const f of ['REDESIGN', 'RECONNECT', 'REWIRE', 'REBUILD', 'RECLAIM', 'ONBOARDING_ENGINE']) process.env[f] = 'staged';
  const { resolveHero } = await import('../lib/dashboard/hero-signals.ts');
  const { setGate } = await import('../lib/curriculum/store.ts');

  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  // Reconnect + Rewire + Rebuild all crossed (Rebuild just now) — the member is at the Reclaim boundary.
  await setGate(db, m, 'reconnect_checkpoint_passed');
  await setGate(db, m, 'rewire_checkpoint_passed');
  await setGateAt(db, m, 0); // rebuild_checkpoint_passed, today

  const { state } = await resolveHero(db, m);
  assert.equal(state.kind, 'reclaim-locked', 'gated → coming, not active');
});
