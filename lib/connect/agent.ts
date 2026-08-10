// Connect, as the Member Agent sees it. Read-only awareness so the companion can notice a member's
// community life and gently bridge them toward real people (the program's quiet north star) — never
// to post on their behalf. CLAUDE.md: nothing the member sees is invisible to the MA. The agent uses
// this to surface "someone replied to what you shared" and to tie accountability to the Reclaim List.
import type { Db } from '../db/schema.ts';
import { getConnectProfile, getNotifications, unreadNotificationCount } from './store.ts';

export type ConnectAgentSummary = {
  handle: string | null;
  nameRevealed: boolean;
  unreadCount: number;
  recentEngagement: { actor: string; kind: 'reply' | 'cheer'; postLabel: string; unread: boolean }[];
  ownRecentPosts: string[];
  pacts: {
    direction: 'i_committed' | 'holding';
    commitment: string;
    other: string;
    reclaimItem: string | null;
    lastCheckinDays: number | null;
  }[];
  hasPresence: boolean; // any Connect footprint at all — handle, post, pact, or engagement received
};

export async function getConnectSummaryForAgent(db: Db, memberId: string): Promise<ConnectAgentSummary> {
  // Every read here is SUPPLEMENTARY community awareness — the companion (buildContext) folds this summary into its
  // context, so a single drifted/transient Connect table must NOT collapse the whole context to minimal (W-13 class).
  // Guard each read to a safe empty default: a failure degrades that one signal to "no activity yet", never a throw.
  const [profile, notifications, unreadCount, postRows, pactRows] = await Promise.all([
    getConnectProfile(db, memberId).catch(() => null),
    getNotifications(db, memberId, 5).catch(() => []),
    unreadNotificationCount(db, memberId).catch(() => 0),
    db.query<{ label: string }>(
      `select coalesce(title, left(body, 60)) as label
         from connect_post where author_id = $1 and status = 'visible'
        order by created_at desc limit 3`,
      [memberId],
    ).catch(() => ({ rows: [] as { label: string }[] })),
    db.query<{
      direction: 'i_committed' | 'holding';
      commitment: string;
      other_name: string;
      reclaim_text: string | null;
      last_checkin: string | null;
    }>(
      `select case when pact.doer_id = $1 then 'i_committed' else 'holding' end as direction,
              pact.commitment,
              case when pact.doer_id = $1 then partner.display_name else doer.display_name end as other_name,
              ri.text as reclaim_text,
              (select max(c.created_at) from connect_pact_checkin c where c.pact_id = pact.id and c.member_id = $1) as last_checkin
         from connect_pact pact
         join member_profile doer    on doer.member_id    = pact.doer_id
         join member_profile partner on partner.member_id = pact.partner_id
         left join reclaim_item ri on ri.id = pact.reclaim_item_id
        where (pact.doer_id = $1 or pact.partner_id = $1) and pact.status = 'active'
        order by pact.created_at desc`,
      [memberId],
    ).catch(() => ({
      rows: [] as {
        direction: 'i_committed' | 'holding';
        commitment: string;
        other_name: string;
        reclaim_text: string | null;
        last_checkin: string | null;
      }[],
    })),
  ]);

  const recentEngagement = notifications.map((n) => ({
    actor: n.actorLabel,
    kind: n.kind,
    postLabel: n.postLabel,
    unread: !n.read,
  }));
  const ownRecentPosts = postRows.rows.map((r) => r.label);
  const pacts = pactRows.rows.map((r) => ({
    direction: r.direction,
    commitment: r.commitment,
    other: r.other_name,
    reclaimItem: r.reclaim_text,
    lastCheckinDays: r.last_checkin ? Math.floor((Date.now() - new Date(r.last_checkin).getTime()) / 86_400_000) : null,
  }));

  return {
    handle: profile?.handle ?? null,
    nameRevealed: profile?.revealDefault ?? false,
    unreadCount,
    recentEngagement,
    ownRecentPosts,
    pacts,
    hasPresence: Boolean(profile) || ownRecentPosts.length > 0 || pacts.length > 0 || recentEngagement.length > 0,
  };
}

/** Render the Connect summary into the agent's MEMBER CONTEXT block. Empty footprint → a short line. */
export function connectContextLines(c: ConnectAgentSummary): string {
  if (!c.hasPresence) return 'Community: no activity yet — they have not posted or connected with anyone.';
  const lines: string[] = ['Community (their bridge to other members):'];
  lines.push(`  • Their handle: ${c.handle ?? '—'}${c.nameRevealed ? ' (posts under their real name)' : ' (posts anonymously)'}`);
  if (c.recentEngagement.length) {
    lines.push(`  • Recent engagement they received${c.unreadCount ? ` (${c.unreadCount} unread)` : ''}:`);
    for (const e of c.recentEngagement) {
      lines.push(`      - ${e.actor} ${e.kind === 'reply' ? 'replied to' : 'cheered'} their post “${e.postLabel}”${e.unread ? ' [unread]' : ''}`);
    }
  }
  if (c.ownRecentPosts.length) lines.push(`  • They recently shared: ${c.ownRecentPosts.map((p) => `“${p}”`).join('; ')}`);
  for (const p of c.pacts) {
    const tie = p.reclaimItem ? ` (toward their Reclaim item “${p.reclaimItem}”)` : '';
    const quiet = p.lastCheckinDays == null ? ' — no check-in yet' : p.lastCheckinDays >= 7 ? ` — gone quiet (${p.lastCheckinDays}d)` : '';
    lines.push(
      `  • Accountability: ${p.direction === 'i_committed' ? `they told ${p.other} they'd ${p.commitment}` : `they're holding ${p.other} to ${p.commitment}`}${tie}${quiet}`,
    );
  }
  return lines.join('\n');
}
