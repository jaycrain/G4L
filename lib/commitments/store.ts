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
export type Commitment = {
  id: string;
  domain: CommitmentDomain;
  text: string;
  source: CommitmentSource;
  updatedAt: string;
  reclaimItemId: string | null; // the Reclaim outcome this commitment serves (the ladder), if linked
  reclaimItemText: string | null; // resolved for display/context — null if unlinked or the item was removed
};

export const isCommitmentDomain = (d: unknown): d is CommitmentDomain => d === 'activity' || d === 'diet';
export const DOMAIN_WORD: Record<CommitmentDomain, string> = { activity: 'movement', diet: 'eating' };

// The member's ACTIVE commitments (0–2, one per domain), newest first. Drift-hardened by the caller (empty on a
// pre-0060 DB). Released commitments are history — not returned here.
export async function activeCommitments(db: Db, memberId: string): Promise<Commitment[]> {
  const { rows } = await db.query<{ id: string; domain: string; text: string; source: string; updated_at: string; reclaim_item_id: string | null; reclaim_item_text: string | null }>(
    `select c.id, c.domain, c.text, c.source, c.updated_at::text as updated_at, c.reclaim_item_id,
            r.text as reclaim_item_text
       from commitment c
       left join reclaim_item r on r.id = c.reclaim_item_id and r.removed_at is null
      where c.member_id=$1 and c.status='active' order by c.updated_at desc`,
    [memberId],
  );
  return rows.map((r) => ({
    id: r.id, domain: r.domain as CommitmentDomain, text: r.text, source: r.source as CommitmentSource,
    updatedAt: r.updated_at, reclaimItemId: r.reclaim_item_id, reclaimItemText: r.reclaim_item_text,
  }));
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
  reclaimItemId?: string | null,
): Promise<{ ok: true; changed: boolean }> {
  const clean = (text ?? '').trim();
  if (!clean) throw new Error('setCommitment: empty text');
  const current = (await activeCommitments(db, memberId)).find((c) => c.domain === domain);
  // Unchanged text AND unchanged link → no churn/history spam. (Re-pointing the ladder counts as a change.)
  if (current && current.text.trim() === clean && (reclaimItemId === undefined || current.reclaimItemId === reclaimItemId)) {
    return { ok: true, changed: false };
  }
  await db.query(`update commitment set status='released', updated_at=now() where member_id=$1 and domain=$2 and status='active'`, [memberId, domain]);
  await db.query(
    `insert into commitment (member_id, domain, text, source, reclaim_item_id) values ($1, $2, $3, $4, $5)`,
    [memberId, domain, clean, source, reclaimItemId ?? null],
  );
  return { ok: true, changed: true };
}

// Release the active commitment for a domain (set aside, kept as history — never a hard delete). No-op if none active.
// (The Reclaim-item ladder link is resolved from the member's words by findReclaimItemId in lib/measure/store.)
export async function releaseCommitment(db: Db, memberId: string, domain: CommitmentDomain): Promise<void> {
  await db.query(`update commitment set status='released', updated_at=now() where member_id=$1 and domain=$2 and status='active'`, [memberId, domain]);
}
