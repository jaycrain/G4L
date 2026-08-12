// Rebuild B1 register store — persists + reads the "What is Your Why?" SDT motivation reading (0050). A parallel
// register, NEVER folded into Grinta (Decision RB-1). The numeric profile is STORED here but NOT displayed in v2.4;
// the read path exists so the Member Agent KNOWS the member named their why (CLAUDE.md reconciliation), even though
// it never shows the number.

import type { Db } from '../db/schema.ts';
import { scoreWhy, whyResponsesMap, WHY_ITEM_COUNT, type WhyScore } from './why-instrument.ts';
import { scoreSkills, skillResponsesMap, type SkillScore } from './skills-instrument.ts';

export type WhyReading = { sequenceNo: number; takenOn: string; scores: WhyScore };
export type SkillsReading = { sequenceNo: number; takenOn: string; scores: SkillScore };

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
     values ($1, 'b1', $2, $3::text::jsonb, $4::text::jsonb)
     on conflict (member_id, source, sequence_no) do nothing`,
    [memberId, sequenceNo, JSON.stringify(whyResponsesMap(responses)), JSON.stringify(scores)],
  );
}

// The member's latest B1 reading (for the Member Agent — it must KNOW the member has named their why, RB-1). Returns
// null if none / on error (drift-hardened, same posture as the other agent-context reads).
export async function latestWhyReading(db: Db, memberId: string): Promise<WhyReading | null> {
  try {
    // `responses` comes back too, purely so an OLD reading can be brought forward. Every B1 reading written before
    // 2026-08-08 has `scores` without relativeAutonomous — Greg's RAM, which we only started computing that day.
    // Rather than migrate production rows, RE-SCORE from the raw responses at read time: they have always been
    // stored, the scoring function is pure, and this makes the measure appear for every existing member at once
    // with no data touched. A backfill would have done the same thing more dangerously and only once.
    const { rows } = await db.query<{ sequence_no: number; taken_on: string; scores: WhyScore; responses: number[] }>(
      `select sequence_no, taken_on, scores, responses from motivation_reading
        where member_id=$1 and source='b1' order by sequence_no desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    if (!r) return null;
    const stale = typeof r.scores?.activity?.relativeAutonomous !== 'number';
    const responses = typeof r.responses === 'string' ? JSON.parse(r.responses) : r.responses;
    const scores = stale && Array.isArray(responses) && responses.length === WHY_ITEM_COUNT
      ? scoreWhy(responses)
      : r.scores;
    return { sequenceNo: r.sequence_no, takenOn: String(r.taken_on), scores };
  } catch {
    return null;
  }
}

// Persist a B2 reading — the raw responses + the computed skill profile. sequence_no is the count of prior 'b2'
// readings (0 = the v2.4 baseline). Same idempotent posture as persistWhyReading; caller wraps best-effort.
export async function persistSkillsReading(db: Db, memberId: string, responses: number[]): Promise<void> {
  const scores = scoreSkills(responses); // throws unless exactly 24 responses
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from self_management_reading where member_id=$1 and source='b2'`,
    [memberId],
  );
  const sequenceNo = rows[0]?.n ?? 0;
  await db.query(
    `insert into self_management_reading (member_id, source, sequence_no, responses, scores)
     values ($1, 'b2', $2, $3::text::jsonb, $4::text::jsonb)
     on conflict (member_id, source, sequence_no) do nothing`,
    [memberId, sequenceNo, JSON.stringify(skillResponsesMap(responses)), JSON.stringify(scores)],
  );
}

// The member's latest B2 reading (for the Member Agent — it must KNOW the member assessed their self-management
// skills, so it references the profile as shared context, never re-administers). Null on none / error (hardened).
export async function latestSkillsReading(db: Db, memberId: string): Promise<SkillsReading | null> {
  try {
    const { rows } = await db.query<{ sequence_no: number; taken_on: string; scores: SkillScore }>(
      `select sequence_no, taken_on, scores from self_management_reading
        where member_id=$1 and source='b2' order by sequence_no desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    return r ? { sequenceNo: r.sequence_no, takenOn: String(r.taken_on), scores: r.scores } : null;
  } catch {
    return null;
  }
}
