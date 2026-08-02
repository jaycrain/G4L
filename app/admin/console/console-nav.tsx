'use client';

import Link from 'next/link';
import { CONSOLE_NAV, CONSOLE_PANES, type PaneKey } from './nav-items.ts';

// THE ONE NAV ROW.
//
// ABOVE THE FOLD it is the sections — Console, Members, Attention, … — and all three console columns are on
// screen at once, so there is nothing to switch between.
//
// BELOW THE FOLD the three columns join the same row (Jay: option A, "one merged segmented row"), and the
// "Console" section tab drops out, because the three pane tabs ARE the console. Two mechanics, one control:
// a pane tab switches in place when we're ON the console, and links to /admin?pane=… from anywhere else. That
// difference is invisible in use, which is the point — you tap a thing and that screen takes over.

export default function ConsoleNav({
  here, pane, onPane,
}: {
  /** The href of the current page, so it renders as position rather than as a link to itself. */
  here: string;
  /** Present only on the console, where a pane tab switches in place instead of navigating. */
  pane?: PaneKey;
  onPane?: (p: PaneKey) => void;
}) {
  return (
    <nav className="fc-nav" aria-label="Console">
      {CONSOLE_PANES.map((p) =>
        onPane ? (
          <button
            key={p.key}
            type="button"
            className={`fcs-tab fc-pane-tab${pane === p.key ? ' on' : ''}`}
            aria-pressed={pane === p.key}
            onClick={() => onPane(p.key)}
          >
            {p.label}
          </button>
        ) : (
          // From a subpage the pane is a destination, not a state — carried in the URL so it also survives
          // a back button and a shared link.
          <Link key={p.key} className="fcs-tab fc-pane-tab" href={`/admin?pane=${p.key}`}>
            {p.label}
          </Link>
        ),
      )}

      {CONSOLE_NAV.map((n) => {
        // The console's own tab is hidden below the fold (CSS) — the pane tabs already lead there.
        const home = n.href === '/admin' ? { 'data-console-home': '' } : {};
        return n.href === here ? (
          <span className="fcs-tab on" key={n.href} aria-current="page" {...home}>{n.label}</span>
        ) : (
          <Link className="fcs-tab" key={n.href} href={n.href} {...home}>{n.label}</Link>
        );
      })}
    </nav>
  );
}
