'use client';

// The Field Guide — in-product orientation: what the program is, how the 4Rs work, and how to read
// every dashboard panel (Field Guide Build Spec v1.2). A persistent header link, read-and-dismiss
// overlay. NO auto-open — the Threshold owns first arrival (personalized); this is the generic
// reference a member returns to on demand. Static copy; the only dynamic piece is the identity line.

import { useEffect, useState } from 'react';

export default function FieldGuide({ identityLine }: { identityLine: string | null }) {
  const [open, setOpen] = useState(false);

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
                again. You “clip in” to begin, and “clip back in” every time the Loop brings you around for
                another lap.
              </p>
            </section>

            <section>
              <h3>Your G4L Playbook</h3>
              <p>
                As you go, your companion builds you a Playbook — the short, personal record of what’s
                actually working for you: the reframes that landed, the science that convinced you, and your
                own best lines. It’s the thing you keep and reach for when you need it. (Different from The
                Story so Far, which is the full log of everything you’ve done — the Playbook is the cheat
                sheet of what it meant.) Find it up top, next to this guide.
              </p>
            </section>

            <section>
              <h3>How to read your screen — top to bottom</h3>
              <p>Every panel is live, and all of it is yours.</p>
              <dl className="fg-panels">
                <dt>Up top (the header)</dt>
                <dd>your name, and in the corner — this Field Guide and your Playbook.</dd>
                <dt>{identityLine ?? 'Reconnecting your identity'}</dt>
                <dd>who you’re bringing back, and why we start there.</dd>
                <dt>ID Score</dt>
                <dd>the mirror. How far you’ve drifted from yourself, 0–100; it moves slowly, on purpose (you retake the IDQ every 60 days). The four dimensions beneath read across then down — Physical, Self, Social, Outlook.</dd>
                <dt>Next Beat</dt>
                <dd>your next small piece of work. Each one ends with a close — your turn to answer. That’s how doing the work becomes progress you can see.</dd>
                <dt>Journey</dt>
                <dd>where you are on the path, and how many things you’ve still got to win back.</dd>
                <dt>Reclaim List</dt>
                <dd>the concrete things you’re after. The whole point. Add or refine them anytime — just talk to your companion.</dd>
                <dt>GRINTA! Index</dt>
                <dd>your grit. Unlike the ID Score, this moves every time you show up. The mirror tells you where you are; the grit tells you how hard you’re fighting. Two reads, two jobs.</dd>
                <dt>Today’s GRINTA! Beat</dt>
                <dd>your daily clip-in — one rep keeps the grit moving.</dd>
                <dt>Movement</dt>
                <dd>connect Strava and your rides, runs, and walks show up alongside the work.</dd>
                <dt>Past Beats · The Story so Far</dt>
                <dd>everything you’ve worked, saved to revisit anytime.</dd>
                <dt>Your Doors</dt>
                <dd>how the Fade got in. Add or refine these too — just talk to your companion.</dd>
                <dt>Talk · Your G4L Companion</dt>
                <dd>always in the corner. Tap it anytime.</dd>
              </dl>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
