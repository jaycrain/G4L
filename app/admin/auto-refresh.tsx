'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { renewAdminSessionAction } from './actions.ts';

// Live console: re-pull the server-rendered page on an interval so new activity appears without a manual
// refresh. Uses router.refresh() (data only — client state such as the Companion thread survives), skips
// hidden tabs, and slides the admin session forward each tick so the operator stays signed in.
//
// A CLOCK TIME, NOT AN AGE. This read "updated 14s ago", which is a number that answers a question nobody
// asks and changes every second. Jay: "move live updated (actually time stamp it) to the header." "Live ·
// 4:52 PM" says the one useful thing — how stale is what I'm looking at — and stays still.
//
// PAUSE IS GONE. Jay: "drop Pause (why do I need that)". It existed to stop the page moving under you while
// reading; a 30-second data-only refresh doesn't move anything you're reading, so it was a control guarding
// against a problem this component doesn't have.
const DEFAULT_INTERVAL_MS = 30_000;

const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default function AdminAutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  // Null until mounted. A clock rendered on the server and a clock rendered on the client disagree by
  // definition, and React calls that a hydration error — so the first paint deliberately shows neither.
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    setStamp(clock(Date.now()));
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return; // don't poll a background tab
      await renewAdminSessionAction();
      router.refresh();
      setStamp(clock(Date.now()));
    };
    const id = setInterval(tick, intervalMs);
    // Refresh immediately when the tab regains focus after being away — the common case on a phone.
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [intervalMs, router]);

  return (
    <span className="admin-live">
      <span className="admin-live-dot" aria-hidden="true" />
      <span className="admin-live-label">
        {/* The word drops out on a narrow phone (CSS) — the pulsing dot beside it already says "live", and
            the header has to fit on one row. The TIME is the part that carries information. */}
        <span className="admin-live-word">Live · </span>{stamp ?? '—'}
      </span>
      <button
        type="button"
        className="admin-live-toggle"
        onClick={() => { router.refresh(); setStamp(clock(Date.now())); }}
      >
        Refresh
      </button>
    </span>
  );
}
