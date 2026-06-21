// Connect moderation — the /admin review queue + content actions. Member reports and system-filed
// crisis flags land in one queue; safety concerns sort first. Design: docs/connect-design.md.
import type { Db } from '../db/schema.ts';

export type ModItem = {
  reportId: string;
  subjectKind: 'post' | 'reply' | 'member';
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
};

/** Open reports, safety concerns first, with the reported content + the real names behind it. */
export async function getModerationQueue(db: Db): Promise<ModItem[]> {
  const { rows } = await db.query<{
    report_id: string;
    subject_kind: 'post' | 'reply' | 'member';
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
  }>(
    `select rep.id as report_id, rep.subject_kind, rep.subject_id, rep.reason, rep.concern_for_safety,
            rep.source, rep.created_at,
            coalesce(po.body, re.body) as content_body,
            po.title as post_title,
            coalesce(po.status, re.status) as content_status,
            coalesce(pa.display_name, ra.display_name, ma.display_name) as author_name,
            reporter.display_name as reporter_name
       from connect_report rep
       left join connect_post  po on rep.subject_kind = 'post'  and po.id = rep.subject_id
       left join connect_reply re on rep.subject_kind = 'reply' and re.id = rep.subject_id
       left join member_profile pa on pa.member_id = po.author_id
       left join member_profile ra on ra.member_id = re.author_id
       left join member_profile ma on rep.subject_kind = 'member' and ma.member_id = rep.subject_id
       left join member_profile reporter on reporter.member_id = rep.reporter_id
      where rep.status = 'open'
      order by rep.concern_for_safety desc, rep.created_at asc`,
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
  }));
}

export async function openReportCount(db: Db): Promise<{ total: number; safety: number }> {
  const { rows } = await db.query<{ total: number; safety: number }>(
    `select count(*)::int as total, count(*) filter (where concern_for_safety)::int as safety
       from connect_report where status = 'open'`,
  );
  return { total: Number(rows[0]?.total ?? 0), safety: Number(rows[0]?.safety ?? 0) };
}

export async function setContentStatus(db: Db, kind: 'post' | 'reply', id: string, status: 'visible' | 'hidden' | 'removed'): Promise<void> {
  const table = kind === 'post' ? 'connect_post' : 'connect_reply';
  await db.query(`update ${table} set status = $2 where id = $1`, [id, status]);
}

export async function resolveReport(db: Db, reportId: string): Promise<void> {
  await db.query(`update connect_report set status = 'reviewed', reviewed_at = now() where id = $1`, [reportId]);
}
