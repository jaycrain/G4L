'use client';

// The Field Guide — in-product orientation: what the program is, how the 4Rs work, and how to read
// every dashboard panel. A persistent header link; auto-opens once (per device) the first time a
// member lands on the dashboard, so nobody hits it cold; read-only overlay after that. Static copy —
// the only dynamic piece is the member's identity line (verb-tracks-the-phase, same as the hero).

import { useEffect, useState } from 'react';

export default function FieldGuide({ identityLine }: { identityLine: string | null }) {
  const [open, setOpen] = useState(false);

  // Auto-open once per device on first dashboard arrival.
  useEffect(() => {
    try {
      if (!localStorage.getItem('g4l_fg_seen')) {
        setOpen(true);
        localStorage.setItem('g4l_fg_seen', '1');
      }
    } catch {
      /* private mode / no storage — just don't auto-open */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="logout-link" onClick={() => setOpen(true)}>
        Field Guide
      </button>
      {open && (
        <div className="fg-overlay" onClick={() => setOpen(false)}>
          <div className="fg-panel" role="dialog" aria-label="Field Guide" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="fg-head">
              <h2>Field Guide</h2>
              <button type="button" className="fg-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <section>
              <h3>What this is</h3>
              <p>
                You’re here to close a distance — between who you are right now and who you still are
                underneath. We call that gap the Fade. This is how you close it, at your own pace, and keep
                it closed.
              </p>
            </section>

            <section>
              <h3>How the work moves — the 4Rs</h3>
              <p>
                The work runs through four movements, as a loop. You clip back into them again and again,
                because identity slips and life keeps moving. That’s why it’s Grinta for Life.
              </p>
              <ul className="fg-rs">
                <li><strong>Reconnect</strong> — See where you are honestly. Remember who you were before life talked you out of it. Find the spark.</li>
                <li><strong>Rewire</strong> — Take apart the old stories your mind tells to keep you comfortable. Build new frames around your body, your food, and yourself.</li>
                <li><strong>Rebuild</strong> — The physical work: move, fuel, sleep. The numbers start to move here — and you begin it early, while you’re still rewiring.</li>
                <li><strong>Reclaim</strong> — Carry the recovered identity back out into the world: people, community, adventure.</li>
              </ul>
              <p>
                You start at Reconnect. Rewire and Rebuild run together from there. Reclaim is the state
                you’re working toward — and when you reach it, life shifts, your list re-forms, and you go
                again. That return is the Loop.
              </p>
            </section>

            <section>
              <h3>How to read your Dashboard</h3>
              <p>Every panel is live, and all of it is yours. Top to bottom:</p>
              <dl className="fg-panels">
                <dt>{identityLine ?? 'Reconnecting your identity'}</dt>
                <dd>who you’re bringing back, and why we start there.</dd>
                <dt>ID Score</dt>
                <dd>the mirror. How far you’ve drifted from yourself, 0–100. It moves slowly on purpose; you retake the IDQ every 60 days. The four dimensions below it — Physical, Self, Social, Outlook — are what it’s built from.</dd>
                <dt>Next Beat</dt>
                <dd>your next small piece of work. Each one ends with a close — your turn to answer. That’s how doing the work becomes progress you can see.</dd>
                <dt>Journey</dt>
                <dd>where you are on the path, and how many things you’ve still got to win back.</dd>
                <dt>Reclaim List</dt>
                <dd>the concrete things you’re after. The whole point.</dd>
                <dt>GRINTA! Index</dt>
                <dd>your grit. Unlike the ID Score, this moves every time you show up. The mirror tells you where you are; the grit tells you how hard you’re fighting. Two reads, two jobs.</dd>
                <dt>Movement</dt>
                <dd>connect Strava and your rides, runs, and walks show up alongside the work.</dd>
                <dt>Past Beats · The Story so Far</dt>
                <dd>everything you’ve worked, saved to revisit anytime.</dd>
                <dt>Your Doors</dt>
                <dd>how the Fade got in.</dd>
                <dt>Talk</dt>
                <dd>your guide is always here. Tap it anytime.</dd>
              </dl>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
