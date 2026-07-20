'use client';

// The in-app proactive-outreach card (Slice 1). On mount it asks the server for a governed, ready nudge; if there
// is one, it shows the Companion's reflective message with two low-friction choices: Reply (opens the rail, where
// the real conversation + kernel crisis-routing already live) or Not now (records a dismissal → cadence backs off).
// Rendered only when OUTREACH is staged (the page gates it), so it's fully dark on prod.

import { useEffect, useState } from 'react';
import { useCompanion } from './companion-context.tsx';
import { fetchReadyOutreach, respondToOutreach, type ReadyOutreach } from './outreach-actions.ts';

export default function OutreachCard({ memberId }: { memberId: string }) {
  const companion = useCompanion();
  const [nudge, setNudge] = useState<ReadyOutreach>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchReadyOutreach(memberId)
      .then((n) => { if (alive) setNudge(n); })
      .catch(() => { /* no nudge — stay silent */ });
    return () => { alive = false; };
  }, [memberId]);

  if (!nudge || gone) return null;

  const dismiss = () => {
    setGone(true);
    void respondToOutreach(memberId, nudge.id, 'dismissed');
  };
  const reply = () => {
    setGone(true);
    void respondToOutreach(memberId, nudge.id, 'replied');
    companion?.open(); // continue in the persisted check-in thread
  };

  return (
    <section className="outreach-card" aria-label="A note from your Companion">
      <div className="outreach-card-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="outreach-card-avatar" src="/icons/icon-192.png" alt="" aria-hidden="true" />
        <span className="outreach-card-from">Your G4L Companion</span>
      </div>
      <p className="outreach-card-body">{nudge.text}</p>
      <div className="outreach-card-actions">
        <button type="button" className="outreach-reply" onClick={reply}>Reply</button>
        <button type="button" className="outreach-dismiss" onClick={dismiss}>Not now</button>
      </div>
    </section>
  );
}
