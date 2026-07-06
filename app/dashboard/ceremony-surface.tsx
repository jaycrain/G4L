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
  // A brief hold after a reveal lands (e.g. the ID Score on beat 3) so it can't be tapped past
  // instantly — "the pacing is the product."
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (done && beat.reveal !== undefined) {
      setHeld(true);
      const t = setTimeout(() => setHeld(false), 1500);
      return () => clearTimeout(t);
    }
    setHeld(false);
    return undefined;
  }, [done, beat.reveal, i]);

  // Typewriter: ONE interval for the component's whole life, driven by refs (always current). Every tick it either
  // resets on a beat change or types one more char toward the LIVE text length. Why not a per-beat effect: in this
  // app the parent rebuilds `beats` every render and dev (StrictMode/Fast-Refresh) churns per-beat effects, which
  // stranded the card at just the caret (the "stuck, never typed out" bug). A single ref-driven loop can't be
  // stranded by effect churn or a transiently-short text read. "The pacing is the product."
  const iRef = useRef(i);
  iRef.current = i;
  const fullRef = useRef(full);
  fullRef.current = full;
  const shownRef = useRef(0);
  const seenIRef = useRef(i);
  useEffect(() => {
    const t = setInterval(() => {
      if (seenIRef.current !== iRef.current) {
        seenIRef.current = iRef.current; // a new beat → restart typing
        shownRef.current = 0;
        setShown(0);
        return;
      }
      if (shownRef.current < fullRef.current.length) {
        shownRef.current += 1;
        setShown(shownRef.current);
      }
    }, 24);
    return () => clearInterval(t);
  }, []);

  function advance() {
    if (!done) {
      shownRef.current = full.length; // keep the loop's ref in sync
      setShown(full.length); // tap to finish typing
      return;
    }
    if (held) return; // let the reveal land before moving on
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
