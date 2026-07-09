// C2 · Bigger World Audit register store (bigger_world_reading / 0054). Persists the 20 ratings + the RC-1 priorities,
// and reads the latest. Longitudinal (RC-4): the member can revisit their priorities across cycles. Parallel register,
// NEVER in Grinta (C4 owns the Challenge component).

import type { Db } from '../db/schema.ts';
import { scoreAudit, auditResponsesMap, type AuditScore } from './bigger-world-scoring.ts';

export type BiggerWorldReading = { sequenceNo: number; takenOn: string; priorities: AuditScore };

// Persist a C2 audit — the raw 20 ratings + the computed priorities. sequence_no is the count of prior 'c2' readings
// (0 = the v2.5 baseline). Same idempotent posture as the other registers; the caller wraps best-effort.
export async function persistBiggerWorldReading(db: Db, memberId: string, responses: number[]): Promise<void> {
  const priorities = scoreAudit(responses); // throws unless exactly 20 responses
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from bigger_world_reading where member_id=$1 and source='c2'`,
    [memberId],
  );
  const sequenceNo = rows[0]?.n ?? 0;
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, responses, priorities)
     values ($1, 'c2', $2, $3::jsonb, $4::jsonb)
     on conflict (member_id, source, sequence_no) do nothing`,
    [memberId, sequenceNo, JSON.stringify(auditResponsesMap(responses)), JSON.stringify(priorities)],
  );
}

// The member's latest C2 audit (for the Member Agent — it should know the member's current Reclaim priorities, so it
// can support the primary focus and the momentum lever). Null on none / on error (drift-hardened).
export async function latestBiggerWorldReading(db: Db, memberId: string): Promise<BiggerWorldReading | null> {
  try {
    const { rows } = await db.query<{ sequence_no: number; taken_on: string; priorities: AuditScore }>(
      `select sequence_no, taken_on, priorities from bigger_world_reading
        where member_id=$1 and source='c2' order by sequence_no desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    return r ? { sequenceNo: r.sequence_no, takenOn: String(r.taken_on), priorities: r.priorities } : null;
  } catch {
    return null;
  }
}
