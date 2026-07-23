// First-class member COMMITMENTS (migration 0060) — the durable, member-owned movement + eating changes the member is
// working on. Supersedes the ephemeral B3-coaching_plan-as-artifact (a swallowed best-effort write that could vanish).
// Member-set + editable (propose→confirm→commit, Decision L), ONE active per domain, releasable (kept as history, never
// a hard delete). Momentum calls tag to these; the Companion reflects follow-through (normalize, NEVER praise) and
// notices lapses (curiosity, never scold). The SET path is deliberately NOT swallowed — a member naming their
// commitment must succeed or surface an error; the loss of the old model was exactly a silently-swallowed write.

import type { Db } from '../db/schema.ts';
import type { CallDomain } from '../momentum/store.ts';

export type CommitmentDomain = CallDomain; // 'activity' | 'diet' — one vocabulary across momentum + commitments
export type CommitmentSource = 'self' | 'b3' | 'companion';
export type Commitment = { id: string; domain: CommitmentDomain; text: string; source: CommitmentSource; updatedAt: string };

export const isCommitmentDomain = (d: unknown): d is CommitmentDomain => d === 'activity' || d === 'diet';
export const DOMAIN_WORD: Record<CommitmentDomain, string> = { activity: 'movement', diet: 'eating' };

// The member's ACTIVE commitments (0–2, one per domain), newest first. Drift-hardened by the caller (empty on a
// pre-0060 DB). Released commitments are history — not returned here.
export async function activeCommitments(db: Db, memberId: string): Promise<Commitment[]> {
  const { rows } = await db.query<{ id: string; domain: string; text: string; source: string; updated_at: string }>(
    `select id, domain, text, source, updated_at::text as updated_at
       from commitment where member_id=$1 and status='active' order by updated_at desc`,
    [memberId],
  );
  return rows.map((r) => ({ id: r.id, domain: r.domain as CommitmentDomain, text: r.text, source: r.source as CommitmentSource, updatedAt: r.updated_at }));
}

// { activity?: text, diet?: text } — the shape the momentum log + Companion use to tag a call to a commitment.
export async function commitmentTexts(db: Db, memberId: string): Promise<{ activity?: string; diet?: string }> {
  const out: { activity?: string; diet?: string } = {};
  for (const c of await activeCommitments(db, memberId)) out[c.domain] = c.text;
  return out;
}

// Set (or replace) the member's commitment for a domain. Releases any current active one in that domain first (kept as
// history — the partial unique index would otherwise reject a second active row), then inserts the new one. Idempotent
// on identical text (no-op churn avoided by comparing). NOT best-effort: throws on failure so the caller surfaces it.
export async function setCommitment(
  db: Db,
  memberId: string,
  domain: CommitmentDomain,
  text: string,
  source: CommitmentSource = 'self',
): Promise<{ ok: true; changed: boolean }> {
  const clean = (text ?? '').trim();
  if (!clean) throw new Error('setCommitment: empty text');
  const current = (await activeCommitments(db, memberId)).find((c) => c.domain === domain);
  if (current && current.text.trim() === clean) return { ok: true, changed: false }; // unchanged → no churn/history spam
  await db.query(`update commitment set status='released', updated_at=now() where member_id=$1 and domain=$2 and status='active'`, [memberId, domain]);
  await db.query(`insert into commitment (member_id, domain, text, source) values ($1, $2, $3, $4)`, [memberId, domain, clean, source]);
  return { ok: true, changed: true };
}

// Release the active commitment for a domain (set aside, kept as history — never a hard delete). No-op if none active.
export async function releaseCommitment(db: Db, memberId: string, domain: CommitmentDomain): Promise<void> {
  await db.query(`update commitment set status='released', updated_at=now() where member_id=$1 and domain=$2 and status='active'`, [memberId, domain]);
}
