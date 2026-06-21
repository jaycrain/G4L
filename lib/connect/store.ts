// Connect — read path for the subpage (Phase 1). Writes (compose, reply, react, pact, report) land
// next. Identity rule: a member is pseudonymous by default — we show their handle unless the post's
// own `show_name` is set (the per-post reveal), in which case we show their real display name.
// Access is enforced upstream by authorizeMember (app-layer isolation); these are owner-connection
// reads. Design: docs/connect-design.md.
import type { Db } from '../db/schema.ts';

export type FeedPost = {
  id: string;
  title: string | null;
  body: string;
  authorLabel: string; // handle, or real name when the author revealed it on this post
  category: string | null; // optional IDQ-dimension tag
  reclaimItem: string | null; // tied Reclaim List item, if any
  replyCount: number;
  createdAt: string;
  lastActivityAt: string;
};

export type AccountabilityItem = {
  id: string;
  direction: 'i_committed' | 'asked_of_me';
  commitment: string;
  otherName: string; // the other member in the pact (a personal tie — shown by name)
  status: string;
};

/** The global feed: visible posts, most-recently-active first. */
export async function getFeed(db: Db, limit = 50): Promise<FeedPost[]> {
  const { rows } = await db.query<{
    id: string;
    title: string | null;
    body: string;
    show_name: boolean;
    handle: string | null;
    display_name: string;
    category: string | null;
    reclaim_text: string | null;
    reply_count: number;
    created_at: string;
    last_activity_at: string;
  }>(
    `select p.id, p.title, p.body, p.show_name, p.category,
            cp.handle, mp.display_name,
            ri.text as reclaim_text,
            (select count(*) from connect_reply r where r.post_id = p.id and r.status = 'visible') as reply_count,
            p.created_at, p.last_activity_at
       from connect_post p
       join member_profile mp on mp.member_id = p.author_id
       left join connect_profile cp on cp.member_id = p.author_id
       left join reclaim_item ri on ri.id = p.reclaim_item_id
      where p.status = 'visible'
      order by p.last_activity_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    authorLabel: r.show_name ? r.display_name : (r.handle ?? 'A member'),
    category: r.category,
    reclaimItem: r.reclaim_text,
    replyCount: Number(r.reply_count),
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
  }));
}

/** Active pacts the member is part of — ones they committed to, and ones asked of them. */
export async function getAccountability(db: Db, memberId: string): Promise<AccountabilityItem[]> {
  const { rows } = await db.query<{
    id: string;
    commitment: string;
    status: string;
    direction: 'i_committed' | 'asked_of_me';
    other_name: string;
  }>(
    `select pact.id, pact.commitment, pact.status,
            case when pact.doer_id = $1 then 'i_committed' else 'asked_of_me' end as direction,
            case when pact.doer_id = $1 then partner.display_name else doer.display_name end as other_name
       from connect_pact pact
       join member_profile doer    on doer.member_id    = pact.doer_id
       join member_profile partner on partner.member_id = pact.partner_id
      where (pact.doer_id = $1 or pact.partner_id = $1) and pact.status = 'active'
      order by pact.created_at desc`,
    [memberId],
  );
  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    commitment: r.commitment,
    otherName: r.other_name,
    status: r.status,
  }));
}
