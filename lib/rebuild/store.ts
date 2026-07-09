// Rebuild B1 register store — persists + reads the "What is Your Why?" SDT motivation reading (0050). A parallel
// register, NEVER folded into Grinta (Decision RB-1). The numeric profile is STORED here but NOT displayed in v2.4;
// the read path exists so the Member Agent KNOWS the member named their why (CLAUDE.md reconciliation), even though
// it never shows the number.

import type { Db } from '../db/schema.ts';
import { scoreWhy, whyResponsesMap, type WhyScore } from './why-instrument.ts';

export type WhyReading = { sequenceNo: number; takenOn: string; scores: WhyScore };

// Persist a B1 reading — the raw responses (self-describing) + the computed SDT profile. sequence_no is the count of
// prior 'b1' readings for the member (0 = first / the v2.4 baseline). The unique (member, source, sequence_no)
// constraint makes a concurrent double-submit collide rather than duplicate (on conflict do nothing). Throws only if
// the response count is wrong (scoreWhy guards) — the caller wraps this best-effort so a write hiccup never breaks
// the member's close.
export async function persistWhyReading(db: Db, memberId: string, responses: number[]): Promise<void> {
  const scores = scoreWhy(responses); // throws unless exactly 12 responses
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from motivation_reading where member_id=$1 and source='b1'`,
    [memberId],
  );
  const sequenceNo = rows[0]?.n ?? 0;
  await db.query(
    `insert into motivation_reading (member_id, source, sequence_no, responses, scores)
     values ($1, 'b1', $2, $3::jsonb, $4::jsonb)
     on conflict (member_id, source, sequence_no) do nothing`,
    [memberId, sequenceNo, JSON.stringify(whyResponsesMap(responses)), JSON.stringify(scores)],
  );
}

// The member's latest B1 reading (for the Member Agent — it must KNOW the member has named their why, RB-1). Returns
// null if none / on error (drift-hardened, same posture as the other agent-context reads).
export async function latestWhyReading(db: Db, memberId: string): Promise<WhyReading | null> {
  try {
    const { rows } = await db.query<{ sequence_no: number; taken_on: string; scores: WhyScore }>(
      `select sequence_no, taken_on, scores from motivation_reading
        where member_id=$1 and source='b1' order by sequence_no desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    return r ? { sequenceNo: r.sequence_no, takenOn: String(r.taken_on), scores: r.scores } : null;
  } catch {
    return null;
  }
}
