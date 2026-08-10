// Degrade-not-crash sweep (follow-on to W-13): the member-facing context builders / dashboard loaders must survive a
// SUPPLEMENTARY read failing — a drifted/transient table takes down that one signal, never the whole surface. We prove
// it by wrapping the Db so queries touching a target table REJECT, then asserting the surface still RESOLVES with a
// valid, degraded shape (rather than throwing out to the caller — which, for getDashboard, is the cornerstone rail).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { scriptedProvider } from '../lib/agent/provider.ts';
import { runOnboarding, getDashboard } from '../lib/gateway/flow.ts';
import { loadReconnectCaptures } from '../lib/agent/reconnect.ts';
import { getConnectSummaryForAgent } from '../lib/connect/agent.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

// Wrap a Db so any query whose SQL matches `boom` REJECTS (simulated table drift); everything else passes through.
function driftingDb(db: Db, boom: RegExp): Db {
  return {
    query: (sql: string, params?: unknown[]) =>
      boom.test(sql) ? Promise.reject(new Error(`simulated drift: ${boom}`)) : db.query(sql, params),
  } as Db;
}

async function seedMember(db: Db): Promise<string> {
  const ob = await runOnboarding(db, scriptedProvider, {
    displayName: 'Jay',
    email: 'jay-degrade@example.com',
    doors: ['career_cliff', 'marriage'],
    identityNoun: 'cyclist',
    athleticPast: 'an elite cyclist',
    gap: 'I stopped training hard but kept riding',
    reclaimList: ['ride up to Brainard Lake', 'lose 25 lbs', 'race Big Sugar'],
  });
  assert.equal(ob.ok, true);
  if (!ob.ok) throw new Error('seed failed');
  return ob.memberId;
}

test('getDashboard · member_door read fails → degrades to the named_door primary, never crashes', async () => {
  const db = await freshDb();
  const m = await seedMember(db);
  const dash = await getDashboard(driftingDb(db, /from member_door/), m);
  assert.ok(dash, 'dashboard still renders');
  // The primary Door survives via the named_door fallback (career_cliff was stored as named_door at onboarding).
  assert.equal(dash!.door?.slug, 'career_cliff');
  assert.ok(dash!.doors.length >= 1, 'at least the primary Door is present');
});

test('getDashboard · listMeasures fails → degrades to no measures, never crashes', async () => {
  const db = await freshDb();
  const m = await seedMember(db);
  const dash = await getDashboard(driftingDb(db, /from measure\b/), m);
  assert.ok(dash, 'dashboard still renders');
  assert.deepEqual(dash!.measures, []);
  // The essential hero facts still come through.
  assert.equal(dash!.displayName, 'Jay');
  assert.ok(dash!.reclaimList.length >= 3);
});

test('getDashboard · idq_retake read fails → degrades to no score, never crashes', async () => {
  const db = await freshDb();
  const m = await seedMember(db);
  const dash = await getDashboard(driftingDb(db, /from idq_retake/), m);
  assert.ok(dash, 'dashboard still renders');
  assert.equal(dash!.score, null);
  assert.equal(dash!.currentFocus, null);
});

test('loadReconnectCaptures · member_door read fails → degrades to the named_door primary, never crashes', async () => {
  const db = await freshDb();
  const m = await seedMember(db);
  const captures = await loadReconnectCaptures(driftingDb(db, /from member_door/), m);
  assert.ok(captures, 'captures still load');
  assert.deepEqual(captures!.doors, ['career_cliff'], 'the primary Door survives via named_door');
  assert.equal(captures!.reclaimList.length, 3);
});

test('getConnectSummaryForAgent · every connect read fails → degrades to zero-presence, never crashes', async () => {
  const db = await freshDb();
  const m = await seedMember(db);
  const summary = await getConnectSummaryForAgent(driftingDb(db, /connect/), m);
  assert.equal(summary.hasPresence, false);
  assert.equal(summary.unreadCount, 0);
  assert.deepEqual(summary.recentEngagement, []);
  assert.deepEqual(summary.ownRecentPosts, []);
  assert.deepEqual(summary.pacts, []);
});
