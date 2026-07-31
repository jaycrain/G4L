import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getRoster, relativeTime, BADGE_TOTAL } from '../../../lib/admin/roster.ts';
import { attentionLists, STALLED_AFTER_HOURS, QUIET_AFTER_DAYS } from '../../../lib/admin/console.ts';
import { initials } from '../../../lib/member/avatar.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import type { Db } from '../../../lib/db/schema.ts';
import type { RosterRow } from '../../../lib/admin/roster.ts';

// THE ATTENTION SUBPAGE — the console tile made WORKABLE.
//
// The tile answers "how many"; this answers "who, and what do I need to know before I say anything". That is
// the difference between a dashboard and a queue: a queue is something you work down.
//
// It uses `attentionLists`, which shares its predicates with the tile and with the Companion's find_members.
// A count that disagrees with the list behind it destroys trust in both, and that is not hypothetical here —
// it is what happened between the roster and the member subpage.
//
// DELIBERATELY OPERATIONAL. No gap, no Reclaim List, no what-they-told-their-Companion. Same line the Founder
// Companion holds: a list of people is the wrong place for one person's most private words. Open the member
// to see those, which is a decision to look at one person because you're trying to help them.

function Row({ m, now, why }: { m: RosterRow; now: number; why: string }) {
  return (
    <Link className="fca-row" href={`/admin/member/${m.memberId}`}>
      {m.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar avatar-sm" src={m.avatarUrl} alt={m.displayName} />
      ) : (
        <span className="avatar-initials avatar-sm" aria-hidden="true">{initials(m.displayName)}</span>
      )}
      <span className="fca-id">
        <span className="fca-name">{m.displayName}</span>
        <span className="fca-why muted">{why}</span>
      </span>
      <span className="fca-meta">
        <span className="fca-chip">{m.phase}</span>
        <span className="fca-chip">{m.idScore != null ? `ID ${Math.round(m.idScore)}` : 'no ID Score'}</span>
        <span className="fca-chip">{m.sessionsClosed} closed</span>
        <span className="fca-chip">{m.badges}/{BADGE_TOTAL} badges</span>
      </span>
      <span className="fca-when">{relativeTime(m.lastActiveAt, now)}</span>
    </Link>
  );
}

export default async function AttentionPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const now = Date.now();
  const { stalled, quiet } = attentionLists(await getRoster(db), now);

  return (
    <ConsoleSubpage
      title="Attention"
      here="/admin/attention"
      lede="The people the console is pointing at, with enough context to decide whether to reach out."
    >
      <div className="card">
        <h3>Mid-Session, paused ({stalled.length})</h3>
        <p className="muted fca-def">
          A Session open and nothing since — for more than {STALLED_AFTER_HOURS} hours. Someone mid-work who
          stepped away, not necessarily someone who left.
        </p>
        {stalled.length === 0
          ? <p className="muted" style={{ margin: 0 }}>Nobody is sitting mid-Session.</p>
          : stalled.map((m) => <Row key={m.memberId} m={m} now={now} why="a Session open, nothing since" />)}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Haven&apos;t been back ({quiet.length})</h3>
        <p className="muted fca-def">
          No signal of any kind for {QUIET_AFTER_DAYS}+ days. This one is about the person, not a piece of
          work — members who never started at all are not counted here.
        </p>
        {quiet.length === 0
          ? <p className="muted" style={{ margin: 0 }}>Nobody has drifted.</p>
          : quiet.map((m) => <Row key={m.memberId} m={m} now={now} why="no signal for a while" />)}
      </div>

      <p className="fc-elsewhere">
        Reaching out goes through the <Link href="/admin/review">review queue</Link> — open a member to draft
        something in your voice. Nothing sends without you.
      </p>
    </ConsoleSubpage>
  );
}
