import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { activityFeed, markUnseen, type FeedItem } from '../../../lib/admin/console.ts';
import { getActivitySeenAt } from '../../../lib/founder/state.ts';
import { markActivitySeenAction } from './actions.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import ActivityDays from './activity-days.tsx';
import { relativeTime } from '../../../lib/admin/roster.ts';
import { trackerDoors } from '../../../lib/admin/tracker-doors.ts';
import type { Db } from '../../../lib/db/schema.ts';

// THE ACTIVITY SUBPAGE — the console's twelve most recent events, without the twelve.
//
// GROUPED BY DAY, because "what moved" is a question people ask about a stretch of time, not about a list.
// Reading twenty undifferentiated rows to work out whether yesterday was busy is work the page should do.




export default async function ActivityPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const now = Date.now();
  const raw = await activityFeed(db, 200);
  const doors = await trackerDoors(db, 30);

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
      {feed.length === 0 ? (
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
        <ActivityDays feed={feed} />
      )}

      <p className="fc-elsewhere">
        Showing the most recent 200 events. Page views aren&apos;t news, so they aren&apos;t here — and demo
        personas are excluded everywhere in the console.
      </p>
      {/* DO THEY TAP, OR TELL? — Greg's friction-reduction question, answered with counts rather than guesses.
          Aggregate on purpose: this reads no member identifier and returns none, and no content of any kind.
          It says a day was logged and by what route, which is the whole of what 0076 set out to record. */}
      {doors.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>How members log — last 30 days</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Days recorded, by the route they came in by. Greg asks the Companion to reduce friction; this is
            whether it does. Counts only — no member is identifiable here.
          </p>
          <ul className="mlog-list">
            {doors.map((d) => (
              <li key={`${d.tracker}-${d.source}`} className="mlog-row">
                <span className="mlog-text">{d.tracker} · <strong>{d.source}</strong></span>
                <span className="mlog-when">{d.days} {d.days === 1 ? 'day' : 'days'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ConsoleSubpage>
  );
}
