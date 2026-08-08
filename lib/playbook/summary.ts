// The Playbook, reduced to what a dashboard panel needs: how many plays they hold, and the one they reach for most.
//
// Jay (2026-08-08) put this at the TOP of the left flank — above ID Score and Grinta — so the first thing in the
// reflect column is what a member has BUILT rather than how they SCORE. It's also the Playbook's real entry point:
// a panel that shows its contents pulls better than a link asserting the Playbook matters.
//
// "Plays" counts KEPT, non-journal entries. The journal is intake, not a play — counting it would inflate the
// number with things the member wrote rather than things they can run, and the whole value of the count is that
// it's honest about what they can pick up and use.

import type { Db } from '../db/schema.ts';

export type PlaybookSummary = { plays: number; mostRun: string | null };

export async function playbookSummary(db: Db, memberId: string): Promise<PlaybookSummary | null> {
  try {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from playbook_entry
        where member_id = $1 and state = 'kept' and section <> 'journal'`,
      [memberId],
    );
    const plays = rows[0]?.n ?? 0;
    if (plays === 0) return { plays: 0, mostRun: null };

    // The most re-run play, by the play_rerun events the Playbook already emits. Preferred over "most recent"
    // because a play they've come back to four times is the one that has proven useful — and that's a stronger
    // thing to surface than whatever they happened to finish last.
    const top = await db
      .query<{ label: string }>(
        `select e.source_label as label, count(*)::int as n
           from member_event ev
           join playbook_entry e on e.member_id = ev.member_id and e.source_ref = ev.ref
          where ev.member_id = $1 and ev.kind = 'play_rerun' and ev.ref is not null
            and e.state = 'kept' and e.source_label is not null
          group by e.source_label
          order by n desc
          limit 1`,
        [memberId],
      )
      .catch(() => ({ rows: [] as { label: string }[] }));

    // No re-runs yet is the common case early on — fall back to their most recent kept play so the panel still
    // names something of theirs rather than showing a bare number.
    const recent = top.rows[0]?.label
      ? null
      : await db
          .query<{ label: string | null }>(
            `select coalesce(source_label, body) as label from playbook_entry
              where member_id = $1 and state = 'kept' and section <> 'journal'
              order by created_at desc limit 1`,
            [memberId],
          )
          .catch(() => ({ rows: [] as { label: string | null }[] }));

    const mostRun = top.rows[0]?.label ?? recent?.rows[0]?.label ?? null;
    return { plays, mostRun: mostRun ? trimToLine(mostRun) : null };
  } catch (e) {
    // LOUD, then degrade to no panel. A swallowed read here renders as "this member has no Playbook", which is a
    // confident lie about someone who has one — the same shape as the harvest silent-drop and the empty-feed bug.
    console.error(`playbookSummary failed for member=${memberId}:`, e);
    return null;
  }
}

/** Keepers can be a full sentence; the panel has one line. Cut at a clause rather than mid-word. */
function trimToLine(s: string): string {
  const one = s.trim().split('\n')[0]!.trim();
  return one.length <= 46 ? one : `${one.slice(0, 45).replace(/[\s,;:—-]+\S*$/, '')}…`;
}
