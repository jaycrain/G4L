'use client';

import { useState } from 'react';
import ConsoleNav from './console-nav.tsx';
import { type PaneKey } from './nav-items.ts';

/**
 * The triptych and the row that drives it.
 *
 * A thin client wrapper around SERVER-rendered children: the panes arrive as props, already built on the
 * server, so switching between them on a phone is instant and costs no round trip. Only the choice of which
 * one is showing lives here.
 *
 * ABOVE THE FOLD `data-pane` is inert — the CSS shows all three columns and ignores it. BELOW THE FOLD it
 * decides which single pane owns the viewport. Nothing renders underneath, and only that pane scrolls.
 */
export default function ConsolePanes({
  left, centre, right, initialPane = 'centre',
}: {
  left: React.ReactNode; centre: React.ReactNode; right: React.ReactNode;
  initialPane?: PaneKey;
}) {
  const [pane, setPane] = useState<PaneKey>(initialPane);
  return (
    <>
      <ConsoleNav here="/admin" pane={pane} onPane={setPane} />
      <div className="fc-tri" data-pane={pane}>
        <div className="fc-flank fc-pane-left">{left}</div>
        <div className="fc-pane-centre">{centre}</div>
        <div className="fc-flank fc-pane-right">{right}</div>
      </div>
    </>
  );
}
