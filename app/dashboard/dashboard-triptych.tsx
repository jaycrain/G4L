'use client';

import { useState } from 'react';
import RedesignChrome from './redesign-chrome.tsx';
import TriptychCenter from './triptych-center.tsx';
import type { HeroCard } from '../../lib/dashboard/hero-card.ts';

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
  hero,
  left,
  right,
}: {
  memberId: string;
  firstName: string;
  hero: HeroCard | null;
  left: React.ReactNode; // "Where You Are" — server-rendered panels passed in (same pattern as RedesignShell's children)
  right: React.ReactNode; // "What's Next" — server-rendered panels
}) {
  const [pane, setPane] = useState<Pane>('center'); // mobile: which pane is showing (desktop shows all three)

  return (
    <>
      <RedesignChrome />
      <div className="redesign-topbar">
        <div className="rt-brand" aria-label="Grinta for Life">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
        </div>
        {firstName && <span className="rt-who">{firstName}</span>}
      </div>

      <div className={`tri-app pane-${pane}`}>
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
            <TriptychCenter memberId={memberId} hero={hero} />
          </section>
          <aside className="tri-flank tri-right" aria-label="What's next">
            {right}
          </aside>
        </div>
      </div>
    </>
  );
}
