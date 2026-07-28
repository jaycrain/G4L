'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import RedesignChrome from './redesign-chrome.tsx';
import TriptychCenter from './triptych-center.tsx';
import { initials } from '../../lib/member/avatar.ts';
import type { HeroCard } from '../../lib/dashboard/hero-card.ts';
import type { CenterKeeper } from '../../lib/dashboard/center-keeper.ts';

// Dashboard triptych — the reflect ← Companion → act layout (docs/dashboard-triptych-spec.md). PHASE 1: the SHELL only.
// Desktop = three columns (Where You Are · G4L Companion [elevated] · What's Next), fixed to the viewport, each region
// scrolls internally, the page never scrolls. Mobile ≤1000px = ONE pane at a time via a top segmented control, Companion
// default. Regions are placeholders here — the point of this phase is to prove the 3-col ⇄ 3-pane fold on both screens
// before any content goes in. Flag-gated (DASH_TRIPTYCH); the current dashboard is untouched until we flip.

type Pane = 'left' | 'center' | 'right';
const PANES: { key: Pane; label: string }[] = [
  { key: 'left', label: 'Where You Are' },
  { key: 'center', label: 'G4L Companion' },
  { key: 'right', label: "What's Next" },
];

export default function DashboardTriptych({
  memberId,
  firstName,
  displayName,
  avatarUrl,
  identitySelves,
  phaseLabel,
  hasStory,
  hero,
  keeper,
  left,
  right,
}: {
  memberId: string;
  firstName: string;
  displayName: string;
  avatarUrl?: string | null;
  identitySelves?: string | null; // who they're reclaiming, e.g. "the Athlete" (or named selves joined)
  phaseLabel?: string | null; // the R they're in now, e.g. "Rebuild"
  hasStory?: boolean; // show the "My Story" nav only once their narrative exists
  hero: HeroCard | null;
  keeper: CenterKeeper | null;
  left: React.ReactNode; // "Where You Are" — server-rendered panels passed in (same pattern as RedesignShell's children)
  right: React.ReactNode; // "What's Next" — server-rendered panels
}) {
  const [pane, setPane] = useState<Pane>('center'); // mobile: which pane is showing (desktop shows all three)
  // Remember the last pane across a subpage round-trip (Jay): leave "What's Next" → tap a See-more → ← Dashboard should
  // land you back on "What's Next", not reset to center. Restored AFTER mount (not the initial state) so SSR and the
  // first client render both start on 'center' — no hydration mismatch. Session-scoped; a fresh tab starts at center.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('g4l-tri-pane');
      if (saved === 'left' || saved === 'right' || saved === 'center') setPane(saved);
    } catch {
      /* sessionStorage unavailable (private mode) — just default to center */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem('g4l-tri-pane', pane);
    } catch {
      /* no-op */
    }
  }, [pane]);

  return (
    <>
      <RedesignChrome />
      {/* Full topbar — matches redesign-dashboard: brand home + Program/Field Guide/Playbook nav + account. */}
      <div className="redesign-topbar">
        <Link href="/" className="rt-brand" aria-label="Go to your G4L home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
        </Link>
        <div className="rt-who">
          <span className="rt-nav">
            <Link href={`/program/${memberId}`} prefetch={false}>Program</Link>
            <Link href={`/field-guide/${memberId}`} prefetch={false}>Field Guide</Link>
            <Link href={`/playbook/${memberId}`} prefetch={false}>Playbook</Link>
          </span>
          <span className="rt-account-group">
            <Link href="/account" className="rt-account" aria-label="Your account">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rt-av" src={avatarUrl} alt={displayName} />
              ) : (
                <span className="rt-av rt-av-initials" aria-hidden="true">{initials(displayName)}</span>
              )}
            </Link>
            {hasStory && (
              <Link href={`/story/${memberId}`} className="rt-story" prefetch={false}>My Story →</Link>
            )}
          </span>
        </div>
      </div>

      <div className={`tri-app pane-${pane}`}>
        {/* The MEMBER strip — the one panel the triptych originally dropped (Jay): who they are + what they're
            reclaiming + the Phase they're in, with the My Story nav. Full-width, always visible above the columns. */}
        {(identitySelves || hasStory) && (
          <div className="tri-member">
            <div className="tri-member-id">
              <span className="tri-member-name">Hi {firstName}!</span>
              {identitySelves && <span className="tri-member-reclaim">Reclaiming {identitySelves}</span>}
            </div>
          </div>
        )}
        {/* Mobile-only segmented control (CSS-shown ≤1000px). Composer lives at the foot of the center pane, so this
            wayfinding sits at the TOP, not a bottom tab bar. */}
        <div className="tri-seg" role="tablist" aria-label="Dashboard sections">
          {PANES.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={pane === p.key}
              className={`tri-seg-btn${pane === p.key ? ' on' : ''}`}
              onClick={() => setPane(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="tri-main">
          <aside className="tri-flank tri-left" aria-label="Where you are">
            {left}
          </aside>
          <section className="tri-center" aria-label="Your G4L Companion">
            <TriptychCenter memberId={memberId} hero={hero} keeper={keeper} />
          </section>
          <aside className="tri-flank tri-right" aria-label="What's next">
            {right}
          </aside>
        </div>
      </div>
    </>
  );
}
