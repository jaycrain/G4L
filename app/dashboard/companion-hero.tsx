'use client';

import { useCompanion } from './companion-context.tsx';

// The companion's own panel (Dashboard Reshuffle §3) — titled "The G4L Companion", with one proactive
// message and a single "Talk to me" action that opens the docked rail. Deterministic v1 (no new
// intelligence): the message is computed server-side from existing state (the lit next Session, else a
// warm open). (The composed "next right call" with False Start framing is Slice 2.)
export default function CompanionHero({ message }: { message: string }) {
  const companion = useCompanion();
  return (
    <div className="companion-hero">
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
  );
}
