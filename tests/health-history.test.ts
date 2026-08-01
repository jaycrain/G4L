import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { recordHealth, getHealth, getHealthHistory, __resetHealthSchemaCache } from '../lib/health/store.ts';
import { summarizeHealth, incidentLength, type Incident } from '../lib/health/summary.ts';
import type { HealthEvent } from '../lib/health/store.ts';

const ev = (status: string, minsAgo: number, latency: number | null = 400, detail: string | null = null): HealthEvent => ({
  status, detail, latency_ms: latency,
  checked_at: new Date(Date.UTC(2026, 7, 1, 12, 0, 0) - minsAgo * 60_000).toISOString(),
});
const NOW = Date.UTC(2026, 7, 1, 12, 0, 0);

/* ── THE SUMMARY: judgement calls, pinned ──────────────────────────────────────────────────────────────── */

test('no probes is NOT 100% uptime', () => {
  // Claiming perfect uptime from zero data is the same lie as an empty feed reading "nothing happened".
  const s = summarizeHealth([]);
  assert.equal(s.okPct, null);
  assert.equal(s.probes, 0);
  assert.deepEqual(s.incidents, []);
});

test('consecutive failures are ONE incident, not ten', () => {
  // Ten probes failing across an hour is one outage. Reporting it as ten would make a single bad afternoon
  // look like a service falling apart, and an operator would stop believing the page.
  const s = summarizeHealth([
    ev('ok', 60), ev('down', 45), ev('down', 30), ev('down', 15), ev('ok', 5),
  ]);
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0]!.probes, 3);
  assert.equal(s.incidents[0]!.status, 'down');
});

test('a change of failure KIND starts a new incident', () => {
  // "overloaded for an hour" and "key rejected for an hour" are different problems with different fixes;
  // collapsing them into one line would hide the second.
  const s = summarizeHealth([ev('overloaded', 40), ev('overloaded', 30), ev('auth', 20), ev('ok', 10)]);
  assert.equal(s.incidents.length, 2);
  assert.deepEqual(s.incidents.map((i) => i.status), ['auth', 'overloaded']); // newest first
});

test('an incident still open at the end of the window has no end time', () => {
  const s = summarizeHealth([ev('ok', 30), ev('down', 20), ev('down', 10)]);
  assert.equal(s.incidents[0]!.to, null, 'guessing an end time would invent a recovery that has not happened');
  assert.match(incidentLength(s.incidents[0]!, NOW), /counting/);
});

test('latency is the MEDIAN, and only from healthy probes', () => {
  // One 30s timeout would drag a mean into fiction while the typical experience was fine. And a failed
  // probe's duration measures the failure, not the service.
  const s = summarizeHealth([ev('ok', 50, 300), ev('ok', 40, 400), ev('ok', 30, 500), ev('down', 20, 30000)]);
  assert.equal(s.medianLatencyMs, 400);
});

test('uptime keeps one decimal — 99.4% and 100% are different stories', () => {
  const s = summarizeHealth([...Array(999).fill(0).map((_, i) => ev('ok', i + 2)), ev('down', 1)]);
  assert.equal(s.okPct, 99.9);
});

/* ── THE STORE: must work on BOTH schema shapes ────────────────────────────────────────────────────────── */

test('history round-trips once 0065 exists', async () => {
  __resetHealthSchemaCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await recordHealth(db, 'ai', { status: 'ok', detail: null, latencyMs: 120 } as never);
  await recordHealth(db, 'ai', { status: 'down', detail: 'timeout', latencyMs: null } as never);

  const hist = await getHealthHistory(db, 'ai');
  assert.equal(hist.length, 2, 'the history came back empty — the read is broken, not the history');
  assert.deepEqual(hist.map((h) => h.status), ['ok', 'down'], 'oldest → newest');
  assert.equal((await getHealth(db, 'ai'))!.status, 'down', 'and the "right now" row still works');
});

test('BEFORE the migration: writes no-op, reads are empty, the probe still records', async () => {
  // The rule I broke once and will not break again (SEC-12): prod migrations are applied BY HAND, so new code
  // and new schema never land together. This must survive the gap — degrading to today's behaviour, not 500s.
  __resetHealthSchemaCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('drop table if exists system_health_event');

  await recordHealth(db, 'ai', { status: 'ok', detail: null, latencyMs: 90 } as never);
  assert.equal((await getHealth(db, 'ai'))!.status, 'ok', 'the latest-status row MUST still land');
  assert.deepEqual(await getHealthHistory(db, 'ai'), [], 'and history reads as empty rather than throwing');
});

test('the schema probe caches only the POSITIVE answer', async () => {
  // Caching "no table" would leave a running instance blind until it restarted, even after the migration
  // landed — the outage would outlive its own cause.
  __resetHealthSchemaCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('drop table if exists system_health_event');
  assert.deepEqual(await getHealthHistory(db, 'ai'), []);

  await db.query(`create table system_health_event (
    id bigserial primary key, check_name text not null, status text not null,
    detail text, latency_ms int, checked_at timestamptz not null default now())`);
  await recordHealth(db, 'ai', { status: 'ok', detail: null, latencyMs: 50 } as never);
  assert.equal((await getHealthHistory(db, 'ai')).length, 1, 'it must pick the table up without a restart');
});
