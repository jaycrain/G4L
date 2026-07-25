import type { ReactNode } from 'react';
import Link from 'next/link';
import RedesignChrome from './redesign-chrome.tsx';
import RedesignTopbar from './redesign-topbar.tsx';

// Shared subpage frame (Jay's walk: subpages had a lighter/absent header, inconsistent with the dashboard). Gives every
// subpage the SAME app topbar + a centered content column: RedesignChrome hides the global brand-bar and makes `main`
// full-bleed, so `.subpage-wrap` restores the 720px centering these pages relied on from the default `main`. Drop-in:
// wrap the page's content in <SubpageShell memberId={memberId}>…</SubpageShell>. (Movement/Badges keep their own wider
// wraps; this is for the text-column subpages: Program, Journey, Score, Story, Grinta, Field Guide, Momentum, Reclaim List.)
export default function SubpageShell({ memberId, children }: { memberId: string; children: ReactNode }) {
  return (
    <>
      <RedesignChrome />
      <RedesignTopbar memberId={memberId} />
      <div className="subpage-wrap">
        {/* Restores the "← Dashboard" link that RedesignChrome hides with the global chrome (the pages relied on it). */}
        <Link href={`/dashboard/${memberId}`} className="ws-back">← Dashboard</Link>
        {children}
      </div>
    </>
  );
}
