'use client';

import { useState, useEffect } from 'react';
import RedesignChrome from './redesign-chrome.tsx';
import TriptychCenter from './triptych-center.tsx';
import TopbarView from './topbar-view.tsx';
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
  displayName,
  avatarUrl,
  identitySelves,
  phaseLabel,
  hasStory,
  hero,
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
  /** Lines said in a Session, waiting in the Journal for a decision — the daily cue. */
  waitingCount?: number;
  left: React.ReactNode; // "Where You Are" — server-rendered panels passed in (same pattern as RedesignShell's children)
  right: React.ReactNode; // "What's Next" — server-rendered panels
}) {
  const [pane, setPane] = useState<Pane>('center'); // mobile: which pane is showing (desktop shows all three)

  // CAT-46 — let the Opening Tour drive the fold. The tour walks stops that live in the flank panes, which are
  // display:none on mobile; without this it measured 0×0 anchors and silently skipped 7 of 9 introductions,
  // permanently (the tour is once-per-member). An event rather than lifted state on purpose: the tour is mounted
  // elsewhere in the tree, and threading a context through for one transient interaction would cost more than it
  // buys. No-op on desktop, where every pane is already visible.
  useEffect(() => {
    const onShow = (e: Event) => {
      const next = (e as CustomEvent).detail;
      if (next === 'left' || next === 'right' || next === 'center') setPane(next);
    };
    window.addEventListener('g4l:show-pane', onShow);
    return () => window.removeEventListener('g4l:show-pane', onShow);
  }, []);
  // ARRIVE AT THE TOP, so the hero is whole (Jay, 2026-08-28: "Returning to the Dashboard after a
  // Checkpoint/Session should show the Hero unpinned").
  //
  // The hero condenses to a strip once it reaches the sticky line, which is right while you are reading down the
  // page and wrong the moment you arrive. Coming back from a Session the browser restores the previous scroll
  // position, so the first thing a member saw after finishing the Drift Quiz was "Nice work — the Reconnect
  // Checkpoint is next" collapsed into a bar — the one screen in the product whose whole job is to tell them
  // what they just did and what is next.
  //
  // On MOUNT only. A member who scrolls during a visit is left alone; this is about where a visit begins.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
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
      {/* The shared topbar. It used to be hand-rolled here, in redesign-dashboard AND in redesign-topbar — and
          that duplication is what lost the tour's Account stop, which was anchored in the one copy the tour never
          renders. One definition now. */}
      <TopbarView displayName={displayName} avatarUrl={avatarUrl ?? null} />

      <div className={`tri-app pane-${pane}`}>
        {/* The MEMBER strip — who they are + what they're reclaiming. Full-width, above the columns.
            TRIMMED 2026-08-08 (Jay), and both cuts remove a DUPLICATE rather than a feature:
              · the PHASE chip — the Companion hero right below it already reads "Program › Reclaim › …", so the
                chip was the same fact twice, six inches apart;
              · the MY STORY link — My Story now lives in the Playbook's "Who you are" tab, beside the story-so-far.
                It is the description of whose Playbook it is; next to a greeting it was just a nav item.
            The strip keeps the one thing nothing else says: who they're reclaiming. */}
        {identitySelves && (
          <div className="tri-member">
            <div className="tri-member-id">
              <span className="tri-member-name">Hi {firstName}!</span>
              <span className="tri-member-reclaim">Reclaiming {identitySelves}</span>
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
