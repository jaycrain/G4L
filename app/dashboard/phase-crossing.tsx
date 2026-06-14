'use client';

import { useState } from 'react';
import Link from 'next/link';

// One-time banner the first time the member lands on the dashboard after crossing a Checkpoint into a
// new R. Persisted "seen" lives server-side, so it shows once; the × just closes it for this view.
export default function PhaseCrossing({
  prevLabel,
  newLabel,
  blurb,
  cta,
}: {
  prevLabel: string;
  newLabel: string;
  blurb: string;
  cta?: { href: string; label: string } | null;
}) {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div className="phase-cross" role="status">
      <button type="button" className="phase-cross-x" aria-label="Dismiss" onClick={() => setShow(false)}>
        ×
      </button>
      <div className="phase-cross-eyebrow">{prevLabel} complete</div>
      <div className="phase-cross-title">
        You&apos;ve crossed into <span>{newLabel}</span>
      </div>
      <p className="phase-cross-blurb">{blurb}</p>
      {cta && (
        <Link href={cta.href} className="phase-cross-cta">
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
