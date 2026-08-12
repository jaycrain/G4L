'use client';

import { useEffect } from 'react';
import { recordZone } from './zone-actions.ts';

// WE DO NOT ASK A MEMBER WHAT TIMEZONE THEY ARE IN.
//
// It is a question nobody should have to answer for a tracker to record the right day, and the browser already
// knows. This posts it once per browser session; the server keeps it only if we have none yet, so a member who
// set theirs deliberately (travelling, a laptop pinned to head office) is never quietly overwritten.
//
// Silent by design — no UI, no toast, nothing to dismiss. It is either right, in which case there is nothing to
// say, or the member corrects it on their account page.
export default function DetectZone({ memberId }: { memberId: string }) {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    // Once per tab-session per zone. The key carries the zone so that crossing a timezone re-posts rather than
    // staying quiet for the rest of the session.
    const key = `g4l.zone.${zone}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Private mode / storage disabled. Post anyway — a redundant no-op update beats never detecting at all.
    }
    // Never surfaced to the member: a failure here means their dates stay on the previous behaviour (UTC), which
    // is not something to interrupt them about.
    void recordZone(memberId, zone).catch(() => {});
  }, [memberId]);

  return null;
}
