'use client';

import { useEffect } from 'react';
import { recordZone } from './zone-actions.ts';

// WE DO NOT ASK A MEMBER WHAT TIMEZONE THEY ARE IN.
//
// It is a question nobody should have to answer for a tracker to record the right day, and the browser already
// knows. The server keeps it only if we have none yet, so a member who set theirs deliberately (travelling, a
// laptop pinned to head office) is never quietly overwritten.
//
// MOUNTED IN THE ROOT LAYOUT, beside PwaClient, and that is the whole point. The first version sat in the
// dashboard page BELOW the triptych's early return — dead code for every member on prod, so nothing was ever
// detected while the feature looked shipped. Three render branches meant three chances to miss one; the layout
// is the single place they all pass through.
//
// Silent by design — no UI, no toast, nothing to dismiss. It is either right, in which case there is nothing to
// say, or the member corrects it on their account page.
export default function DetectZone() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    // Keyed by zone so that crossing a timezone re-posts rather than staying quiet for the rest of the session.
    const key = `g4l.zone.${zone}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Private mode / storage disabled. Post anyway — a redundant no-op update beats never detecting at all.
    }
    // The key is set only once the server confirms it had someone to attach the zone TO. On a logged-out page
    // (the front door, /login, a member part-way through onboarding who has no profile row yet) this returns
    // false and we stay willing to try again — otherwise the visit that could not record would silently spend
    // the one attempt this browser session gets.
    void recordZone(zone)
      .then((recorded) => {
        if (recorded) try { sessionStorage.setItem(key, '1'); } catch { /* storage disabled; harmless */ }
      })
      // Never surfaced: a failure here means their dates stay on the previous behaviour (UTC), which is not
      // something to interrupt a member about.
      .catch(() => {});
  }, []);

  return null;
}
