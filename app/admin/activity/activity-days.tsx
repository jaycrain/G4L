'use client';

import Link from 'next/link';
import type { FeedItem } from '../../../lib/admin/console.ts';

// THE FEED IS GROUPED AND TIMED IN THE VIEWER'S ZONE, WHICH IS WHY THIS IS A CLIENT COMPONENT.
//
// It was all rendered on the server, where `new Date().setHours(0,0,0,0)` and toLocaleTimeString resolve in the
// SERVER's timezone — UTC on Vercel. So every evening from 6pm Mountain onward the operator's day had already
// rolled over: work done tonight was filed under tomorrow, "Today" and "Yesterday" were wrong for a six-hour
// window daily, and every timestamp read six hours off. Jay: "make sure it's looking at the right date and time
// zone to create the daily activity accurately."
//
// This is the same bug the member app had (a Boulder evening landing on tomorrow), fixed there in August and
// still live on the operator side — the member fix keyed off a STORED member zone, and the shared-admin identity
// has no member row to hang one on. The browser already knows, so nothing needs storing: render in local time and
// it is correct for any operator anywhere, including one who has no account at all.
//
// GROUPING MOVES WITH THE LABEL, deliberately. Labelling in local time while grouping in UTC would be worse than
// either alone — the headers would read correctly over rows sorted into the wrong day.

// The tones are the EVENT's meaning, not colour names — work / win / join. I first wrote this as a colour map
// (teal/olive/navy) copied from the values rather than the keys, which would have rendered every avatar with an
// undefined background. Lifted verbatim from the server component it replaces.
const TONE: Record<FeedItem['tone'], string> = { work: 'var(--teal)', win: 'var(--olive)', join: 'var(--navy)' };

/** "Today" / "Yesterday" / a plain date — the register the rest of the app uses. Local to the viewer. */
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

export default function ActivityDays({ feed }: { feed: FeedItem[] }) {
  // Grouped here rather than passed in pre-grouped: the grouping IS the timezone-sensitive decision, so doing it
  // on the server would leave the bug in place while looking fixed.
  const days: Array<{ label: string; items: FeedItem[] }> = [];
  const now = Date.now();
  for (const f of feed) {
    const label = dayLabel(f.at, now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(f);
    else days.push({ label, items: [f] });
  }

  return (
    <>
      {days.map((d) => (
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
      ))}
    </>
  );
}
