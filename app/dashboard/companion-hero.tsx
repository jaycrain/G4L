'use client';

import { useEffect, useRef, useState } from 'react';
import { useCompanion } from './companion-context.tsx';

// The companion's own panel (Dashboard Reshuffle §3) — titled "The G4L Companion", with one proactive
// message and a single "Talk to me" action that opens the docked rail. Deterministic v1 (no new
// intelligence): the message is computed server-side from existing state (the lit next Session, else a
// warm open). (The composed "next right call" with False Start framing is Slice 2.)
//
// Two visual states (Condensed Scroll spec): FULL at rest, and CONDENSED — a slim sticky bar (mark +
// label + Talk to me) — once the user scrolls to where the tall sticky panel would start covering the
// panels below. Purely visual: same companion, same rail, same CTA, no new data. A zero-height sentinel
// just above the panel flips the state the instant the sticky hero would engage, so it never overlaps.
export default function CompanionHero({ message }: { message: string }) {
  const companion = useCompanion();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    // Toggle off the sentinel's position, with HYSTERESIS — condense once it reaches the sticky line
    // (~top of viewport), but only re-expand after scrolling well back up. The dead zone between the two
    // thresholds stops the sub-pixel trackpad jitter that made a single knife-edge trigger vibrate.
    let raf = 0;
    const evaluate = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      setCondensed((c) => (c ? (top >= 56 ? false : c) : top <= 4 ? true : c));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(evaluate);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    evaluate();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="companion-hero-sentinel" aria-hidden="true" />
      <div className={`companion-hero${condensed ? ' is-condensed' : ''}`} data-tour="companion">
        <div className="companion-hero-head">
          <span className="companion-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M21 11.5a8.5 8.5 0 01-12.3 7.6L3 20l1-4.6A8.5 8.5 0 1121 11.5z" />
              <circle cx="8.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="companion-greeting">The G4L Companion</span>
        </div>
        <p className="companion-message">{message}</p>
        <div className="companion-hero-cta">
          <button type="button" className="hero-talk" onClick={() => companion?.open()}>
            Talk to me <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </>
  );
}
