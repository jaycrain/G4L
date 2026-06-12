'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';

// The reusable Companion Ceremony surface (docs/ceremony-threshold.md): an overlay that dims the live
// dashboard, brings the companion to center, delivers paced beats (typewriter, member-advanced) with
// named reveal slots, and resolves to a single hand-off. Threshold is the first content that runs on
// it; Clip-Back-In / Checkpoint / crisis are future content. Generic over the reveal type R.

export type CeremonyBeatInput<R> = { text: string; small?: boolean; reveal?: R };

export default function CeremonySurface<R>({
  beats,
  companionLabel,
  resolveLabel,
  onResolve,
  renderReveal,
}: {
  beats: CeremonyBeatInput<R>[];
  companionLabel: string;
  resolveLabel: string;
  onResolve: () => void | Promise<void>;
  renderReveal?: (reveal: R) => ReactNode;
}) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0); // typed characters of the current beat
  const [resolving, setResolving] = useState(false);
  const beat = beats[i]!;
  const full = beat.text;
  const done = shown >= full.length;
  const isLast = i >= beats.length - 1;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter: type the current beat; reset on advance. "The pacing is the product."
  useEffect(() => {
    setShown(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setShown((s) => {
        if (s >= full.length) {
          if (timer.current) clearInterval(timer.current);
          return s;
        }
        return s + 1;
      });
    }, 24);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [i, full]);

  function advance() {
    if (!done) {
      setShown(full.length); // tap to finish typing
      return;
    }
    if (isLast) {
      if (resolving) return;
      setResolving(true);
      void Promise.resolve(onResolve());
      return;
    }
    setI((n) => n + 1);
  }

  return (
    <div className="cer-overlay" role="dialog" aria-modal="true">
      <div className="cer-card" onClick={advance}>
        <div className="cer-comp">
          <span className="cer-spark" aria-hidden="true">✦</span>
          <span className="cer-label">{companionLabel}</span>
        </div>
        <p className={`cer-beat${beat.small ? ' small' : ''}`}>
          {full.slice(0, shown)}
          {!done && <span className="cer-caret" aria-hidden="true">▍</span>}
        </p>
        {done && beat.reveal !== undefined && renderReveal && <div className="cer-reveal">{renderReveal(beat.reveal)}</div>}
        <div className="cer-controls">
          <div className="cer-dots" aria-hidden="true">
            {beats.map((_, k) => (
              <span key={k} className={`cer-dot${k <= i ? ' on' : ''}`} />
            ))}
          </div>
          <button
            type="button"
            className="cer-btn"
            disabled={resolving}
            onClick={(e) => {
              e.stopPropagation();
              advance();
            }}
          >
            {!done ? 'Continue →' : isLast ? (resolving ? '…' : resolveLabel) : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
