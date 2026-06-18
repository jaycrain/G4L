'use client';

import Link from 'next/link';
import { useCompanion } from './companion-dock.tsx';

// The companion hero (Dashboard Reshuffle §3) — the dashboard's lead block now. Greeting by name + one
// proactive message + a primary CTA. Deterministic v1 (no new intelligence): the message + CTA are
// computed server-side from existing state (the lit next Session, else a warm open). "Talk to me" opens
// the docked rail via the dock context. (The composed "next right call" with False Start framing is Slice 2.)
export default function CompanionHero({
  name,
  message,
  cta,
}: {
  name: string;
  message: string;
  cta: { label: string; href: string } | null;
}) {
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
        <span className="companion-greeting">{name}, I&apos;m right here.</span>
      </div>
      <p className="companion-message">{message}</p>
      <div className="companion-hero-cta">
        {cta && (
          <Link href={cta.href} className="hero-primary">{cta.label}</Link>
        )}
        <button type="button" className="hero-talk" onClick={() => companion?.open()}>
          Talk to me
        </button>
      </div>
    </div>
  );
}
