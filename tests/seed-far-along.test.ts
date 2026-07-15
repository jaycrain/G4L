import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

const SEED_ID = '13526e58-1ab1-43b3-925f-5fbd53d1884e';

// Proves scripts/db/seed-far-along.sql executes cleanly against the real schema AND lands the demo member in the
// intended mid-Rebuild state — so a paste into the Supabase SQL Editor won't fail and the walk reaches the late-stage
// UI (completed rings, practice-week hero, the Revisit list). Flags set + modules dynamically imported so the staged
// registry (W1/W2/W3, B1/B2/B3) is live (node --test isolates each file's process — no leak).

test('seed-far-along.sql runs cleanly and lands the demo member mid-Rebuild', async () => {
  for (const f of ['REDESIGN', 'RECONNECT', 'REWIRE', 'REBUILD', 'RECLAIM', 'ONBOARDING_ENGINE']) process.env[f] = 'staged';
  const { getForecast } = await import('../lib/curriculum/view.ts');
  const { resolveHero } = await import('../lib/dashboard/hero-signals.ts');
  const { deriveRingState } = await import('../lib/workspace/ring-state.ts');
  const { completedReviewSessions } = await import('../lib/workspace/review.ts');
  const { readArtifact } = await import('../lib/workspace/artifact.ts');

  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  // The member the seed targets, with an onboarding capture (identity) so it doesn't read as brand-new.
  await db.query(`insert into member_profile (member_id, display_name, email, identity_noun) values ($1,'Reshma','reshma-seed@x.com','Runner')`, [SEED_ID]);

  // Run the ACTUAL seed file, statement by statement (strip the -- comment lines, incl. the commented RESET block).
  const sql = readFileSync(new URL('../scripts/db/seed-far-along.sql', import.meta.url), 'utf8');
  const stmts = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of stmts) await db.query(s);

  // Forecast: Reconnect + Rewire complete, Rebuild is where you are.
  const fc = await getForecast(db, SEED_ID);
  const status = (p: string) => fc.phases.find((x) => x.phase === p)?.status;
  assert.equal(status('reconnect'), 'Complete');
  assert.equal(status('rewire'), 'Complete');
  assert.equal(status('rebuild'), "You're here");

  // Hero: the active practice week (not stranded, not a stale "just finished").
  const { state } = await resolveHero(db, SEED_ID);
  assert.equal(state.kind, 'mid-week-practice');
  assert.equal(state.kind === 'mid-week-practice' && state.practice.kind, 'b2_noticing');

  // Ring: Rebuild reads 2 of 3 (B1 + B2 done); Reconnect + Rewire solid.
  const rings = deriveRingState(fc);
  const rb = rings.find((r) => r.phase === 'rebuild')!;
  assert.equal(rb.done, 2);
  assert.equal(rb.total, 3);
  assert.equal(rings.find((r) => r.phase === 'reconnect')!.fill, 1);
  assert.equal(rings.find((r) => r.phase === 'rewire')!.fill, 1);

  // Revisit list: the completed sessions, Reconnect collapsed to one.
  const keys = completedReviewSessions(fc).map((r) => r.key);
  for (const k of ['reconnect', 'w1', 'w2', 'w3', 'b1', 'b2']) assert.ok(keys.includes(k), `${k} reviewable`);

  // The W1 review has the seeded true lines.
  const w1 = await readArtifact(db, SEED_ID, 'w1');
  assert.match(w1.slots[0]!.value ?? '', /still a runner/);
});
