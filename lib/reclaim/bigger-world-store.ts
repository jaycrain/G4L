// C2 · Bigger World Audit register store (bigger_world_reading / 0054, reflections added by 0075). Persists the 20
// ratings, the RC-1 priorities, and the member's own reflections; reads the latest. Longitudinal (RC-4): the member
// can revisit their priorities across cycles. Parallel register, NEVER in Grinta (C4 owns the Challenge component).

import type { Db } from '../db/schema.ts';
import { scoreAudit, auditResponsesMap, type AuditScore } from './bigger-world-scoring.ts';
import { AUDIT_DOMAINS, type AuditDomain, type AuditSortKey } from './bigger-world-instrument.ts';

/** One domain's reflection half (V4 Q3/Q7/Q8). EVERY FIELD OPTIONAL — the open questions are skippable by design. */
export type DomainReflection = {
  subIssues?: string[]; // the named sub-issues they picked, plus anything they typed
  gapNote?: string; // Q3 — what the gap actually is, in their words
  obstacle?: string; // Q7 — what keeps it in place
  earlyAction?: string; // Q8 — one thing that would start moving it
};

/** The cross-domain sort (Audit Step 2). `focus` is the deciding one — it becomes First Focus. */
export type AuditSort = Partial<Record<AuditSortKey, AuditDomain>>;

export type AuditReflections = {
  domains: Partial<Record<AuditDomain, DomainReflection>>;
  sort?: AuditSort;
};

export type BiggerWorldReading = {
  sequenceNo: number;
  takenOn: string;
  priorities: AuditScore;
  /** Null for any reading taken before v3.3 — those members were never asked. Not the same as "answered nothing". */
  reflections: AuditReflections | null;
};

// Drop empty strings rather than storing them: a skipped question must be ABSENT, not "". Otherwise a member who
// declined and a member who typed nothing become the same row, and the close would cheerfully quote "" back at them
// as their obstacle.
function tidy(r: DomainReflection | undefined): DomainReflection | undefined {
  if (!r) return undefined;
  const out: DomainReflection = {};
  const s = (v: string | undefined): string | undefined => (v ?? '').trim() || undefined;
  const subs = (r.subIssues ?? []).map((x) => x.trim()).filter(Boolean);
  if (subs.length) out.subIssues = subs;
  if (s(r.gapNote)) out.gapNote = s(r.gapNote);
  if (s(r.obstacle)) out.obstacle = s(r.obstacle);
  if (s(r.earlyAction)) out.earlyAction = s(r.earlyAction);
  return Object.keys(out).length ? out : undefined;
}

/** Normalise before storage — and return null when the member gave us nothing at all. */
export function tidyReflections(input: AuditReflections | null | undefined): AuditReflections | null {
  if (!input) return null;
  const domains: Partial<Record<AuditDomain, DomainReflection>> = {};
  for (const d of AUDIT_DOMAINS) {
    const t = tidy(input.domains?.[d]);
    if (t) domains[d] = t;
  }
  const sort = input.sort && Object.keys(input.sort).length ? input.sort : undefined;
  if (!Object.keys(domains).length && !sort) return null;
  return sort ? { domains, sort } : { domains };
}

// Persist a C2 audit — the raw 20 ratings, the computed priorities, and the member's reflections. sequence_no is the
// count of prior 'c2' readings (0 = the v2.5 baseline). Same idempotent posture as the other registers; the caller
// wraps best-effort (and LOGS on failure — a silently dropped register is indistinguishable from "never taken").
export async function persistBiggerWorldReading(
  db: Db,
  memberId: string,
  responses: number[],
  reflections?: AuditReflections | null,
): Promise<void> {
  const priorities = scoreAudit(responses); // throws unless exactly 20 responses
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from bigger_world_reading where member_id=$1 and source='c2'`,
    [memberId],
  );
  const sequenceNo = rows[0]?.n ?? 0;
  const tidied = tidyReflections(reflections);
  await db.query(
    `insert into bigger_world_reading (member_id, source, sequence_no, responses, priorities, reflections)
     values ($1, 'c2', $2, $3::jsonb, $4::jsonb, $5::jsonb)
     on conflict (member_id, source, sequence_no) do nothing`,
    [
      memberId,
      sequenceNo,
      JSON.stringify(auditResponsesMap(responses)),
      JSON.stringify(priorities),
      tidied ? JSON.stringify(tidied) : null,
    ],
  );
}

// The member's latest C2 audit (for the Member Agent — it should know the member's current Reclaim priorities AND
// what they said in their own words, so it can support the focus they chose rather than the one we computed).
// Null on none / on error (drift-hardened).
export async function latestBiggerWorldReading(db: Db, memberId: string): Promise<BiggerWorldReading | null> {
  try {
    const { rows } = await db.query<{
      sequence_no: number;
      taken_on: string;
      priorities: AuditScore;
      reflections: AuditReflections | string | null;
    }>(
      `select sequence_no, taken_on, priorities, reflections from bigger_world_reading
        where member_id=$1 and source='c2' order by sequence_no desc limit 1`,
      [memberId],
    );
    const r = rows[0];
    if (!r) return null;
    // pg returns jsonb as an object; PGlite has handed back a string in places. Parse defensively rather than
    // assume — the same shape that bit latestWhyReading.
    const refl = typeof r.reflections === 'string' ? (JSON.parse(r.reflections) as AuditReflections) : r.reflections;
    return {
      sequenceNo: r.sequence_no,
      takenOn: String(r.taken_on),
      priorities: r.priorities,
      reflections: refl ?? null,
    };
  } catch (e) {
    console.error(`latestBiggerWorldReading failed for member=${memberId}:`, (e as Error).message);
    return null;
  }
}

/**
 * FIRST FOCUS — the member's choice, not the arithmetic.
 *
 * Audit Step 2 asks outright which single area they'd move on in the next 30 days, and the ratings independently
 * compute a Primary. They can disagree, and when they do the MEMBER WINS (Jay, 2026-08-09). A program whose whole
 * posture is "never a verdict" cannot then tell someone their own priority is wrong. The computed ranking still
 * gets shown — as reflection, never as correction.
 *
 * Falls back to the computed primary only when they didn't answer.
 */
export function firstFocus(reading: BiggerWorldReading): { domain: AuditDomain; chosenByMember: boolean } {
  const chosen = reading.reflections?.sort?.focus;
  return chosen ? { domain: chosen, chosenByMember: true } : { domain: reading.priorities.primary, chosenByMember: false };
}

/**
 * KEY OBSTACLE and FIRST ACTION for the close — taken from the domain that became First Focus, in the member's own
 * words. Deterministic on purpose: the alternative is asking a model to pick a "main" obstacle across four answers,
 * which is a guess dressed as a finding. Undefined when they skipped that question — the close must then say
 * nothing rather than invent one.
 */
export function closingLines(reading: BiggerWorldReading): { keyObstacle?: string; firstAction?: string } {
  const { domain } = firstFocus(reading);
  const r = reading.reflections?.domains?.[domain];
  return { keyObstacle: r?.obstacle, firstAction: r?.earlyAction };
}
