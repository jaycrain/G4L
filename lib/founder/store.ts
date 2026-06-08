// Founder Agent draft store — the review queue + send gate (Layer 5). Framework-free (takes a
// Db) so it's integration-tested and wrapped by the admin server actions.
// The "send" here records approval + sent_at; the actual HubSpot send rail is wired later.

import type { Db } from '../db/schema.ts';
import type { Draft, OperatingMoment } from './draft.ts';

export type DraftRow = {
  id: string;
  member_id: string;
  display_name?: string;
  operating_moment: string;
  channel: string;
  draft_subject: string;
  draft_body: string;
  jay_edits: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  drafted_at: string;
  sent_at: string | null;
};

export async function createDraft(
  db: Db,
  p: {
    memberId: string;
    moment: OperatingMoment;
    channel?: 'email' | 'sms';
    draft: Draft;
    inputSnapshot?: unknown;
    triggerKey?: string; // set by auto-triggers; null for manual drafts
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into founder_agent_drafts
       (member_id, operating_moment, channel, draft_subject, draft_body, input_snapshot, trigger_key)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [p.memberId, p.moment, p.channel ?? 'email', p.draft.subject, p.draft.body, p.inputSnapshot ?? {}, p.triggerKey ?? null],
  );
  return rows[0]!.id;
}

/** Has an auto-trigger already drafted for this member + event? Keeps one event → one draft. */
export async function draftExistsForTrigger(db: Db, memberId: string, triggerKey: string): Promise<boolean> {
  const { rows } = await db.query<{ e: boolean }>(
    `select exists(
       select 1 from founder_agent_drafts where member_id = $1 and trigger_key = $2
     ) as e`,
    [memberId, triggerKey],
  );
  return Boolean(rows[0]?.e);
}

export async function listPending(db: Db): Promise<DraftRow[]> {
  const { rows } = await db.query<DraftRow>(
    `select d.id, d.member_id, m.display_name, d.operating_moment, d.channel,
            d.draft_subject, d.draft_body, d.jay_edits, d.approval_status, d.drafted_at, d.sent_at
     from founder_agent_drafts d join member_profile m on m.member_id = d.member_id
     where d.approval_status = 'pending'
     order by d.drafted_at desc`,
  );
  return rows;
}

export async function listForMember(db: Db, memberId: string): Promise<DraftRow[]> {
  const { rows } = await db.query<DraftRow>(
    `select id, member_id, operating_moment, channel, draft_subject, draft_body, jay_edits,
            approval_status, drafted_at, sent_at
     from founder_agent_drafts where member_id = $1 order by drafted_at desc`,
    [memberId],
  );
  return rows;
}

export async function getDraft(db: Db, id: string): Promise<DraftRow | null> {
  const { rows } = await db.query<DraftRow>(
    `select d.id, d.member_id, m.display_name, d.operating_moment, d.channel,
            d.draft_subject, d.draft_body, d.jay_edits, d.approval_status, d.drafted_at, d.sent_at
     from founder_agent_drafts d join member_profile m on m.member_id = d.member_id
     where d.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function saveEdit(db: Db, id: string, editedBody: string): Promise<void> {
  await db.query(`update founder_agent_drafts set jay_edits = $2 where id = $1`, [id, editedBody]);
}

/** Jay-review-before-send gate: approve + record the send. Optionally store a final edit.
 *  (Records sent_at; the real HubSpot send is wired later — nothing is emailed yet.) */
export async function approveSend(db: Db, id: string, editedBody?: string): Promise<void> {
  await db.query(
    `update founder_agent_drafts
       set approval_status = 'approved', approved_at = now(), sent_at = now(),
           jay_edits = coalesce($2, jay_edits)
     where id = $1 and approval_status = 'pending'`,
    [id, editedBody ?? null],
  );
}

export async function rejectDraft(db: Db, id: string): Promise<void> {
  await db.query(
    `update founder_agent_drafts set approval_status = 'rejected' where id = $1 and approval_status = 'pending'`,
    [id],
  );
}
