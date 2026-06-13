'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Keep the dashboard panels (Next Beat, GRINTA! Index, Journey, Reclaim List, Measures) fresh
// across devices. A member who makes progress on their iPad and then opens their laptop should not
// be staring at stale state. router.refresh() is a SOFT refresh: it re-runs the server component and
// reconciles the DOM, preserving client state (open chat, half-typed measure input) — no full reload.
//
// Triggers: the moment this device regains focus / becomes visible (the device-switch case), plus a
// gentle interval while the tab is actually visible. Hidden tabs never poll.
export default function DashboardSync() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < 3000) return; // focus + visibilitychange can both fire — throttle the burst
      last = now;
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);
  return null;
}
