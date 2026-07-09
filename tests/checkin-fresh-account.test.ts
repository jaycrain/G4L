// W-13 repro: the companion (openCheckin → buildContext) crashed on a BRAND-NEW account. buildContext lives in a
// 'use server' file that transitively imports next/headers (via authz), so we can't import it here. Instead we probe
// each of buildContext's SUPPLEMENTARY reads directly against a fresh member — whichever REJECTS is the crash source
// (in one Promise.all, any rejection takes the whole builder down). All are plain lib/ modules, no Next deps.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { scriptedProvider } from '../lib/agent/provider.ts';
import { runOnboarding } from '../lib/gateway/flow.ts';

import { getGrinta } from '../lib/grinta/index.ts';
import { getConnectSummaryForAgent } from '../lib/connect/agent.ts';
import { getForecast } from '../lib/curriculum/view.ts';
import { getMemberExperience } from '../lib/telemetry/store.ts';
import { recentConsumedTitles } from '../lib/bites/store.ts';
import { getDailyBeat } from '../lib/daily-beat/store.ts';
import { maybeFoldMemory } from '../lib/agent/memory.ts';
import { playbookForAgent } from '../lib/playbook/store.ts';
import { measuresForAgent } from '../lib/measure/store.ts';
import { getReclaimItems } from '../lib/beats/store.ts';
import { listFacets, closedSessionIds } from '../lib/curriculum/store.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

test('W-13 · which of buildContext’s supplementary reads throws on a brand-new account?', async () => {
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, {
    displayName: 'Jay', email: 'jay-fresh@example.com', doors: ['career_cliff', 'marriage'],
    identityNoun: 'cyclist', athleticPast: 'an elite cyclist',
    gap: 'I stopped training hard but kept riding', reclaimList: ['ride up to Brainard Lake', 'lose 25 lbs', 'race Big Sugar'],
  });
  assert.equal(ob.ok, true);
  if (!ob.ok) return;
  const m = ob.memberId;

  const reads: Array<[string, () => Promise<unknown>]> = [
    ['getGrinta', () => getGrinta(db, m, 'Cyclist')],
    ['getConnectSummaryForAgent', () => getConnectSummaryForAgent(db, m)],
    ['getForecast', () => getForecast(db, m)],
    ['getMemberExperience', () => getMemberExperience(db, m, (id) => id)],
    ['recentConsumedTitles', () => recentConsumedTitles(db, m)],
    ['getDailyBeat', () => getDailyBeat(db, m, null, new Date('2026-07-09').toLocaleDateString('en-CA'))],
    ['maybeFoldMemory', () => maybeFoldMemory(db, m)],
    ['playbookForAgent', () => playbookForAgent(db, m)],
    ['measuresForAgent', () => measuresForAgent(db, m)],
    ['getReclaimItems', () => getReclaimItems(db, m)],
    ['listFacets', () => listFacets(db, m)],
    ['closedSessionIds', () => closedSessionIds(db, m)],
  ];

  const failures: string[] = [];
  for (const [name, fn] of reads) {
    try { await fn(); } catch (e) { failures.push(`${name}: ${(e as Error).message}`); }
  }
  assert.deepEqual(failures, [], `these reads threw on a fresh account:\n${failures.join('\n')}`);
});
