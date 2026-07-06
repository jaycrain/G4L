import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { REFLECTIONS } from '../lib/daily-beat/reflections.ts';
import { selectReflection, getDailyBeat } from '../lib/daily-beat/store.ts';

const PHASES = ['reconnect', 'rewire', 'rebuild', 'reclaim', 'universal'];

test('the library is 70 reflections, each phase-tagged + keepable', () => {
  assert.equal(REFLECTIONS.length, 70);
  for (const r of REFLECTIONS) {
    assert.ok(PHASES.includes(r.phase), `phase: ${r.phase}`);
    assert.equal(r.keepable, true);
  }
});

test('selectReflection serves the phase-agnostic CALL pool (universal) only, deterministic per seed', () => {
  const a = selectReflection(REFLECTIONS, 'reconnect', 'm|2026-06-14');
  const b = selectReflection(REFLECTIONS, 'reconnect', 'm|2026-06-14');
  assert.ok(a && b && a.id === b.id); // stable for a given seed (so refresh is stable)
  assert.equal(a!.phase, 'universal', 'the Momentum daily call is a phase-agnostic rep — never phase/Session content');
});

test('selectReflection NEVER serves phase CONTENT — reshuffles the call pool instead of showing a Session reflection', () => {
  const onlyRewire = REFLECTIONS.filter((r) => r.phase === 'rewire'); // only phase-content unspent (no universal)
  const pick = selectReflection(onlyRewire, 'reconnect', 'seed');
  assert.ok(pick && pick.phase === 'universal', 'falls back to the universal call pool, not the phase content');
});

async function seedMember(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = (
    await db.query<{ member_id: string }>("insert into member_profile (display_name, email) values ('T','t@x.com') returning member_id")
  ).rows[0]!.member_id;
  return { db, id };
}

const day = (n: number): string => {
  const d = new Date(Date.UTC(2026, 0, 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test('one reflection per day, stable on refresh', async () => {
  const { db, id } = await seedMember();
  const first = await getDailyBeat(db, id, 'reconnect', day(0));
  const refresh = await getDailyBeat(db, id, 'reconnect', day(0)); // same day, reloaded
  assert.ok(first && refresh && first.id === refresh.id);
});

test('daily call: no-repeat within the call pool, every pick is a rep (never phase content), then reshuffles', async () => {
  const { db, id } = await seedMember();
  const CALL = REFLECTIONS.filter((r) => r.phase === 'universal');
  const picks: string[] = [];
  for (let d = 0; d < CALL.length; d++) {
    const r = await getDailyBeat(db, id, 'reconnect', day(d));
    assert.ok(r && r.phase === 'universal', 'every daily call is a phase-agnostic rep, never an identity/Session prompt');
    picks.push(r!.id);
  }
  assert.equal(new Set(picks).size, CALL.length, 'all call reps appear once before any repeat');
  // Next day reshuffles the call pool — a repeat is now allowed (resurfacing is fine); still never phase content.
  const reshuffled = await getDailyBeat(db, id, 'reconnect', day(CALL.length));
  assert.ok(reshuffled && reshuffled.phase === 'universal');
});
