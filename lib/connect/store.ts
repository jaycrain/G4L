// Connect — read path for the dashboard panel + subpage (Phase 1). Identity rule: a member is
// pseudonymous by default — we show their handle unless the post's own `show_name` is set (the
// per-post reveal), in which case we show their real display name. Access is enforced upstream by
// authorizeMember (app-layer isolation); these are owner-connection reads. Design: docs/connect-design.md.
import type { Db } from '../db/schema.ts';

export type FeedPost = {
  id: string;
  title: string | null;
  body: string;
  authorLabel: string; // handle, or real name when the author revealed it on this post
  category: string | null;
  reclaimItem: string | null;
  replyCount: number;
  cheerCount: number;
  iCheered: boolean;
  createdAt: string;
  lastActivityAt: string;
};

export type FeedReply = {
  id: string;
  postId: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

export type AccountabilityItem = {
  id: string;
  direction: 'i_committed' | 'asked_of_me';
  commitment: string;
  otherName: string;
  status: string;
};

export type ConnectProfile = { handle: string; revealDefault: boolean };

/** The global feed: visible posts, most-recently-active first. `viewerId` powers the "I cheered" flag. */
export async function getFeed(db: Db, limit = 50, viewerId: string | null = null): Promise<FeedPost[]> {
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
    cheer_count: number;
    i_cheered: boolean;
    created_at: string;
    last_activity_at: string;
  }>(
    `select p.id, p.title, p.body, p.show_name, p.category,
            cp.handle, mp.display_name,
            ri.text as reclaim_text,
            (select count(*) from connect_reply r where r.post_id = p.id and r.status = 'visible') as reply_count,
            (select count(*) from connect_reaction x where x.target_kind = 'post' and x.target_id = p.id and x.kind = 'cheer') as cheer_count,
            exists(select 1 from connect_reaction x where x.target_kind = 'post' and x.target_id = p.id and x.kind = 'cheer' and x.member_id = $2) as i_cheered,
            p.created_at, p.last_activity_at
       from connect_post p
       join member_profile mp on mp.member_id = p.author_id
       left join connect_profile cp on cp.member_id = p.author_id
       left join reclaim_item ri on ri.id = p.reclaim_item_id
      where p.status = 'visible'
        and p.author_id not in (select blocked_member_id from connect_block where member_id = $2)
      order by p.last_activity_at desc
      limit $1`,
    [limit, viewerId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    authorLabel: r.show_name ? r.display_name : (r.handle ?? 'A member'),
    category: r.category,
    reclaimItem: r.reclaim_text,
    replyCount: Number(r.reply_count),
    cheerCount: Number(r.cheer_count),
    iCheered: Boolean(r.i_cheered),
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
  }));
}

/** Visible replies for the given posts, grouped by post id (chronological). */
export async function getRepliesFor(db: Db, postIds: string[], viewerId: string | null = null): Promise<Record<string, FeedReply[]>> {
  if (postIds.length === 0) return {};
  const { rows } = await db.query<{
    id: string;
    post_id: string;
    body: string;
    show_name: boolean;
    handle: string | null;
    display_name: string;
    created_at: string;
  }>(
    `select r.id, r.post_id, r.body, r.show_name, cp.handle, mp.display_name, r.created_at
       from connect_reply r
       join member_profile mp on mp.member_id = r.author_id
       left join connect_profile cp on cp.member_id = r.author_id
      where r.post_id = any($1) and r.status = 'visible'
        and r.author_id not in (select blocked_member_id from connect_block where member_id = $2)
      order by r.created_at asc`,
    [postIds, viewerId],
  );
  const out: Record<string, FeedReply[]> = {};
  for (const r of rows) {
    (out[r.post_id] ??= []).push({
      id: r.id,
      postId: r.post_id,
      body: r.body,
      authorLabel: r.show_name ? r.display_name : (r.handle ?? 'A member'),
      createdAt: r.created_at,
    });
  }
  return out;
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

/** The member's Connect identity (for the account settings card). Null if they haven't posted yet. */
export async function getConnectProfile(db: Db, memberId: string): Promise<ConnectProfile | null> {
  const { rows } = await db.query<{ handle: string; reveal_default: boolean }>(
    `select handle, reveal_default from connect_profile where member_id = $1`,
    [memberId],
  );
  return rows[0] ? { handle: rows[0].handle, revealDefault: rows[0].reveal_default } : null;
}
