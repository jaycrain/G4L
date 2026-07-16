'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { renewAdminSessionAction } from './actions.ts';

// Live console: re-pull the server-rendered page on an interval so new activity appears without a
// manual refresh. Uses router.refresh() (data only — open menus / in-progress form edits survive),
// skips hidden tabs, and slides the admin session forward each tick so the operator stays signed in.
const DEFAULT_INTERVAL_MS = 30_000;

export default function AdminAutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [secsAgo, setSecsAgo] = useState(0);
  const lastRef = useRef(Date.now());

  // The polling loop.
  useEffect(() => {
    if (paused) return;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return; // don't poll a background tab
      await renewAdminSessionAction();
      router.refresh();
      lastRef.current = Date.now();
      setSecsAgo(0);
    };
    const id = setInterval(tick, intervalMs);
    // Refresh immediately when the tab regains focus after being away.
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [paused, intervalMs, router]);

  // A 1s "updated Ns ago" counter, purely cosmetic.
  useEffect(() => {
    const id = setInterval(() => setSecsAgo(Math.round((Date.now() - lastRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const ago = secsAgo < 5 ? 'just now' : secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  return (
    <div className="admin-live">
      <span className={`admin-live-dot${paused ? ' paused' : ''}`} aria-hidden="true" />
      <span className="admin-live-label">
        {paused ? 'Paused' : 'Live'} · updated {ago}
      </span>
      <button type="button" className="admin-live-toggle" onClick={() => setPaused((p) => !p)}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className="admin-live-toggle" onClick={() => { router.refresh(); lastRef.current = Date.now(); setSecsAgo(0); }}>
        Refresh now
      </button>
    </div>
  );
}
