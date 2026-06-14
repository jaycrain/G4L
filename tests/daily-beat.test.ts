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

test('selectReflection prefers the current R (+ universal) and is deterministic per seed', () => {
  const a = selectReflection(REFLECTIONS, 'reconnect', 'm|2026-06-14');
  const b = selectReflection(REFLECTIONS, 'reconnect', 'm|2026-06-14');
  assert.ok(a && b && a.id === b.id); // stable for a given seed (so refresh is stable)
  assert.ok(a!.phase === 'reconnect' || a!.phase === 'universal');
});

test('selectReflection falls back to the full pool when nothing matches the phase', () => {
  const onlyRewire = REFLECTIONS.filter((r) => r.phase === 'rewire');
  const pick = selectReflection(onlyRewire, 'reconnect', 'seed'); // no reconnect/universal available
  assert.ok(pick && pick.phase === 'rewire');
  assert.equal(selectReflection([], 'reconnect', 'seed'), null);
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

test('hard no-repeat until all 70 are spent, then it reshuffles', async () => {
  const { db, id } = await seedMember();
  const picks: string[] = [];
  for (let d = 0; d < 70; d++) {
    const r = await getDailyBeat(db, id, 'reconnect', day(d));
    assert.ok(r);
    picks.push(r!.id);
  }
  assert.equal(new Set(picks).size, 70, 'every reflection appears exactly once across the 70-day cycle');
  // Day 71 starts a fresh cycle — a repeat is now allowed (resurfacing is a feature).
  const reshuffled = await getDailyBeat(db, id, 'reconnect', day(70));
  assert.ok(reshuffled && REFLECTIONS.some((x) => x.id === reshuffled!.id));
});
