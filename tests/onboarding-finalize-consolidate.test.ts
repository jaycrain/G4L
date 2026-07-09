// T3 data round-trip (W-08): prove that a Reclaim List carrying a stray close phrase ("Those are the highlights")
// commits CLEAN — the junk never reaches member_profile / the dashboard. finalizeOnboardingAction consolidates the
// list (items + categories in lockstep) BEFORE runOnboarding persists it; this test replicates that exact path
// against an ephemeral Postgres (pglite), asserting confirmed == persisted with no junk item.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { scriptedProvider } from '../lib/agent/provider.ts';
import { runOnboarding, getDashboard } from '../lib/gateway/flow.ts';
import { consolidateReclaim } from '../lib/member/reclaim.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

test('finalize round-trip — a trailing close phrase is dropped at consolidation and never persists (W-08)', async () => {
  const db = await freshDb();
  // The founder's exact card state: four real wants + the stray "Those are the highlights" captured as a 5th item.
  const rawList = [
    'Fitness back — riding up to Brainard Lake',
    'Losing 25 more lbs',
    'Show up ready to Big Sugar gravel race',
    'Launch Grinta For Life with Greg',
    'Those are the highlights',
  ];
  // finalizeOnboardingAction consolidates (items + categories lockstep) BEFORE runOnboarding — replicate that step.
  const consolidated = consolidateReclaim(rawList, []);
  assert.ok(!consolidated.items.some((x) => /highlights/i.test(x)), 'consolidation drops the close phrase pre-persist');
  assert.equal(consolidated.items.length, 4, 'the four real wants survive consolidation');

  const ob = await runOnboarding(db, scriptedProvider, {
    displayName: 'Jay',
    email: 'jay-walk@example.com',
    doors: ['career_cliff', 'marriage', 'load_bearer', 'grind'],
    identityNoun: 'cyclist',
    athleticPast: 'an elite cyclist at his peak',
    gap: 'you stopped training hard but kept riding, then lost the level',
    reclaimList: consolidated.items,
  });
  assert.equal(ob.ok, true, 'onboarding commits');
  if (!ob.ok) return;

  const dash = await getDashboard(db, ob.memberId);
  assert.ok(dash, 'dashboard reads back');
  assert.ok(
    !(dash!.reclaimList ?? []).some((x) => /highlights/i.test(x)),
    'the PERSISTED Reclaim List has NO junk close item',
  );
  assert.equal(dash!.reclaimList.length, 4, 'exactly the four real wants persisted');
  assert.ok(dash!.reclaimList.some((x) => /Brainard Lake/i.test(x)), 'the real wants are intact');
});
