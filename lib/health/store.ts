// Persistence for the operator health log (migration 0034). One row per check name. recordHealth
// returns the PRIOR row so the caller can detect an ok<->down transition and alert only on change.

import type { Db } from '../db/schema.ts';
import type { AiHealth } from './ai.ts';

export type HealthRow = {
  check_name: string;
  status: string;
  detail: string | null;
  latency_ms: number | null;
  checked_at: string;
};

export async function getHealth(db: Db, name: string): Promise<HealthRow | null> {
  const { rows } = await db.query<HealthRow>(
    'select check_name, status, detail, latency_ms, checked_at from system_health where check_name=$1',
    [name],
  );
  return rows[0] ?? null;
}

/** Upsert the latest result; returns the row as it was BEFORE this write (null if first ever). */
export async function recordHealth(db: Db, name: string, h: AiHealth): Promise<HealthRow | null> {
  const prev = await getHealth(db, name);
  await db.query(
    `insert into system_health (check_name, status, detail, latency_ms, checked_at)
     values ($1,$2,$3,$4, now())
     on conflict (check_name) do update
       set status=excluded.status, detail=excluded.detail, latency_ms=excluded.latency_ms, checked_at=now()`,
    [name, h.status, h.detail, h.latencyMs],
  );
  // History is a SEPARATE write, not part of the upsert: the "right now" row must land even if the history
  // table isn't there yet (or fails), which is the whole point of being schema-tolerant.
  await appendHealthEvent(db, name, h);
  return prev;
}

// ── HISTORY (migration 0065) ────────────────────────────────────────────────────────────────────────────────
//
// `system_health` is keyed on check_name and upserted, so each probe erased the one before it: we could answer
// "is it up now" and nothing else. "Has it been flaky this week" is the question an operator actually has, and
// we were discarding the only data that could answer it every 15 minutes.
//
// SCHEMA-TOLERANT ON PURPOSE. Prod migrations here are applied BY HAND, so new code and new schema never land
// at the same instant — and I have already taken the product down once by forgetting that (SEC-12, reverted
// within minutes). Everything below works on BOTH shapes: before 0065 the writes no-op and the reads return
// empty, so the page degrades to exactly today's behaviour rather than erroring.
//
// The cache holds only the POST-migration answer. Caching "no table" would leave a running instance blind
// until it restarted, even after the migration landed.

let eventTableConfirmed = false;
/** Test seam — drop the cached answer so a fresh DB can be probed again. */
export function __resetHealthSchemaCache(): void { eventTableConfirmed = false; }

async function hasEventTable(db: Db): Promise<boolean> {
  if (eventTableConfirmed) return true;
  try {
    const { rows } = await db.query<{ e: boolean }>(
      `select exists (select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'system_health_event') as e`,
    );
    eventTableConfirmed = Boolean(rows[0]?.e);
    return eventTableConfirmed;
  } catch {
    return false;
  }
}

/** Append one probe result. Best-effort: a failure here must never break the probe or the page. */
export async function appendHealthEvent(db: Db, name: string, h: AiHealth): Promise<void> {
  if (!(await hasEventTable(db))) return;
  try {
    await db.query(
      `insert into system_health_event (check_name, status, detail, latency_ms) values ($1,$2,$3,$4)`,
      [name, h.status, h.detail, h.latencyMs],
    );
    // Prune on write. An operator log nobody prunes is a table someone finds at 40M rows.
    await db.query(`delete from system_health_event where checked_at < now() - interval '90 days'`);
  } catch (e) {
    console.error('[health] could not append history event:', e);
  }
}

export type HealthEvent = { status: string; detail: string | null; latency_ms: number | null; checked_at: string };

/** Recent probes for one check, oldest→newest. Empty before 0065 is applied. */
export async function getHealthHistory(db: Db, name: string, hours = 24 * 7): Promise<HealthEvent[]> {
  if (!(await hasEventTable(db))) return [];
  try {
    const { rows } = await db.query<HealthEvent>(
      `select status, detail, latency_ms, checked_at from system_health_event
        where check_name = $1 and checked_at > now() - make_interval(hours => $2)
        order by checked_at asc`,
      [name, Math.round(hours)],
    );
    return rows;
  } catch (e) {
    // Loud, not silent: an empty history and a broken read look identical on the page, and the second is
    // the one worth knowing about.
    console.error('[health] history read failed — rendering as no history:', e);
    return [];
  }
}
