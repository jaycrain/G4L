// Asset-delivery engine: telemetry (started / completed / drop-off) and completion
// persistence. Framework-free (takes a Db) so it's integration-tested headlessly and wrapped
// by server actions. Telemetry is internal QI, captured from day one (CONTRACTS §7).

import type { Db } from '../db/schema.ts';
import type { AssetVariant } from './types.ts';

type EventType = 'started' | 'completed' | 'drop_off';

async function emitEvent(
  db: Db,
  p: { memberId: string; code: string; type: EventType; variant?: AssetVariant | null; timeMs?: number; point?: string; payload?: unknown },
): Promise<void> {
  await db.query(
    `insert into asset_event (member_id, asset_code, event_type, time_on_asset_ms, drop_off_point, variant, payload)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [p.memberId, p.code, p.type, p.timeMs ?? null, p.point ?? null, p.variant ?? null, JSON.stringify(p.payload ?? {})],
  );
}

export function startAsset(db: Db, p: { memberId: string; code: string; variant?: AssetVariant | null }) {
  return emitEvent(db, { ...p, type: 'started' });
}

export function dropOffAsset(
  db: Db,
  p: { memberId: string; code: string; variant?: AssetVariant | null; point: string; timeMs?: number },
) {
  return emitEvent(db, { ...p, type: 'drop_off' });
}

export async function completeAsset(
  db: Db,
  p: {
    memberId: string;
    code: string;
    variant?: AssetVariant | null;
    version: string;
    outputs?: Record<string, unknown>;
    reflection?: string;
    timeMs?: number;
  },
): Promise<{ ok: true }> {
  await db.query(
    `insert into asset_completion (member_id, cycle_indicator, asset_code, variant, asset_version, outputs, reflection)
     values ($1,1,$2,$3,$4,$5::jsonb,$6)
     on conflict (member_id, cycle_indicator, asset_code) do update
       set variant = excluded.variant, asset_version = excluded.asset_version,
           outputs = excluded.outputs, reflection = excluded.reflection, completed_at = now()`,
    [p.memberId, p.code, p.variant ?? null, p.version, JSON.stringify(p.outputs ?? {}), p.reflection ?? null],
  );
  await emitEvent(db, { memberId: p.memberId, code: p.code, type: 'completed', variant: p.variant, timeMs: p.timeMs });
  return { ok: true };
}

/** The set of completed asset codes for gating. Includes 'R-1' when a baseline IDQ exists
 *  (the IDQ completion is recorded as an idq_retake, not an asset_completion). */
export async function completedCodes(db: Db, memberId: string): Promise<Set<string>> {
  const done = await db.query<{ asset_code: string }>(
    `select asset_code from asset_completion where member_id=$1 and cycle_indicator=1`,
    [memberId],
  );
  const set = new Set(done.rows.map((r) => r.asset_code));
  const idq = await db.query<{ n: number }>(
    `select count(*)::int n from idq_retake where member_id=$1 and cycle_indicator=1`,
    [memberId],
  );
  if ((idq.rows[0]?.n ?? 0) > 0) set.add('R-1');
  return set;
}
