import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { activityFeed, markUnseen, type FeedItem } from '../../../lib/admin/console.ts';
import { getActivitySeenAt } from '../../../lib/founder/state.ts';
import { markActivitySeenAction } from './actions.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { relativeTime } from '../../../lib/admin/roster.ts';
import type { Db } from '../../../lib/db/schema.ts';

// THE ACTIVITY SUBPAGE — the console's twelve most recent events, without the twelve.
//
// GROUPED BY DAY, because "what moved" is a question people ask about a stretch of time, not about a list.
// Reading twenty undifferentiated rows to work out whether yesterday was busy is work the page should do.

const TONE: Record<FeedItem['tone'], string> = { work: 'var(--teal)', win: 'var(--olive)', join: 'var(--navy)' };

/** "Today" / "Yesterday" / a plain date — the register the rest of the app uses. */
function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const startOf = (t: number) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const days = Math.round((startOf(now) - startOf(d.getTime())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default async function ActivityPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const now = Date.now();
  const raw = await activityFeed(db, 200);

  // SINCE YOU LAST LOOKED — and the page does NOT stamp the marker.
  //
  // It used to, on every render. But every console page auto-refreshes every 30 seconds, so the marker chased
  // its own tail: each tick marked everything seen, the count sat at zero forever, and the console badge never
  // appeared because Activity had already swallowed it. The whole feature was invisible.
  //
  // A RENDER IS NOT AN INTENTION. Clearing is now a deliberate tap (markActivitySeenAction), which also makes
  // the rule something you can see rather than something you have to trust: nothing clears until you say so.
  const seenAt = await getActivitySeenAt(db);
  const { feed, unseen } = markUnseen(raw, seenAt);

  // Group in order — the feed already arrives newest-first, so days come out newest-first too.
  const days: Array<{ label: string; items: FeedItem[] }> = [];
  for (const f of feed) {
    const label = dayLabel(f.at, now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(f);
    else days.push({ label, items: [f] });
  }

  return (
    <ConsoleSubpage
      title="Activity"
      here="/admin/activity"
    >
      {/* THE POINT OF THE PAGE, per Jay: an instant check-in across a MacBook, an iPad and a phone. The marker
          is per-ACCOUNT, so this counts what's landed since he last looked ANYWHERE — not since this device
          last looked. Shown even at zero: "nothing new" is a real answer and the one he'll get most often. */}
      <div className={`fca-since${unseen > 0 ? ' on' : ''}`}>
        <span>
          {unseen > 0
            ? `${unseen} new since you last looked${seenAt ? ` · ${relativeTime(seenAt, now)}` : ''}`
            : seenAt
              ? `Nothing new since you last looked · ${relativeTime(seenAt, now)}`
              : 'First look — everything below is new to you.'}
        </span>
        {unseen > 0 && (
          <form action={markActivitySeenAction}>
            <button type="submit" className="fca-seen-btn">Mark all seen</button>
          </form>
        )}
      </div>
      {days.length === 0 ? (
        <div className="card">
          {/* An empty feed used to mean a BROKEN READ (member_event has no `payload` column, and the catch
              swallowed it). Now the read logs its failures, so an empty page here is genuinely empty — but
              say which of the two this is rather than leaving Jay to guess. */}
          <h3>Nothing recorded yet</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            No Sessions closed, Checkpoints crossed or IDQs completed have been logged. If members have
            definitely been working, that points at the event log rather than at the cohort.
          </p>
        </div>
      ) : (
        days.map((d) => (
          <div className="card" key={d.label} style={{ marginTop: 18 }}>
            <div className="fc-eyebrow">{d.label}</div>
            <h3 className="fc-h">{d.items.length} thing{d.items.length === 1 ? '' : 's'} moved</h3>
            {d.items.map((f, i) => (
              <div className={`fc-evt${f.unseen ? ' unseen' : ''}`} key={`${f.memberId}-${i}`}>
                <span className="fc-ea" style={{ background: TONE[f.tone] }}>{f.initials}</span>
                <Link href={`/admin/member/${f.memberId}`} className="fc-el">{f.text}</Link>
                <span className="fc-et">{time(f.at)}</span>
              </div>
            ))}
          </div>
        ))
      )}

      <p className="fc-elsewhere">
        Showing the most recent 200 events. Page views aren&apos;t news, so they aren&apos;t here — and demo
        personas are excluded everywhere in the console.
      </p>
    </ConsoleSubpage>
  );
}
