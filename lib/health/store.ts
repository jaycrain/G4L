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
  return prev;
}
