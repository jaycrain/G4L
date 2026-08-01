// Connect moderation — the /admin review queue + content actions. Member reports and system-filed
// crisis flags land in one queue; safety concerns sort first. Design: docs/connect-design.md.
import type { Db } from '../db/schema.ts';

export type ModItem = {
  reportId: string;
  subjectKind: 'post' | 'reply' | 'member' | 'room_message';
  subjectId: string;
  reason: string | null;
  concernForSafety: boolean;
  source: 'member' | 'system';
  createdAt: string;
  contentBody: string | null;
  postTitle: string | null;
  contentStatus: string | null;
  authorName: string | null; // real name — moderators see who's behind the handle
  reporterName: string | null; // null for system-filed (crisis) reports
  status: 'open' | 'reviewed' | 'actioned';
  reviewedAt: string | null;
};

/** Open reports, safety concerns first, with the reported content + the real names behind it. */
export async function getModerationQueue(db: Db): Promise<ModItem[]> {
  return queryReports(db, 'open');
}

/**
 * What you already decided. Reviewed and actioned reports, newest first.
 *
 * The queue only ever showed OPEN reports, so the moment you dismissed or removed something it vanished with
 * no record on the surface — you could not answer "did I already deal with this?", "what did I do about that
 * post last week?", or "has this member been reported before?". For a moderation surface that touches safety,
 * a decision you can't look back at is a decision you can't be accountable for.
 *
 * Shares its query with the open queue, so the archive can never disagree with the queue about the same row.
 */
export async function getModerationArchive(db: Db, limit = 50): Promise<ModItem[]> {
  return queryReports(db, 'closed', limit);
}

async function queryReports(db: Db, which: 'open' | 'closed', limit = 200): Promise<ModItem[]> {
  const { rows } = await db.query<{
    report_id: string;
    subject_kind: 'post' | 'reply' | 'member' | 'room_message';
    subject_id: string;
    reason: string | null;
    concern_for_safety: boolean;
    source: 'member' | 'system';
    created_at: string;
    content_body: string | null;
    post_title: string | null;
    content_status: string | null;
    author_name: string | null;
    reporter_name: string | null;
    status: 'open' | 'reviewed' | 'actioned';
    reviewed_at: string | null;
  }>(
    `select rep.id as report_id, rep.subject_kind, rep.subject_id, rep.reason, rep.concern_for_safety,
            rep.source, rep.created_at, rep.status, rep.reviewed_at,
            coalesce(po.body, re.body, rm.body) as content_body,
            po.title as post_title,
            coalesce(po.status, re.status, rm.status) as content_status,
            coalesce(pa.display_name, ra.display_name, rma.display_name, ma.display_name) as author_name,
            reporter.display_name as reporter_name
       from connect_report rep
       left join connect_post  po on rep.subject_kind = 'post'  and po.id = rep.subject_id
       left join connect_reply re on rep.subject_kind = 'reply' and re.id = rep.subject_id
       left join connect_room_message rm on rep.subject_kind = 'room_message' and rm.id = rep.subject_id
       left join member_profile pa on pa.member_id = po.author_id
       left join member_profile ra on ra.member_id = re.author_id
       left join member_profile rma on rma.member_id = rm.author_id
       left join member_profile ma on rep.subject_kind = 'member' and ma.member_id = rep.subject_id
       left join member_profile reporter on reporter.member_id = rep.reporter_id
      where ($1::text = 'open' and rep.status = 'open')
         or ($1::text = 'closed' and rep.status <> 'open')
      -- Open: safety first, then OLDEST first — a queue you work down. Closed: newest first, because an
      -- archive is something you scan back through, not work through.
      order by case when $1::text = 'open' then 0 else 1 end,
               rep.concern_for_safety desc,
               case when $1::text = 'open' then rep.created_at end asc,
               coalesce(rep.reviewed_at, rep.created_at) desc
      limit $2`,
    [which, limit],
  );
  return rows.map((r) => ({
    reportId: r.report_id,
    subjectKind: r.subject_kind,
    subjectId: r.subject_id,
    reason: r.reason,
    concernForSafety: r.concern_for_safety,
    source: r.source,
    createdAt: r.created_at,
    contentBody: r.content_body,
    postTitle: r.post_title,
    contentStatus: r.content_status,
    authorName: r.author_name,
    reporterName: r.reporter_name,
    status: r.status,
    reviewedAt: r.reviewed_at,
  }));
}

export async function openReportCount(db: Db): Promise<{ total: number; safety: number }> {
  const { rows } = await db.query<{ total: number; safety: number }>(
    `select count(*)::int as total, count(*) filter (where concern_for_safety)::int as safety
       from connect_report where status = 'open'`,
  );
  return { total: Number(rows[0]?.total ?? 0), safety: Number(rows[0]?.safety ?? 0) };
}

export async function setContentStatus(db: Db, kind: 'post' | 'reply' | 'room_message', id: string, status: 'visible' | 'hidden' | 'removed'): Promise<void> {
  const table = kind === 'post' ? 'connect_post' : kind === 'reply' ? 'connect_reply' : 'connect_room_message';
  await db.query(`update ${table} set status = $2 where id = $1`, [id, status]);
}

export async function resolveReport(db: Db, reportId: string): Promise<void> {
  await db.query(`update connect_report set status = 'reviewed', reviewed_at = now() where id = $1`, [reportId]);
}
