'use client';

import { useEffect, useState } from 'react';
import type { ScaleExpectation } from '../../lib/agent/onboarding.ts';

// W-24 — the shared administered-scale answer surface. When a turn carries an `expects: {kind:'scale'}` (an IDQ /
// Grinta / SDT / self-management / checkpoint item), the arc's chat renders THIS instead of leaning on the free-text
// box: tappable rounded-square chips 1..max with the instrument's own pole anchors beneath the ends. A tap sends the
// number as the member's reply (the engine parses it exactly as a typed digit). The picked chip fills teal until the
// next item arrives (a fresh `expects` object) — the effect resets the highlight per turn. The text box stays available
// beneath (a member can still type), so nothing is lost. One component, every arc.
export default function ScaleChips({
  expects,
  disabled,
  onPick,
}: {
  expects: ScaleExpectation;
  disabled?: boolean;
  onPick: (n: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // A new turn hands in a fresh `expects` object → clear the highlight so the next item starts unselected.
  useEffect(() => setPicked(null), [expects]);

  const nums = Array.from({ length: expects.max - expects.min + 1 }, (_, i) => expects.min + i);

  function pick(n: number) {
    if (disabled || picked != null) return; // one pick per item; ignore taps while the turn is in flight
    setPicked(n);
    onPick(n);
  }

  return (
    <div className="scale-chips" role="group" aria-label="Pick a number on the scale">
      {/* W-48: universal length cue — "Question n of y" on every measurement instrument (when the engine supplies it). */}
      {expects.index != null && expects.total != null && (
        <p className="scale-chips-progress">Question {expects.index} of {expects.total}</p>
      )}
      <div className="scale-chips-row">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            className={`scale-chip${picked === n ? ' on' : ''}`} aria-pressed={picked === n}
            onClick={() => pick(n)}
            disabled={disabled || picked != null}
            aria-label={
              n === expects.min
                ? `${n} — ${expects.minLabel}`
                : n === expects.max
                  ? `${n} — ${expects.maxLabel}`
                  : String(n)
            }
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-chips-anchors">
        <span>{expects.minLabel}</span>
        <span>{expects.maxLabel}</span>
      </div>
    </div>
  );
}
