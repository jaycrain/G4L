// Charter feedback store — reads/writes member_feedback. Capture is member-initiated (an explicit
// "Send Feedback" affordance, never the Member Agent). The write tolerates bad input by rejecting it
// (returns false) rather than throwing into the member's face.

import type { Db } from '../db/schema.ts';

export type FeedbackKind = 'issue' | 'question' | 'suggestion';
export type FeedbackStatus = 'new' | 'triaged' | 'resolved';

export const FEEDBACK_KINDS: FeedbackKind[] = ['issue', 'question', 'suggestion'];
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'triaged', 'resolved'];

const isKind = (k: unknown): k is FeedbackKind => FEEDBACK_KINDS.includes(k as FeedbackKind);
const isStatus = (s: unknown): s is FeedbackStatus => FEEDBACK_STATUSES.includes(s as FeedbackStatus);

const BODY_MAX = 4000;

export type FeedbackInput = {
  memberId: string | null;
  author: string | null;
  kind: FeedbackKind;
  body: string;
  surface?: string | null;
  context?: Record<string, unknown>;
};

/** Returns false on invalid input (empty body / bad kind) — the caller surfaces a gentle error. */
export async function logFeedback(db: Db, input: FeedbackInput): Promise<boolean> {
  const body = (input.body ?? '').trim();
  if (!body || !isKind(input.kind)) return false;
  await db.query(
    `insert into member_feedback (member_id, author, kind, body, surface, context)
     values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      input.memberId,
      input.author ?? null,
      input.kind,
      body.slice(0, BODY_MAX),
      input.surface ?? null,
      JSON.stringify(input.context ?? {}),
    ],
  );
  return true;
}

export type FeedbackRow = {
  id: string;
  memberId: string | null;
  author: string | null;
  displayName: string | null; // joined from member_profile when the member still exists
  kind: FeedbackKind;
  body: string;
  surface: string | null;
  context: Record<string, unknown>;
  status: FeedbackStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type RawRow = {
  id: string;
  member_id: string | null;
  author: string | null;
  display_name: string | null;
  kind: string;
  body: string;
  surface: string | null;
  context: unknown;
  status: string;
  admin_note: string | null;
  created_at: unknown;
  resolved_at: unknown;
};

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function listFeedback(db: Db, status?: FeedbackStatus): Promise<FeedbackRow[]> {
  const { rows } = await db.query<RawRow>(
    `select f.id, f.member_id, f.author, p.display_name, f.kind, f.body, f.surface, f.context,
            f.status, f.admin_note, f.created_at, f.resolved_at
       from member_feedback f
       left join member_profile p on p.member_id = f.member_id
       ${status ? 'where f.status = $1' : ''}
       order by f.created_at desc`,
    status ? [status] : [],
  );
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    author: r.author,
    displayName: r.display_name,
    kind: (isKind(r.kind) ? r.kind : 'issue'),
    body: r.body,
    surface: r.surface,
    context: typeof r.context === 'object' && r.context ? (r.context as Record<string, unknown>) : {},
    status: (isStatus(r.status) ? r.status : 'new'),
    adminNote: r.admin_note,
    createdAt: toIso(r.created_at) ?? new Date(0).toISOString(),
    resolvedAt: toIso(r.resolved_at),
  }));
}

export async function setFeedbackStatus(db: Db, id: string, status: FeedbackStatus): Promise<boolean> {
  if (!isStatus(status)) return false;
  await db.query(
    `update member_feedback
       set status = $2,
           resolved_at = case when $2 = 'resolved' then now() else null end
     where id = $1`,
    [id, status],
  );
  return true;
}

/** Operator cleanup: permanently delete every resolved feedback row. Returns how many were removed. */
export async function deleteResolvedFeedback(db: Db): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    `delete from member_feedback where status = 'resolved' returning id`,
  );
  return rows.length;
}

export type FeedbackCounts = { new: number; triaged: number; resolved: number; total: number };

export async function feedbackCounts(db: Db): Promise<FeedbackCounts> {
  const { rows } = await db.query<{ status: string; n: number }>(
    `select status, count(*)::int n from member_feedback group by status`,
  );
  const c: FeedbackCounts = { new: 0, triaged: 0, resolved: 0, total: 0 };
  for (const r of rows) {
    if (isStatus(r.status)) c[r.status] = r.n;
    c.total += r.n;
  }
  return c;
}
